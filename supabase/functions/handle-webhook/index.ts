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

// 📲 🌟 NEW: OneSignal Helper for Settlements!
async function sendSettlementNotification(campusId: string, amount: number) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

  if (!appId || !restKey || !campusId) {
    console.warn("OneSignal config missing, skipping push notification.");
    return;
  }

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
    console.log(`✅ OneSignal Push sent to Campus Admin: ${campusId}`);
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    console.log(`🔔 Webhook Event Received: ${eventType}`);

    // ==========================================================
    // 🏢 LANE 1: SETTLEMENT AUTOMATION (Fixed & Upgraded)
    // ==========================================================
    if (eventType === "settlement.processed") {
      const settlementData = payload.payload?.settlement?.entity;
      if (!settlementData) return new Response(JSON.stringify({ message: "No settlement entity" }), { status: 200 });

      // 🌟 FIX 1: The real linked account ID is at the root of the Razorpay webhook!
      const linkedAccountId = payload.account_id; 
      const utr = settlementData.utr;
      const amountInINR = settlementData.amount / 100; // Razorpay sends amount in paise

      console.log(`🤑 Processing Settlement -> Account: ${linkedAccountId}, UTR: ${utr}, Amount: ₹${amountInINR}`);

      if (!linkedAccountId) {
         console.error("Missing linkedAccountId in webhook!");
         return new Response(JSON.stringify({ message: "Missing Account ID" }), { status: 200 });
      }

      // 🌟 FIX 2: Look up the Campus ID so we can attach the money to the right canteen
      const { data: campus } = await supabase
        .from('campuses')
        .select('id')
        .eq('razorpay_account_id', linkedAccountId)
        .maybeSingle();

      // 🌟 FIX 3: INSERT the brand new record so it actually shows up on your dashboard!
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

      if (settlementError) {
        console.error("Settlement Insert Error:", settlementError);
      } else {
        console.log(`✅ Successfully inserted settlement for UTR: ${utr}`);
        
        // 📲 🌟 NEW: FIRE THE BACKGROUND PUSH NOTIFICATION!
        if (campus?.id) {
          await sendSettlementNotification(campus.id, amountInINR);
        }
      }

      return new Response(JSON.stringify({ success: true, type: "settlement" }), { status: 200, headers: corsHeaders });
    }

    // ==========================================================
    // 🍕 LANE 2: ORDER PAYMENTS (Your Existing Logic)
    // ==========================================================
    
    // Safely extract IDs for Orders
    const razorpayOrderId = payload.payload?.payment?.entity?.order_id || payload.payload?.order?.entity?.id;
    const razorpayPaymentId = payload.payload?.payment?.entity?.id;

    if (!razorpayOrderId) return new Response(JSON.stringify({ message: "No order_id found" }), { status: 200, headers: corsHeaders });

    // 6. LOG WEBHOOK
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

    // 🛡️ Guard against late webhooks on already-resolved orders
    if (order.payment_status === "completed" || order.status === "confirmed" || order.status === "collected") {
      return new Response(JSON.stringify({ success: true, message: "Order already completed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (order.status === "failed") {
      return new Response(JSON.stringify({ success: true, message: "Order already failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
      await supabase
        .from("orders")
        .update({
          status: newOrderStatus,
          payment_status: newPaymentStatus,
          razorpay_payment_id: razorpayPaymentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id); 
    }

    return new Response(JSON.stringify({ success: true, type: "order" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Critical Webhook Error:", error.message);
    return new Response(JSON.stringify({ success: false }), { status: 200, headers: corsHeaders });
  }
});