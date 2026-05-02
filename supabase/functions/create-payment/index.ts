import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePaymentRequest {
  orderId: string;
  amount: number; // Ignored for security!
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SECRET_KEY) {
      throw new Error("Missing required Environment Variables in Vault.");
    }

    // 🛡️ SECURITY PHASE 1: JWT AUTHENTICATION
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing Auth Header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid Token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 🛡️ SECURITY PHASE 2: RATE LIMITING
    const ONE_MINUTE_AGO = new Date(Date.now() - 60000).toISOString();
    const { count } = await authClient
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', ONE_MINUTE_AGO);

    if (count && count >= 6) {
      return new Response(JSON.stringify({ error: "Too many payment requests. Please wait a minute." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { orderId, customerEmail }: CreatePaymentRequest = await req.json();

    if (!orderId || !customerEmail) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    // 🌟 1. GET SECURE ORDER DETAILS (🦅 FIX: Added discount_amount to the query!)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_status, order_number, user_id, campus_id, total, discount_amount, razorpay_order_id, promo_code")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 🛡️ SECURITY PHASE 3: OWNERSHIP VERIFICATION
    if (order.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (order.payment_status === "completed") {
      return new Response(JSON.stringify({ error: "Payment already completed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // 🛡️ IDEMPOTENCY (PREVENT DOUBLE CHARGES)
    // =====================================================================
    if (order.razorpay_order_id && order.payment_status === "pending") {
      return new Response(
        JSON.stringify({ success: true, razorpayOrderId: order.razorpay_order_id, orderId: orderId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🌟 2. GET CAMPUS ROUTING DETAILS
    let razorpayAccountId = null;
    if (order.campus_id) {
      const { data: campus } = await supabaseAdmin
        .from("campuses")
        .select("razorpay_account_id")
        .eq("id", order.campus_id)
        .maybeSingle();
      
      if (campus && campus.razorpay_account_id) {
        razorpayAccountId = campus.razorpay_account_id;
      }
    }

    // =====================================================================
    // 🌟 3. SERVER-SIDE MATH (THE GROSS-UP PROFIT SHIELD)
    // =====================================================================
    const discountedSubtotal = order.total;
    
    // 🦅 THE FIX: Reconstruct the raw cart size to protect your fee tier
    const rawItemTotal = discountedSubtotal + (order.discount_amount || 0);

    let basePlatformFeeINR = 0;
    if (rawItemTotal <= 40) { basePlatformFeeINR = 2; }
    else if (rawItemTotal <= 100) { basePlatformFeeINR = 5; }
    else { basePlatformFeeINR = 6; }

    const targetBankAmount = discountedSubtotal + basePlatformFeeINR; 

    const rawFinalTotal = targetBankAmount / 0.975;
    const finalChargeINR = Math.round(rawFinalTotal * 100) / 100;
    const finalChargePaisa = Math.round(finalChargeINR * 100);
    
    const canteenSharePaisa = Math.round(discountedSubtotal * 100); 
    const exactHandlingFeeINR = Math.round((finalChargeINR - discountedSubtotal) * 100) / 100;

    const razorpayPayload: any = {
      amount: finalChargePaisa, 
      currency: "INR",
      receipt: orderId,
      notes: {
        order_number: order.order_number,
        customer_email: customerEmail,
        promo_applied: order.promo_code ? order.promo_code : "NONE"
      }
    };

    // 🌟 4. ROUTE TRANSFERS & THE BLACKHOLE ALERT
    if (razorpayAccountId) {
      razorpayPayload.transfers = [
        {
          account: razorpayAccountId,
          amount: canteenSharePaisa, 
          currency: "INR",
          notes: { brand: "GrabTheByte Settlement", order: order.order_number },
          linked_account_notes: ["brand", "order"],
          on_hold: 0 
        }
      ];
    } else {
      console.error(`🚨 ALARM: No linked account found for campus ${order.campus_id}. Keeping 100% in Master Account.`);
      razorpayPayload.notes.WARNING = "UNROUTED_FUNDS_MISSING_CAMPUS_ID";
    }

    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Basic ${basicAuth}` },
      body: JSON.stringify(razorpayPayload),
    });

    const razorpayData = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      console.error("Razorpay API error:", razorpayData);
      return new Response(JSON.stringify({ error: "Failed to create payment session", details: razorpayData }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 🌟 5. LOCK IN THE HISTORICAL ACCOUNTING FEE
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        razorpay_order_id: razorpayData.id,
        payment_status: "pending",
        updated_at: new Date().toISOString(),
        platform_fee: exactHandlingFeeINR, 
      })
      .eq("id", orderId);

    if (updateError) console.error("Order update error:", updateError);

    return new Response(
      JSON.stringify({ success: true, razorpayOrderId: razorpayData.id, orderId: orderId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});