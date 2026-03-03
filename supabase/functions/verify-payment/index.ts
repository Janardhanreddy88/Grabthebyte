import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CASHFREE_APP_ID = Deno.env.get("CASHFREE_APP_ID");
    const CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      throw new Error("Cashfree credentials not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { orderId, cfOrderId } = await req.json();

    if (!orderId && !cfOrderId) {
      return new Response(JSON.stringify({ error: "orderId or cfOrderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get order from database
    let order;
    if (orderId) {
      const { data, error } = await supabase
        .from("orders")
        .select("id, cf_order_id, status, payment_status, order_number")
        .eq("id", orderId)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      order = data;
    } else {
      const { data, error } = await supabase
        .from("orders")
        .select("id, cf_order_id, status, payment_status, order_number")
        .eq("cf_order_id", cfOrderId)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      order = data;
    }

    // If already completed, return success
    if (order.payment_status === "completed") {
      return new Response(
        JSON.stringify({
          success: true,
          status: "completed",
          orderId: order.id,
          orderNumber: order.order_number,
          source: "db_cache",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If no cf_order_id, payment not initiated yet
    if (!order.cf_order_id) {
      return new Response(
        JSON.stringify({
          success: true,
          status: "pending",
          orderId: order.id,
          message: "Payment not initiated",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify with Cashfree API
    const cashfreeResponse = await fetch(`https://api.cashfree.com/pg/orders/${order.cf_order_id}`, {
      method: "GET",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
    });

    const cashfreeData = await cashfreeResponse.json();
    console.log("Cashfree order status:", cashfreeData);

    if (!cashfreeResponse.ok) {
      console.error("Cashfree API error:", cashfreeData);
      return new Response(
        JSON.stringify({
          success: true,
          status: order.payment_status,
          orderId: order.id,
          message: "Could not verify with Cashfree",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update based on Cashfree status
    const cfStatus = cashfreeData.order_status;
    let newPaymentStatus = order.payment_status;
    let newOrderStatus = order.status;

    if (cfStatus === "PAID") {
      newPaymentStatus = "completed";
      newOrderStatus = "confirmed";
    } else if (cfStatus === "EXPIRED" || cfStatus === "CANCELLED" || cfStatus === "TERMINATED") {
      newPaymentStatus = "failed";
    } else if (cfStatus === "ACTIVE" && order.payment_status === "failed") {
      // Webhook already marked as failed (user dropped/cancelled)
      newPaymentStatus = "failed";
    }

    // --- UPDATED LOGIC STARTS HERE ---
    if (newPaymentStatus !== order.payment_status) {
      // 1. Try to get the Payment ID (Bank Reference)
      // Note: Depending on API version, this might be in 'cf_payment_id' or 'payment_session_id'
      const bankReference = cashfreeData.cf_payment_id || null;

      const { data: updatedRows, error: updateError } = await supabase
        .from("orders")
        .update({
          status: newOrderStatus,
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString(),
          cf_payment_id: bankReference, // <--- NEW: Saving Bank ID
        })
        .eq("id", order.id)
        .eq("payment_status", "pending") // <--- NEW: Race Condition Lock
        .select();

      if (updateError) {
        console.error("Database update error:", updateError);
        throw updateError;
      }

      // 2. Decrement stock ONLY if we successfully updated the row
      // This ensures we don't decrement twice if the webhook ran at the same time
      if (updatedRows && updatedRows.length > 0 && newPaymentStatus === "completed") {
        await supabase.rpc("atomic_decrement_stock", { p_order_id: order.id });
      }
    }
    // --- UPDATED LOGIC ENDS HERE ---

    return new Response(
      JSON.stringify({
        success: true,
        status: newPaymentStatus,
        orderId: order.id,
        orderNumber: order.order_number,
        cfStatus: cfStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Verify payment error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
