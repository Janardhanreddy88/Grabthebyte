import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentPayload {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature?: string; 
  razorpay_key_id?: string;    
}

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

async function sendAdminNotification(campusId: string, orderNumber: string) {
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
        headings: { en: "🔔 New Order Received!" },
        contents: { en: `Order #${orderNumber} has been paid and is ready.` },
      })
    });
  } catch (err) {
    console.error("[OneSignal Error] Failed to dispatch push:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RAZORPAY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    const SB_URL = Deno.env.get("SUPABASE_URL");
    const SB_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SB_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RAZORPAY_SECRET || !SB_URL || !SB_KEY || !SB_ANON_KEY) {
      throw new Error("Missing env vars.");
    }

    // =====================================================================
    // 🛡️ SECURITY PHASE 1: JWT AUTHENTICATION
    // =====================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing Auth Header" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const authClient = createClient(SB_URL, SB_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or Expired Token" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    // =====================================================================

    const payload: PaymentPayload = await req.json();
    console.log("[INCOMING PAYLOAD]:", JSON.stringify(payload));

    if (!payload.orderId || !payload.razorpay_order_id || !payload.razorpay_payment_id) {
      return new Response(JSON.stringify({ error: "Malformed payload." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Use Admin client for backend DB operations
    const supabaseAdmin = createClient(SB_URL, SB_KEY);

    // Fetch order, including user_id for Ownership check
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_status, order_number, campus_id, user_id")
      .eq("id", payload.orderId)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found." }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // =====================================================================
    // 🛡️ SECURITY PHASE 2: OWNERSHIP VERIFICATION
    // =====================================================================
    if (order.user_id !== user.id) {
      console.warn(`[SECURITY ALERT] User ${user.id} tried to verify Order ${payload.orderId} owned by ${order.user_id}`);
      return new Response(JSON.stringify({ error: "Unauthorized: You do not own this order" }), { 
        status: 403, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    // =====================================================================

    // If already marked as completed (by webhook or retry), just return success
    if (order.payment_status === "completed") {
      await sendAdminNotification(order.campus_id, order.order_number);
      return new Response(JSON.stringify({ success: true, status: "completed" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    let isPaymentValid = false;

    if (payload.razorpay_signature) {
      isPaymentValid = await verifySignature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature, RAZORPAY_SECRET);
    } else {
      console.log("[Fallback] No signature. Fetching directly from Razorpay API...");
      const RZP_ID = Deno.env.get("RAZORPAY_KEY_ID") || payload.razorpay_key_id;
      
      if (RZP_ID) {
        const authHeader = btoa(`${RZP_ID}:${RAZORPAY_SECRET}`);
        const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${payload.razorpay_payment_id}`, {
          method: "GET",
          headers: { "Authorization": `Basic ${authHeader}` }
        });

        if (rzpRes.ok) {
          const rzpData = await rzpRes.json();
          if ((rzpData.status === "captured" || rzpData.status === "authorized") && rzpData.order_id === payload.razorpay_order_id) {
            isPaymentValid = true;
          }
        }
      }
    }

    if (!isPaymentValid) {
      return new Response(JSON.stringify({ success: false, message: "Payment verification failed." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 🌟 FIX: Removed the .eq("payment_status", "pending") lock here!
    // This function now has supreme authority to mark ANY verified order as completed.
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "confirmed",
        payment_status: "completed",
        updated_at: new Date().toISOString(),
        razorpay_payment_id: payload.razorpay_payment_id,
        razorpay_signature: payload.razorpay_signature || "api_verified", 
      })
      .eq("id", order.id);

    if (updateError) throw updateError;

    // Dispatch Push Notification to Canteen Staff
    await sendAdminNotification(order.campus_id, order.order_number);

    return new Response(JSON.stringify({ success: true, status: "completed", orderId: order.id, orderNumber: order.order_number }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: unknown) {
    console.error("[Fatal Error] Unhandled exception:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});