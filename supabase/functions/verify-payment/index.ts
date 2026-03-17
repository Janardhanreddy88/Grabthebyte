import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==========================================
// 1. CONFIGURATION & TYPES
// ==========================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentPayload {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

/**
 * Cryptographically verifies the payload against Razorpay's secret.
 */
async function verifySignature(orderId: string, paymentId: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const data = encoder.encode(`${orderId}|${paymentId}`);
  const hashBuffer = await crypto.subtle.sign("HMAC", key, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const generatedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return generatedSignature === signature;
}

/**
 * Dispatches a native push notification to Campus Admins.
 */
async function sendAdminNotification(campusId: string, orderNumber: string) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

  if (!appId || !restKey || !campusId) {
    console.log("[OneSignal] Skipped: Missing API keys or Campus ID.");
    return;
  }

  try {
    console.log(`[OneSignal] Dispatching order #${orderNumber} alert to campus: ${campusId}`);
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${restKey}` 
      },
      body: JSON.stringify({
        app_id: appId,
        filters: [
          { field: "tag", key: "role", relation: "=", value: "admin" },
          { operator: "AND" },
          { field: "tag", key: "campus_id", relation: "=", value: campusId }
        ],
        headings: { en: "🔔 New Order Received!" },
        contents: { en: `Order #${orderNumber} has been paid and is ready.` },
      })
    });
    
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    console.log("[OneSignal] Notification successfully dispatched.");
  } catch (err) {
    console.error("[OneSignal Error] Failed to dispatch push:", err);
  }
}

// ==========================================
// 3. MAIN EDGE FUNCTION
// ==========================================
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // A. Initialize Environment & Payload
    const RAZORPAY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    const SB_URL = Deno.env.get("SUPABASE_URL");
    const SB_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RAZORPAY_SECRET || !SB_URL || !SB_KEY) {
      throw new Error("Critical environment variables are missing.");
    }

    const supabase = createClient(SB_URL, SB_KEY);
    const payload: PaymentPayload = await req.json();

    if (!payload.orderId || !payload.razorpay_order_id || !payload.razorpay_payment_id || !payload.razorpay_signature) {
      return new Response(JSON.stringify({ error: "Malformed payment payload." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Process] Verifying payment for Order ID: ${payload.orderId}`);

    // B. Fetch Order State
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, payment_status, order_number, campus_id")
      .eq("id", payload.orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.warn(`[DB Error] Order not found: ${payload.orderId}`);
      return new Response(JSON.stringify({ error: "Order not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // C. Handle Idempotency (Early Return if already processed)
    if (order.payment_status === "completed") {
      console.log(`[Idempotency] Order #${order.order_number} is already completed. Triggering notifications.`);
      // Even if already completed, we ensure the notification goes out.
      await sendAdminNotification(order.campus_id, order.order_number);
      
      return new Response(
        JSON.stringify({ success: true, status: "completed", orderId: order.id, orderNumber: order.order_number }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // D. Cryptographic Verification
    const isValidSignature = await verifySignature(
      payload.razorpay_order_id, 
      payload.razorpay_payment_id, 
      payload.razorpay_signature, 
      RAZORPAY_SECRET
    );

    if (!isValidSignature) {
      console.error(`[Security] Invalid signature detected for Order: ${order.id}`);
      return new Response(
        JSON.stringify({ success: false, message: "Payment verification failed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // E. Execute Database Transactions
    console.log(`[DB] Signature verified. Updating status and stock for Order #${order.order_number}...`);
    
    const { data: updatedRows, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "confirmed",
        payment_status: "completed",
        updated_at: new Date().toISOString(),
        razorpay_payment_id: payload.razorpay_payment_id,
        razorpay_signature: payload.razorpay_signature,
      })
      .eq("id", order.id)
      .eq("payment_status", "pending") // Prevents race conditions
      .select();

    if (updateError) throw updateError;

    // Only decrement stock if the row was successfully updated during this execution
    if (updatedRows && updatedRows.length > 0) {
      await supabase.rpc("atomic_decrement_stock", { p_order_id: order.id });
    }

    // F. Dispatch Notifications
    await sendAdminNotification(order.campus_id, order.order_number);

    console.log(`[Process] Order #${order.order_number} completely finalized.`);
    
    // G. Final Response
    return new Response(
      JSON.stringify({
        success: true,
        status: "completed",
        orderId: order.id,
        orderNumber: order.order_number,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[Fatal Error] Unhandled exception in edge function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});