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

  const hashArray = Array.from(new Uint8Array(signatureBytes));
  const computedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return computedSignature === signature;
}

// 📲 OneSignal Helper for Settlements!
async function sendSettlementNotification(campusId: string, amount: number) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

  if (!appId || !restKey || !campusId) return;

  try {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Basic ${restKey}` },
      body: JSON.stringify({
        app_id: appId,
        filters: [
          { field: "tag", key: "role", relation: "=", value: "admin" },
          { operator: "AND" },
          { field: "tag", key: "campus_id", relation: "=", value: campusId }
        ],
        headings: { en: "💰 Settlement Processed!" },
        contents: { en: `₹${amount.toFixed(2)} has been deposited to your bank account.` },
      })
    });
  } catch (err) {
    console.error("[OneSignal Error] Failed to dispatch settlement push:", err);
  }
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) {
       // 🌟 FIX 3: Log Security Events so you aren't flying blind!
       await supabase.from("payment_webhooks").insert({ event_type: "SECURITY_BREACH", payload: { error: "Missing signature" } });
       return new Response(JSON.stringify({ message: "Missing signature" }), { status: 200, headers: corsHeaders });
    }

    const rawBody = await req.text();
    const isValid = await verifySignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET);

    if (!isValid) {
      console.error("Invalid Signature!");
      await supabase.from("payment_webhooks").insert({ event_type: "SECURITY_BREACH", payload: { error: "Invalid signature attempt" } });
      return new Response(JSON.stringify({ message: "Invalid Signature" }), { status: 200, headers: corsHeaders });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    console.log(`🔔 Webhook Event Received: ${eventType}`);

    // ==========================================================
    // 🏢 LANE 1: SETTLEMENT AUTOMATION 
    // ==========================================================
    if (eventType === "settlement.processed") {
      const settlementData = payload.payload?.settlement?.entity;
      if (!settlementData) return new Response(JSON.stringify({ message: "No settlement entity" }), { status: 200 });

      const linkedAccountId = payload.account_id; 
      const utr = settlementData.utr;
      const amountInINR = settlementData.amount / 100; 

      if (!linkedAccountId) return new Response(JSON.stringify({ message: "Missing Account ID" }), { status: 200 });

      const { data: campus } = await supabase
        .from('campuses')
        .select('id')
        .eq('razorpay_account_id', linkedAccountId)
        .maybeSingle();

      const { error: settlementError } = await supabase
        .from('settlements')
        .insert({ 
          campus_id: campus?.id || null,
          razorpay_account_id: linkedAccountId,
          amount: amountInINR,
          status: 'SETTLED', 
          utr_number: utr,
          settled_at: new Date().toISOString()
        });

      if (!settlementError && campus?.id) {
        await sendSettlementNotification(campus.id, amountInINR);
      }

      return new Response(JSON.stringify({ success: true, type: "settlement" }), { status: 200, headers: corsHeaders });
    }

    // ==========================================================
    // 🍕 LANE 2: ORDER PAYMENTS
    // ==========================================================
    
    const razorpayOrderId = payload.payload?.payment?.entity?.order_id || payload.payload?.order?.entity?.id;
    const razorpayPaymentId = payload.payload?.payment?.entity?.id;

    if (!razorpayOrderId) return new Response(JSON.stringify({ message: "No order_id found" }), { status: 200, headers: corsHeaders });

    // 🌟 FIX 4: Idempotency (Prevent double processing)
    const { data: existingWebhook } = await supabase
      .from("payment_webhooks")
      .select("id")
      .eq("razorpay_payment_id", razorpayPaymentId)
      .eq("event_type", eventType)
      .maybeSingle();

    if (existingWebhook) {
      console.log(`Duplicate webhook ignored: ${razorpayPaymentId}`);
      return new Response(JSON.stringify({ success: true, message: "Already processed" }), { status: 200, headers: corsHeaders });
    }

    // LOG WEBHOOK
    await supabase.from("payment_webhooks").insert({
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      event_type: eventType,
      payload: payload,
    });

    // GET ORDER
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, payment_status")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (!order) return new Response(JSON.stringify({ message: "Order not found" }), { status: 200, headers: corsHeaders });

    if (order.payment_status === "completed" || order.status === "confirmed" || order.status === "collected" || order.status === "failed") {
      return new Response(JSON.stringify({ success: true, message: "Order already locked" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 🌟 FIX 1 & 2: STATUS LOGIC + PHANTOM STOCK FIX
    if (eventType === "payment.captured" || eventType === "order.paid") {
      // 🏎️ Optimistic Lock: Only update if it is STILL pending!
      await supabase
        .from("orders")
        .update({
          status: "confirmed",
          payment_status: "completed",
          razorpay_payment_id: razorpayPaymentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("payment_status", "pending"); 

    } else if (eventType === "payment.failed") {
      // 🏎️ Optimistic Lock
      const { error } = await supabase
        .from("orders")
        .update({
          status: "cancelled", // Make sure this matches your DB enum!
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("payment_status", "pending");

      // 👻 INJECTING THE STOCK FIX: If the payment actually failed, release the stock!
      if (!error) {
        console.log(`Payment failed. Releasing stock for order: ${order.id}`);
        await supabase.rpc('restore_order_stock', {
          p_order_id: order.id
        });
      }
    }

    return new Response(JSON.stringify({ success: true, type: "order" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Critical Webhook Error:", error.message);
    return new Response(JSON.stringify({ success: false }), { status: 200, headers: corsHeaders });
  }
});