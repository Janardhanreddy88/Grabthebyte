import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify the user's JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user identity with anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // 2. Use service role client to delete user data and auth account
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Delete order items for user's orders
    const { data: userOrders } = await adminClient
      .from("orders")
      .select("id")
      .eq("user_id", userId);

    if (userOrders && userOrders.length > 0) {
      const orderIds = userOrders.map((o) => o.id);
      await adminClient.from("order_items").delete().in("order_id", orderIds);
      await adminClient.from("orders").delete().eq("user_id", userId);
    }

    // Delete related records
    // 🦅 TRIPWIRES DISABLED - WE NO LONGER USE THESE TABLES
    // await adminClient.from("admin_pins").delete().eq("user_id", userId);
    // await adminClient.from("admin_sessions").delete().eq("user_id", userId);
    
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("user_id", userId);

    // 3. Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete account. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-account error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});