import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id");
  const cfOrderId = url.searchParams.get("cf_order_id");

  const APP_URL = Deno.env.get("APP_URL") || "https://grabthebyte.com";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!orderId) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${APP_URL}/my-orders` },
    });
  }

  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Fetch order to get amount for retry flow
      const { data: order } = await supabase
        .from("orders")
        .select("total_amount, payment_status")
        .eq("id", orderId)
        .maybeSingle();

      if (order?.payment_status === "completed" || order?.payment_status === "confirmed") {
        // Payment already confirmed, go to success
        return new Response(null, {
          status: 302,
          headers: { Location: `${APP_URL}/order-success?orderId=${orderId}` },
        });
      }
    }
  } catch (err) {
    console.error("Payment redirect lookup error:", err);
  }

  // Redirect to payment page for verification
  const redirectUrl = new URL(`${APP_URL}/payment`);
  redirectUrl.searchParams.set("order_id", orderId);
  if (cfOrderId) redirectUrl.searchParams.set("cf_order_id", cfOrderId);
  redirectUrl.searchParams.set("redirect", "true");

  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl.toString() },
  });
});
