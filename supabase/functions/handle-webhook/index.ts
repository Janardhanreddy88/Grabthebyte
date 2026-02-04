import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload = await req.json();
    console.log("Webhook received:", JSON.stringify(payload, null, 2));

    const { data, type: eventType } = payload;

    if (!data || !eventType) {
      console.log("Invalid webhook payload - missing data or type");
      return new Response(
        JSON.stringify({ success: true, message: "Invalid payload structure" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cfOrderId = data.order?.order_id;
    const cfPaymentId = data.payment?.cf_payment_id;

    if (!cfOrderId) {
      console.log("No order_id in webhook");
      return new Response(
        JSON.stringify({ success: true, message: "No order_id found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for idempotency - prevent duplicate processing
    const { data: existingWebhook } = await supabase
      .from("payment_webhooks")
      .select("id")
      .eq("cf_order_id", cfOrderId)
      .eq("event_type", eventType)
      .maybeSingle();

    if (existingWebhook) {
      console.log("Webhook already processed:", { cfOrderId, eventType });
      return new Response(
        JSON.stringify({ success: true, message: "Already processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log webhook for idempotency
    await supabase.from("payment_webhooks").insert({
      cf_order_id: cfOrderId,
      cf_payment_id: cfPaymentId?.toString(),
      event_type: eventType,
      payload: payload,
    });

    // Find the order by cf_order_id
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, payment_status")
      .eq("cf_order_id", cfOrderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error("Order not found for cf_order_id:", cfOrderId);
      return new Response(
        JSON.stringify({ success: true, message: "Order not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already completed - skip
    if (order.payment_status === "completed") {
      console.log("Order already completed:", order.id);
      return new Response(
        JSON.stringify({ success: true, message: "Already completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process based on event type
    let newStatus = order.status;
    let newPaymentStatus = order.payment_status;

    const paymentStatus = data.payment?.payment_status;

    if (eventType === "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus === "SUCCESS") {
      newStatus = "confirmed";
      newPaymentStatus = "completed";
      console.log("Payment SUCCESS for order:", order.id);
    } else if (
      eventType === "PAYMENT_FAILED_WEBHOOK" ||
      paymentStatus === "FAILED" ||
      paymentStatus === "CANCELLED" ||
      paymentStatus === "USER_DROPPED"
    ) {
      // Keep order as pending so user can retry
      newPaymentStatus = "failed";
      console.log("Payment FAILED for order:", order.id);
    }

    // Update order
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: newStatus,
        payment_status: newPaymentStatus,
        cf_payment_id: cfPaymentId?.toString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("Error updating order:", updateError);
    } else {
      console.log("Order updated successfully:", { orderId: order.id, newStatus, newPaymentStatus });
    }

    // If payment successful, decrement stock atomically
    if (newPaymentStatus === "completed") {
      const { data: stockResult, error: stockError } = await supabase.rpc("atomic_decrement_stock", {
        p_order_id: order.id,
      });

      if (stockError) {
        console.error("Stock decrement error:", stockError);
      } else {
        console.log("Stock decremented:", stockResult);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ success: true, message: "Error processing webhook" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
