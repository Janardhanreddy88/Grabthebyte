import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp",
};

// 🛡️ Helper: Verify the Cashfree Signature to block hackers
async function verifySignature(ts: string, rawBody: string, signature: string, secretKey: string) {
  const data = ts + rawBody;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const dataToSign = encoder.encode(data);

  // IMPORT KEY WITH "sign" PERMISSION (This fixes the InvalidAccessError!)
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  // Generate the HMAC-SHA256 signature
  const signatureBytes = await crypto.subtle.sign("HMAC", key, dataToSign);

  // Convert binary signature to Base64 safely and efficiently
  const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  // Compare the calculated signature with the header sent by Cashfree
  return computedSignature === signature;
}

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY");

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !CASHFREE_SECRET_KEY) {
      throw new Error("Credentials not configured");
    }

    // 2. GET HEADERS
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");

    if (!signature || !timestamp) {
      console.error("Missing signature/timestamp headers");
      return new Response(JSON.stringify({ message: "Missing headers" }), { status: 200, headers: corsHeaders });
    }

    // 3. READ RAW BODY (Required for exact signature math)
    const rawBody = await req.text();

    // 4. VERIFY SIGNATURE (Security Check)
    const isValid = await verifySignature(timestamp, rawBody, signature, CASHFREE_SECRET_KEY);

    if (!isValid) {
      console.error("Invalid Signature! Potential hacking attempt.");
      return new Response(JSON.stringify({ message: "Invalid Signature" }), { status: 200, headers: corsHeaders });
    }

    // 5. PARSE DATA
    const payload = JSON.parse(rawBody);
    console.log("Webhook Verified & Received:", JSON.stringify(payload, null, 2));

    const eventType = payload.type;
    const cfOrderId = payload.data?.order?.order_id;
    const cfPaymentId = payload.data?.payment?.cf_payment_id;

    if (!cfOrderId) {
      return new Response(JSON.stringify({ message: "No order_id found" }), { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    // 6. LOG WEBHOOK (For debugging/history)
    const { error: logError } = await supabase.from("payment_webhooks").insert({
      cf_order_id: cfOrderId,
      cf_payment_id: cfPaymentId?.toString(),
      event_type: eventType,
      payload: payload,
    });

    if (logError) console.error("Webhook Log Error:", logError);

    // 7. GET CURRENT ORDER STATUS (From your Food App 'orders' table)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, payment_status")
      .eq("cf_order_id", cfOrderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error("Order not found in DB:", cfOrderId);
      return new Response(JSON.stringify({ message: "Order not found" }), { status: 200, headers: corsHeaders });
    }

    // 8. DETERMINE NEW STATUS
    let newPaymentStatus = order.payment_status;
    let newOrderStatus = order.status;
    const paymentStatus = payload.data?.payment?.payment_status;

    if (eventType === "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus === "SUCCESS") {
      newPaymentStatus = "completed";
      newOrderStatus = "confirmed";
    } else if (
      ["FAILED", "CANCELLED", "USER_DROPPED"].includes(paymentStatus) ||
      eventType === "PAYMENT_FAILED_WEBHOOK"
    ) {
      newPaymentStatus = "failed";
    }

    // 9. UPDATE DATABASE (With Race Condition Safety Lock)
    if (newPaymentStatus !== order.payment_status) {
      const { data: updatedRows, error: updateError } = await supabase
        .from("orders")
        .update({
          status: newOrderStatus,
          payment_status: newPaymentStatus,
          cf_payment_id: cfPaymentId?.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("payment_status", "pending") // <--- CRITICAL: Prevents double-updates
        .select();

      if (updateError) console.error("Update Error:", updateError);

      // 10. ATOMIC STOCK DECREMENT
      // Only runs if WE successfully updated the row to 'completed'
      if (updatedRows && updatedRows.length > 0 && newPaymentStatus === "completed") {
        await supabase.rpc("atomic_decrement_stock", { p_order_id: order.id });
        console.log("Stock decremented via Webhook for:", order.id);
      } else {
        console.log("Skipped stock update (already done or race condition handled)");
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Webhook processed perfectly" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook processing error:", error.message || error);
    // Return 200 to prevent Cashfree from retrying constantly on code failures
    return new Response(JSON.stringify({ success: false, message: "Internal Error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
