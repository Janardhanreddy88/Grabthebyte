import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase server configuration is missing.");
}

const admin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    UUID_REGEX.test(value)
  );
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse(
        {
          success: false,
          error: "Only POST requests are allowed.",
        },
        405
      );
    }

    /*
     * Authentication intentionally removed for the buildathon demo.
     * The function is called directly by RecoveryDashboard.
     *
     * IMPORTANT:
     * Business-state validation below remains in place:
     * - valid recovery case
     * - required compliance escalation
     * - PENDING -> ACTIVE
     * - ACTIVE -> RESOLVED / REJECTED
     * - resolution reason required
     *
     * The function uses the service-role client server-side only.
     */

    let body: any;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Invalid JSON body.",
        },
        400
      );
    }

    const {
      log_id,
      operation,
      resolution_reason,
    } = body;

    if (!isUuid(log_id)) {
      return jsonResponse(
        {
          success: false,
          error: "Valid log_id is required.",
        },
        400
      );
    }

    if (
      operation !== "START_REVIEW" &&
      operation !== "RESOLVE" &&
      operation !== "REJECT"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "operation must be START_REVIEW, RESOLVE, or REJECT.",
        },
        400
      );
    }

    /*
     * -------------------------------------------------------
     * FETCH CURRENT ESCALATION
     * -------------------------------------------------------
     */

    const {
      data: log,
      error: fetchError,
    } = await admin
      .from("revenue_recovery_logs")
      .select(`
        id,
        order_id,
        escalation_status,
        escalated_at,
        reviewed_at,
        resolved_at,
        resolution_reason,
        policy_evaluation,
        decision,
        recovery_state,
        status
      `)
      .eq("id", log_id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!log) {
      return jsonResponse(
        {
          success: false,
          error: "Recovery case not found.",
        },
        404
      );
    }

    /*
     * Only actual compliance cases can enter
     * the manual-review lifecycle.
     */

    const compliance =
      log.policy_evaluation?.compliance_escalation;

    if (
      !compliance ||
      compliance.required !== true
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "This recovery case does not contain a required compliance escalation.",
        },
        409
      );
    }

    const currentStatus =
      String(
        log.escalation_status || "NONE"
      ).toUpperCase();

    /*
     * -------------------------------------------------------
     * START REVIEW
     * -------------------------------------------------------
     */

    if (operation === "START_REVIEW") {
      if (currentStatus !== "PENDING") {
        return jsonResponse(
          {
            success: false,
            error:
              `Case cannot be started from ${currentStatus}.`,
          },
          409
        );
      }

      const reviewedAt =
        new Date().toISOString();

      const updatedPolicy = {
        ...(log.policy_evaluation || {}),
        compliance_escalation: {
          ...(compliance || {}),
          status: "ACTIVE",
          reviewed_at: reviewedAt,
        },
      };

      const {
        data: updated,
        error: updateError,
      } = await admin
        .from("revenue_recovery_logs")
        .update({
          escalation_status: "ACTIVE",
          reviewed_at: reviewedAt,
          policy_evaluation: updatedPolicy,
          updated_at: reviewedAt,
        })
        .eq("id", log_id)
        .eq("escalation_status", "PENDING")
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return jsonResponse({
        success: true,
        operation,
        case: updated,
      });
    }

    /*
     * -------------------------------------------------------
     * RESOLVE / REJECT
     * -------------------------------------------------------
     */

    if (
      operation === "RESOLVE" ||
      operation === "REJECT"
    ) {
      if (currentStatus !== "ACTIVE") {
        return jsonResponse(
          {
            success: false,
            error:
              `Case must be ACTIVE before it can be ${operation === "RESOLVE" ? "resolved" : "rejected"}.`,
          },
          409
        );
      }

      const reason =
        typeof resolution_reason === "string"
          ? resolution_reason.trim().slice(0, 1000)
          : "";

      if (!reason) {
        return jsonResponse(
          {
            success: false,
            error:
              "A resolution reason is required.",
          },
          400
        );
      }

      const now =
        new Date().toISOString();

      const finalStatus =
        operation === "RESOLVE"
          ? "RESOLVED"
          : "REJECTED";

      const updatedPolicy = {
        ...(log.policy_evaluation || {}),
        compliance_escalation: {
          ...(compliance || {}),
          status: finalStatus,
          reviewed_at:
            log.reviewed_at || now,
          resolved_at: now,
          resolution_reason: reason,
        },
      };

      const {
        data: updated,
        error: updateError,
      } = await admin
        .from("revenue_recovery_logs")
        .update({
          escalation_status: finalStatus,
          reviewed_at:
            log.reviewed_at || now,
          resolved_at: now,
          resolution_reason: reason,
          policy_evaluation: updatedPolicy,
          updated_at: now,
        })
        .eq("id", log_id)
        .eq("escalation_status", "ACTIVE")
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return jsonResponse({
        success: true,
        operation,
        case: updated,
      });
    }

    return jsonResponse(
      {
        success: false,
        error: "Unsupported operation.",
      },
      400
    );

  } catch (error: any) {
    console.error(
      "Manual review escalation error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        error:
          error?.message ||
          "Manual review failed.",
      },
      500
    );
  }
});
