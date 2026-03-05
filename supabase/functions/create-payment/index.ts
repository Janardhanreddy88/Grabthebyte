import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CASHFREE_APP_ID = Deno.env.get("CASHFREE_APP_ID");
    const CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      throw new Error("Cashfree credentials not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    const { orderId, amount, customerName, customerEmail, customerPhone }: CreatePaymentRequest = await req.json();

    if (!orderId || !amount || !customerEmail) {
      return new Response(JSON.stringify({ error: "Missing required fields: orderId, amount, customerEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify order exists and is pending
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, payment_status, order_number")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error("Order lookup error:", orderError);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow retry for pending payments
    if (order.payment_status === "completed") {
      return new Response(JSON.stringify({ error: "Payment already completed for this order" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate unique Cashfree order ID
    const cfOrderId = `CF_${order.order_number}_${Date.now()}`;

    // Create Cashfree order - Production API
    const cashfreeResponse = await fetch("https://api.cashfree.com/pg/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
      body: JSON.stringify({
        order_id: cfOrderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: orderId,
          customer_name: customerName || "Customer",
          customer_email: customerEmail,
          customer_phone: customerPhone || "9999999999",
        },
        order_meta: {
          return_url: `${SUPABASE_URL}/functions/v1/payment-redirect?order_id=${orderId}&cf_order_id=${cfOrderId}`,
          notify_url: `${SUPABASE_URL}/functions/v1/handle-webhook`,
        },
        order_note: `Order #${order.order_number}`,
      }),
    });

    const cashfreeData = await cashfreeResponse.json();

    if (!cashfreeResponse.ok) {
      console.error("Cashfree API error:", cashfreeData);
      return new Response(JSON.stringify({ error: "Failed to create payment session", details: cashfreeData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update order with Cashfree order ID
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        cf_order_id: cfOrderId,
        payment_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Order update error:", updateError);
    }

    console.log("Payment session created:", { orderId, cfOrderId, sessionId: cashfreeData.payment_session_id });

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: cashfreeData.payment_session_id,
        cfOrderId: cfOrderId,
        orderId: orderId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Create payment error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
