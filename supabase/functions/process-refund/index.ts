import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    
    // 🌟 THE FIX: Detect if this is a Webhook or a Manual Click
    // Webhooks send { record: { id: "..." } }
    // Manual Clicks send { order_id: "..." }
    const order_id = payload.record?.id || payload.order_id

    if (!order_id) {
      throw new Error('Order ID is required')
    }

    // 1. Initialize Supabase client with Service Role (Bypasses RLS to read secure data)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Fetch the order details to get the Razorpay Payment ID
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, total, status, payment_status, razorpay_payment_id')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      throw new Error('Order not found')
    }

    // 🌟 THE ROBOT SAFETY CHECK: Only refund if actually paid!
    const isPaid = order.payment_status === 'completed' || order.payment_status === 'confirmed' || order.payment_status === 'paid'
    
    if (!isPaid) {
       return new Response(JSON.stringify({ message: 'Order was not paid. No refund needed.' }), { status: 200, headers: corsHeaders })
    }

    // Prevent double-refunding
    if (order.status === 'refunded') {
      return new Response(JSON.stringify({ message: 'Order is already refunded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 🌟 WEBHOOK SAFETY CHECK: Only automatically refund if the status is officially 'expired'
    // (If it's a manual click from your Super Admin dashboard, we bypass this check)
    if (payload.record && order.status !== 'expired') {
       return new Response(JSON.stringify({ message: 'Webhook ignored. Status is not expired.' }), { status: 200, headers: corsHeaders })
    }

    if (!order.razorpay_payment_id) {
      throw new Error('No Razorpay payment ID found for this order. Cannot refund.')
    }

    // 3. Prepare Razorpay Authentication
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    const basicAuth = btoa(`${keyId}:${keySecret}`)

    // 4. Call Razorpay Refund API (OPTION B: THE FULL REFUND)
    const razorpayRes = await fetch(`https://api.razorpay.com/v1/payments/${order.razorpay_payment_id}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // 🌟 amount is intentionally omitted so Razorpay refunds 100% of the GMV
        speed: 'normal', // Standard 5-7 day free refund
        reverse_all: 1   // 🌟 Pulls the canteen's portion back so GrabTheByte doesn't pay for it!
      })
    })

    const razorpayData = await razorpayRes.json()

    if (!razorpayRes.ok) {
      console.error('Razorpay Error:', razorpayData)
      throw new Error(razorpayData.error?.description || 'Failed to process refund with Razorpay')
    }

  // 5. Update the order status in Supabase to officially mark it as 'refunded'
    await supabaseClient
      .from('orders')
      .update({ 
        status: 'refunded',
        // 🌟 THE FIX: Better, human-friendly text for the student!
        rejection_reason: payload.record 
          ? 'Order expired (not collected in 5 hours). Full refund issued.' 
          : 'Order was cancelled by admin. full refund issued.'
      })
      .eq('id', order_id)

    // Return success to the frontend or webhook!
    return new Response(JSON.stringify({ success: true, refund_id: razorpayData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Refund Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})