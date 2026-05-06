import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rate-limiter.ts"; // 🛡️ THE EDGE SHIELD IMPORT

// 🦅 ENTERPRISE SECURITY HEADERS ADDED
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",               // Prevents MIME-sniffing
  "X-Frame-Options": "DENY",                         // Prevents Clickjacking
  "Content-Security-Policy": "default-src 'none'",   // Blocks unauthorized scripts
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains" // Forces HTTPS
};

Deno.serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // =====================================================================
  // 🛡️ SECURITY PHASE 0: RATE LIMITING (THE EDGE SHIELD)
  // =====================================================================
  // Max 15 admin actions per 60 seconds per IP address
  const { allowed, ip } = checkRateLimit(req, 15, 60);
  if (!allowed) {
    console.warn(`[SECURITY ALERT] Admin Rate limit triggered for IP: ${ip}`);
    return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), { 
      status: 429, 
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } 
    });
  }
  // =====================================================================

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is super_admin
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check super_admin role
    const { data: roleData } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // === CREATE STAFF ACCOUNT ===
    if (action === "create") {
      const { email, password, full_name, role, campus_id } = body;

      if (!email || !password || !role || !campus_id) {
        return new Response(JSON.stringify({ error: "Missing required fields: email, password, role, campus_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!["admin", "kiosk"].includes(role)) {
        return new Response(JSON.stringify({ error: "Role must be 'admin' or 'kiosk'" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, campus_id },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update the auto-created role from 'student' to the requested role
      const { error: roleError } = await adminClient
        .from("user_roles")
        .update({ role })
        .eq("user_id", newUser.user.id)
        .eq("campus_id", campus_id);

      if (roleError) {
        console.error("Role update error:", roleError);
      }

      // Audit log
      await adminClient.from("audit_logs").insert({
        user_id: user.id,
        action: "staff_created",
        entity_type: "user",
        entity_id: newUser.user.id,
        new_values: { email, role, campus_id, full_name },
      });

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === UPDATE USER ROLE ===
    if (action === "update_role") {
      const { user_role_id, user_id: target_user_id, new_role, old_role } = body;

      if (!user_role_id || !new_role) {
        return new Response(JSON.stringify({ error: "Missing user_role_id or new_role" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!["student", "admin", "kiosk", "super_admin"].includes(new_role)) {
        return new Response(JSON.stringify({ error: "Invalid role" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await adminClient
        .from("user_roles")
        .update({ role: new_role })
        .eq("id", user_role_id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Audit log
      await adminClient.from("audit_logs").insert({
        user_id: user.id,
        action: "role_changed",
        entity_type: "user_role",
        entity_id: user_role_id,
        old_values: { role: old_role },
        new_values: { role: new_role },
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === DELETE USER ===
    if (action === "delete") {
      const { user_id: target_user_id } = body;

      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "Missing user_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent deleting self
      if (target_user_id === user.id) {
        return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete related records 
      // 🦅 COMMENTED OUT THE TRIPWIRES - WE NO LONGER USE ADMIN_PINS OR ADMIN_SESSIONS
      // await adminClient.from("admin_pins").delete().eq("user_id", target_user_id);
      // await adminClient.from("admin_sessions").delete().eq("user_id", target_user_id);
      
      await adminClient.from("user_roles").delete().eq("user_id", target_user_id);
      await adminClient.from("profiles").delete().eq("user_id", target_user_id);

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(target_user_id);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Audit log
      await adminClient.from("audit_logs").insert({
        user_id: user.id,
        action: "user_deleted",
        entity_type: "user",
        entity_id: target_user_id,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-staff error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});