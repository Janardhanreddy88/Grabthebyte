import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    // Grab OneSignal credentials from Supabase Vault
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay secret not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: "Missing required Razorpay parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. GET ORDER FROM DB
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, payment_status, order_number, campus_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.payment_status === "completed") {
      return new Response(
        JSON.stringify({ success: true, status: "completed", orderId: order.id, orderNumber: order.order_number }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. SIGNATURE VERIFICATION
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(RAZORPAY_KEY_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const data = encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`);
    const hashBuffer = await crypto.subtle.sign("HMAC", key, data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const generatedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (generatedSignature !== razorpay_signature) {
      return new Response(
        JSON.stringify({ success: false, message: "Payment verification failed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. DATABASE UPDATE & STOCK
    const { data: updatedRows, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "confirmed",
        payment_status: "completed",
        updated_at: new Date().toISOString(),
        razorpay_payment_id: razorpay_payment_id,
        razorpay_signature: razorpay_signature,
      })
      .eq("id", order.id)
      .eq("payment_status", "pending")
      .select();

    if (updateError) throw updateError;

    if (updatedRows && updatedRows.length > 0) {
      await supabase.rpc("atomic_decrement_stock", { p_order_id: order.id });
    }

    // 4. MULTI-CAMPUS PUSH NOTIFICATION
    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY && order.campus_id) {
      try {
        console.log(`📣 Sending push to Admin at campus: ${order.campus_id}`);
        const pushResponse = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}` 
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            // OneSignal assumes AND when objects are just listed sequentially!
            filters: [
              { field: "tag", key: "role", relation: "=", value: "admin" },
              { field: "tag", key: "campus_id", relation: "=", value: order.campus_id }
            ],
            headings: { en: "🔔 New Order Received!" },
            contents: { en: `Order #${order.order_number} has been paid and is ready.` },
          })
        });
        
        const pushResult = await pushResponse.json();
        console.log("🔔 OneSignal Response:", pushResult);
      } catch (err) {
        console.error("⚠️ Failed to send push notification:", err);
      }
    } else {
      console.log("⚠️ Skipped Push: Missing API Keys or Campus ID");
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "completed",
        orderId: order.id,
        orderNumber: order.order_number,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});