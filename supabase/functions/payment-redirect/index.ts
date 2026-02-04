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
    const url = new URL(req.url);
    const orderId = url.searchParams.get("order_id");
    const cfOrderId = url.searchParams.get("cf_order_id");

    console.log("Payment redirect:", { orderId, cfOrderId });

    // Redirect to app payment page for status check
    const redirectUrl = `https://id-preview--ac6a2be2-d4c6-41d7-810b-cbdebecd6536.lovable.app/payment?order_id=${orderId}&cf_order_id=${cfOrderId}&redirect=true`;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl,
      },
    });
  } catch (error) {
    console.error("Redirect error:", error);
    return new Response(
      JSON.stringify({ error: "Redirect failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
