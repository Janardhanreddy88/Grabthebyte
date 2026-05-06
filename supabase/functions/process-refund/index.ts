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
    const order_id = payload.record?.id || payload.order_id

    if (!order_id) {
      throw new Error('Order ID is required')
    }

    // 1. Initialize Supabase client with Service Role 
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    // =====================================================================
    // 🛑 THE TITANIUM SHIELD: ROLE-BASED ACCESS CONTROL (RBAC)
    // =====================================================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized: Missing Authorization header')
    }

    const token = authHeader.replace('Bearer ', '').trim()
    let isAuthorized = false

    // Check 1: Is this the automated Supabase Database Webhook?
    if (token === serviceRoleKey) {
      isAuthorized = true
    } 
    // Check 2: Is this a human user? Verify they are an Admin.
    else {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
      
      if (authError || !user) {
        throw new Error('Unauthorized: Invalid or expired session')
      }

      const { data: roleData } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (roleData && ['admin', 'super_admin'].includes(roleData.role)) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Security Violation: Only Admins can trigger refunds.' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    // =====================================================================

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

    // 4. Call Razorpay Refund API
    const razorpayRes = await fetch(`https://api.razorpay.com/v1/payments/${order.razorpay_payment_id}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        speed: 'normal', 
        reverse_all: 1   
      })
    })

    const razorpayData = await razorpayRes.json()

    if (!razorpayRes.ok) {
      console.error('Razorpay Error:', razorpayData)
      throw new Error(razorpayData.error?.description || 'Failed to process refund with Razorpay')
    }

    // 5. Update the order status in Supabase
    await supabaseClient
      .from('orders')
      .update({ 
        status: 'refunded',
        rejection_reason: payload.record 
          ? 'Order expired (not collected in 5 hours). Full refund issued.' 
          : 'Order was cancelled by admin. Full refund issued.'
      })
      .eq('id', order_id)

    return new Response(JSON.stringify({ success: true, refund_id: razorpayData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Refund Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})