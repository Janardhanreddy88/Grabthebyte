import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

// 🛡️ Helper: Verify the Razorpay Signature
async function verifySignature(rawBody: string, signature: string, secretKey: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const dataToSign = encoder.encode(rawBody);

  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBytes = await crypto.subtle.sign("HMAC", key, dataToSign);

  // Convert binary to HEX (Razorpay standard)
  const hashArray = Array.from(new Uint8Array(signatureBytes));
  const computedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return computedSignature === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !RAZORPAY_WEBHOOK_SECRET) {
      throw new Error("Credentials not configured");
    }

    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) return new Response(JSON.stringify({ message: "Missing signature" }), { status: 200, headers: corsHeaders });

    const rawBody = await req.text();
    const isValid = await verifySignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET);

    if (!isValid) {
      console.error("Invalid Signature!");
      return new Response(JSON.stringify({ message: "Invalid Signature" }), { status: 200, headers: corsHeaders });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    
    // Safely extract IDs
    const razorpayOrderId = payload.payload?.payment?.entity?.order_id || payload.payload?.order?.entity?.id;
    const razorpayPaymentId = payload.payload?.payment?.entity?.id;

    if (!razorpayOrderId) return new Response(JSON.stringify({ message: "No order_id found" }), { status: 200, headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    // 6. LOG WEBHOOK (Using your logging table)
    await supabase.from("payment_webhooks").insert({
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      event_type: eventType,
      payload: payload,
    });

    // 7. GET ORDER
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, payment_status")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (!order) return new Response(JSON.stringify({ message: "Order not found" }), { status: 200, headers: corsHeaders });

    // 8. STATUS LOGIC
    let newPaymentStatus = order.payment_status;
    let newOrderStatus = order.status;

    if (eventType === "payment.captured" || eventType === "order.paid") {
      newPaymentStatus = "completed";
      newOrderStatus = "confirmed";
    } else if (eventType === "payment.failed") {
      newPaymentStatus = "failed";
    }

    // 9. UPDATE DATABASE
    if (newPaymentStatus !== order.payment_status) {
      const { data: updatedRows } = await supabase
        .from("orders")
        .update({
          status: newOrderStatus,
          payment_status: newPaymentStatus,
          razorpay_payment_id: razorpayPaymentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("payment_status", "pending") 
        .select();

      // 10. ATOMIC STOCK DECREMENT
      if (updatedRows && updatedRows.length > 0 && newPaymentStatus === "completed") {
        await supabase.rpc("atomic_decrement_stock", { p_order_id: order.id });
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false }), { status: 200, headers: corsHeaders });
  }
});
