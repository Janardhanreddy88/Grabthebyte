import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePaymentRequest {
  orderId: string;
  amount: number; // Final amount paid by student (Item Total + Platform Fee)
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}

// 🌟 REVERSE-ENGINEERED PLATFORM FEE CALCULATOR (FLAT FEES) 🌟
function getFeeFromFinalAmount(finalAmountINR: number): number {
  // Tier 1: Item <= ₹40, Fee = ₹2 -> Max final amount = ₹42
  if (finalAmountINR <= 42) return 2;
  
  // Tier 2: Item <= ₹100, Fee = ₹5 -> Max final amount = ₹105
  if (finalAmountINR <= 105) return 5;
  
  // Tier 3: Item > ₹100, Fee = ₹6
  return 6;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured in Supabase Vault");
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SECRET_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // =====================================================================
    // 🛡️ SECURITY PHASE 1: JWT AUTHENTICATION
    // =====================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing Auth Header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or Expired Token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================================
    // 🛡️ SECURITY PHASE 2: RATE LIMITING (Max 5 attempts per minute)
    // =====================================================================
    const ONE_MINUTE_AGO = new Date(Date.now() - 60000).toISOString();
    const { count, error: rateError } = await authClient
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', ONE_MINUTE_AGO);

    if (count && count >= 5) {
      return new Response(JSON.stringify({ error: "Too many payment requests. Please wait a minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId, amount, customerName, customerEmail, customerPhone }: CreatePaymentRequest = await req.json();

    if (!orderId || !amount || !customerEmail) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    // 🌟 1. GET ORDER DETAILS (Now fetching campus_id)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_status, order_number, user_id, campus_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================================
    // 🛡️ SECURITY PHASE 3: OWNERSHIP VERIFICATION
    // =====================================================================
    if (order.user_id !== user.id) {
      console.warn(`User ${user.id} attempted to pay for Order ${orderId} belonging to ${order.user_id}`);
      return new Response(JSON.stringify({ error: "Unauthorized: You do not own this order" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.payment_status === "completed") {
      return new Response(JSON.stringify({ error: "Payment already completed for this order" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    // 🌟 3. CALCULATE THE SPLIT IN PAISA
    const finalPaidINR = amount; 
    const totalAmountPaisa = Math.round(finalPaidINR * 100);
    
    const razorpayPayload: any = {
      amount: totalAmountPaisa, 
      currency: "INR",
      receipt: orderId,
      notes: {
        order_number: order.order_number,
        customer_email: customerEmail,
      }
    };

    // 🌟 4. THE MAGIC: INJECT ROUTE TRANSFERS
    if (razorpayAccountId) {
      const platformFeeINR = getFeeFromFinalAmount(finalPaidINR); 
      const platformFeePaisa = Math.round(platformFeeINR * 100);  
      
      // Canteen gets the Final Amount MINUS the Platform Fee
      const canteenSharePaisa = totalAmountPaisa - platformFeePaisa; 

      console.log(`Student Paid: ₹${finalPaidINR} | Routing ₹${canteenSharePaisa/100} to ${razorpayAccountId} | Keeping ₹${platformFeePaisa/100} fee.`);

      razorpayPayload.transfers = [
        {
          account: razorpayAccountId,
          amount: canteenSharePaisa,
          currency: "INR",
          notes: {
            brand: "GrabTheByte Settlement",
            order: order.order_number
          },
          linked_account_notes: ["brand", "order"],
          on_hold: 0 // Settles according to default T+2 schedule
        }
      ];
    } else {
      console.log(`No linked account found for campus ${order.campus_id}. Keeping 100% in Master Account.`);
    }

    // Create Razorpay order - Production API
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: JSON.stringify(razorpayPayload),
    });

    const razorpayData = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      console.error("Razorpay API error:", razorpayData);
      return new Response(JSON.stringify({ error: "Failed to create payment session", details: razorpayData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update order with the brand new Razorpay order ID
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        razorpay_order_id: razorpayData.id,
        payment_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Order update error:", updateError);
    }

    console.log("Razorpay session created:", { orderId, razorpayOrderId: razorpayData.id });

    // Send the Razorpay Order ID back to the React frontend
    return new Response(
      JSON.stringify({
        success: true,
        razorpayOrderId: razorpayData.id,
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