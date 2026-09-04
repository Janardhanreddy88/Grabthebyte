import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-razorpay-signature, x-razorpay-event-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ==========================================================
// 🔐 CONSTANTS
// ==========================================================

const SUCCESS_EVENTS = new Set([
  "payment.captured",
  "order.paid",
  "payment_link.paid",
]);

const FAILURE_EVENTS = new Set([
  "payment.failed",
]);

const PARTIAL_EVENTS = new Set([
  "payment_link.partially_paid",
]);

// ==========================================================
// 🛡️ RAZORPAY SIGNATURE VERIFICATION
// ==========================================================

async function verifySignature(
  rawBody: string,
  signature: string,
  secretKey: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secretKey),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );

    const computedSignature = Array.from(
      new Uint8Array(signatureBytes)
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (computedSignature.length !== signature.length) {
      return false;
    }

    let result = 0;

    for (let i = 0; i < computedSignature.length; i++) {
      result |=
        computedSignature.charCodeAt(i) ^
        signature.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error(
      "[Webhook Security] Signature verification error:",
      error
    );

    return false;
  }
}

// ==========================================================
// 💰 INR AMOUNT HELPER
// ==========================================================

function rupeesToPaise(amount: number): number {
  return Math.round(Number(amount || 0) * 100);
}

// ==========================================================
// 📲 ONESIGNAL SETTLEMENT NOTIFICATION
// ==========================================================

async function sendSettlementNotification(
  campusId: string,
  amount: number
) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

  if (!appId || !restKey || !campusId) {
    console.log(
      "[OneSignal] Notification skipped - credentials/campus missing"
    );
    return;
  }

  try {
    const response = await fetch(
      "https://onesignal.com/api/v1/notifications",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${restKey}`,
        },
        body: JSON.stringify({
          app_id: appId,

          filters: [
            {
              field: "tag",
              key: "role",
              relation: "=",
              value: "admin",
            },
            {
              operator: "AND",
            },
            {
              field: "tag",
              key: "campus_id",
              relation: "=",
              value: campusId,
            },
          ],

          headings: {
            en: "💰 Settlement Processed!",
          },

          contents: {
            en: `₹${amount.toFixed(
              2
            )} has been deposited to your bank account.`,
          },
        }),
      }
    );

    if (!response.ok) {
      const responseText = await response.text();

      console.error(
        "[OneSignal] Failed:",
        response.status,
        responseText
      );
    }
  } catch (error) {
    console.error(
      "[OneSignal] Notification error:",
      error
    );
  }
}

// ==========================================================
// 🦅 AI REVENUE RECOVERY ENGINE
// ==========================================================

async function triggerRevenueRecovery(
  supabaseUrl: string,
  serviceKey: string,
  orderId: string,
  userId: string | null,
  campusId: string | null,
  amount: number,
  eventType: string,
  rawErrorCode: string | null,
  rawErrorMessage: string | null,
  failedPaymentMethod: string | null,
  retryCount: number
) {
  try {
    const recoveryResponse = await fetch(
      `${supabaseUrl}/functions/v1/revenue-recovery-webhook`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },

        body: JSON.stringify({
          order_id: orderId,
          user_id: userId,
          campus_id: campusId,
          amount: amount,
          event_type: eventType,
          raw_error_code: rawErrorCode,
          raw_error_message: rawErrorMessage,
          failed_payment_method: failedPaymentMethod,

          user_history: {
            retry_count: retryCount,
            payment_method: failedPaymentMethod,
            last_payment_method: failedPaymentMethod,
          },
        }),
      }
    );

    const responseText = await recoveryResponse.text();

    let recoveryData: unknown = null;

    try {
      recoveryData = JSON.parse(responseText);
    } catch {
      recoveryData = responseText;
    }

    if (!recoveryResponse.ok) {
      console.error(
        "[Revenue Recovery] Engine returned error:",
        recoveryResponse.status,
        recoveryData
      );

      return;
    }

    console.log(
      "[Revenue Recovery] AI engine completed:",
      JSON.stringify(recoveryData)
    );
  } catch (error) {
    console.error(
      "[Revenue Recovery] Engine trigger failed:",
      error
    );
  }
}

// ==========================================================
// 🧾 WEBHOOK SECURITY EVENT LOGGER
// ==========================================================

async function logSecurityEvent(
  supabase: any,
  reason: string,
  eventId: string | null = null
) {
  try {
    await supabase
      .from("payment_webhooks")
      .insert({
        event_type: "SECURITY_BREACH",

        razorpay_payment_id: null,

        razorpay_order_id: null,

        payload: {
          error: reason,
          event_id: eventId,
          recorded_at: new Date().toISOString(),
        },
      });
  } catch (error) {
    console.error(
      "[Security Log] Failed:",
      error
    );
  }
}

// ==========================================================
// 💰 UPDATE RECOVERY LOG + ACTION AFTER SUCCESSFUL PAYMENT
// ==========================================================

async function markRecoverySuccessful(
  supabase: any,
  actionId: string,
  actualRecoveredAmount: number,
  razorpayPaymentId: string | null,
  razorpayOrderId: string | null,
  razorpayEventId: string | null
) {
  // --------------------------------------------------------
  // Find recovery action
  // --------------------------------------------------------

  const {
    data: recoveryAction,
    error: recoveryActionLookupError,
  } = await supabase
    .from("revenue_recovery_actions")
    .select(`
      id,
      log_id,
      order_id,
      user_id,
      campus_id,
      status,
      expected_recovery_value,
      attempt_count
    `)
    .eq("id", actionId)
    .maybeSingle();

  if (recoveryActionLookupError) {
    console.error(
      "[Recovery] Action lookup failed:",
      recoveryActionLookupError
    );

    throw recoveryActionLookupError;
  }

  if (!recoveryAction) {
    console.error(
      `[Recovery] Action ${actionId} not found`
    );

    throw new Error(
      "Recovery action not found"
    );
  }

  if (!recoveryAction.log_id) {
    console.error(
      `[Recovery] Action ${actionId} has no log_id`
    );

    throw new Error(
      "Recovery action has no associated recovery log"
    );
  }

  // --------------------------------------------------------
  // Idempotency at action level
  // --------------------------------------------------------

  if (recoveryAction.status === "SUCCESS") {
    console.log(
      `[Recovery] Action ${actionId} already SUCCESS. ` +
      `Skipping duplicate recovery accounting.`
    );

    return {
      alreadyProcessed: true,
      actionId,
      logId: recoveryAction.log_id,
    };
  }

  // --------------------------------------------------------
  // Get current recovery log
  // --------------------------------------------------------

  const {
    data: recoveryLog,
    error: recoveryLogLookupError,
  } = await supabase
    .from("revenue_recovery_logs")
    .select(`
      id,
      recovered_amount,
      expected_recovery_value,
      intervention_cost,
      status,
      recovery_state,
      action_executed,
      attempt_count
    `)
    .eq("id", recoveryAction.log_id)
    .maybeSingle();

  if (recoveryLogLookupError) {
    console.error(
      "[Recovery] Log lookup failed:",
      recoveryLogLookupError
    );

    throw recoveryLogLookupError;
  }

  if (!recoveryLog) {
    console.error(
      `[Recovery] Log ${recoveryAction.log_id} not found`
    );

    throw new Error(
      "Recovery log not found"
    );
  }

  // --------------------------------------------------------
  // COUNT ACTUAL CUSTOMER PAYMENT ATTEMPT
  // --------------------------------------------------------
  // Original payment is attempt 0.
  // A successful recovery payment is one real customer attempt.
  const nextAttemptCount =
    Number(recoveryAction.attempt_count || 0) + 1;

  const { error: attemptActionUpdateError } = await supabase
    .from("revenue_recovery_actions")
    .update({ attempt_count: nextAttemptCount })
    .eq("id", actionId)
    .eq("status", recoveryAction.status);

  if (attemptActionUpdateError) {
    console.error(
      "[Recovery] Failed to record successful payment attempt on action:",
      attemptActionUpdateError
    );
    throw attemptActionUpdateError;
  }

  // --------------------------------------------------------
  // SYNC CUMULATIVE RECOVERY ATTEMPTS TO THE LOG
  // --------------------------------------------------------
  // Action attempt_count is per recovery action.
  // Log attempt_count is the cumulative number of actual
  // post-original customer payment attempts for this order.
  //
  // Example:
  // CARD action -> 1 attempt
  // UPI action  -> 1 attempt
  // Recovery log -> 2 total attempts
  // --------------------------------------------------------

  let cumulativeAttemptCount = nextAttemptCount;

  if (recoveryAction.order_id) {
    const {
      data: recoveryActions,
      error: recoveryActionsLookupError,
    } = await supabase
      .from("revenue_recovery_actions")
      .select("attempt_count")
      .eq("order_id", recoveryAction.order_id);

    if (recoveryActionsLookupError) {
      console.error(
        "[Recovery] Failed to calculate cumulative recovery attempts:",
        recoveryActionsLookupError
      );
      throw recoveryActionsLookupError;
    }

    cumulativeAttemptCount =
      (recoveryActions || []).reduce(
        (total: number, action: any) =>
          total + Number(action.attempt_count || 0),
        0
      );
  }

  const { error: attemptLogUpdateError } = await supabase
    .from("revenue_recovery_logs")
    .update({ attempt_count: cumulativeAttemptCount })
    .eq("id", recoveryAction.log_id);

  if (attemptLogUpdateError) {
    console.error(
      "[Recovery] Failed to record cumulative successful payment attempts on log:",
      attemptLogUpdateError
    );
    throw attemptLogUpdateError;
  }

  console.log(
    `[Recovery] Attempt counts synced. ` +
    `Action=${nextAttemptCount}, ` +
    `CumulativeOrderAttempts=${cumulativeAttemptCount}`
  );

  // --------------------------------------------------------
  // ACTUAL RECOVERED AMOUNT
  // --------------------------------------------------------

  const safeRecoveredAmount = Math.max(
    0,
    Number(actualRecoveredAmount || 0)
  );

  // --------------------------------------------------------
  // Audit trail
  // --------------------------------------------------------

  const previousActionExecuted =
    recoveryLog.action_executed &&
    typeof recoveryLog.action_executed === "object"
      ? recoveryLog.action_executed
      : {};

  const updatedActionExecuted = {
    ...previousActionExecuted,

    type: "RECOVERY_PAYMENT_CONFIRMED",

    recovery_action_id: actionId,

    razorpay_payment_id:
      razorpayPaymentId,

    razorpay_order_id:
      razorpayOrderId,

    razorpay_event_id:
      razorpayEventId,

    actual_recovered_amount:
      Number(
        safeRecoveredAmount.toFixed(2)
      ),

    confirmed_at:
      new Date().toISOString(),
  };

  // --------------------------------------------------------
  // UPDATE RECOVERY LOG
  //
  // IMPORTANT:
  // revenue_recovery_logs DOES NOT HAVE updated_at.
  // Therefore DO NOT send updated_at.
  // --------------------------------------------------------

  const {
    data: updatedLog,
    error: recoveryLogUpdateError,
  } = await supabase
    .from("revenue_recovery_logs")
    .update({
      recovered_amount:
        Number(
          safeRecoveredAmount.toFixed(2)
        ),

      status:
        "RECOVERED",

      recovery_state:
        "RECOVERED",

      action_executed:
        updatedActionExecuted,

      stop_reason:
        null,
    })
    .eq("id", recoveryAction.log_id)
    .neq("status", "RECOVERED")
    .select(`
      id,
      recovered_amount,
      status,
      recovery_state
    `)
    .maybeSingle();

  if (recoveryLogUpdateError) {
    console.error(
      "[Recovery] Failed to update recovery log:",
      recoveryLogUpdateError
    );

    throw recoveryLogUpdateError;
  }

  // --------------------------------------------------------
  // If another webhook already recovered this log
  // --------------------------------------------------------

  if (!updatedLog) {
    console.log(
      `[Recovery] Log ${recoveryAction.log_id} was already recovered.`
    );

    return {
      alreadyProcessed: true,
      actionId,
      logId: recoveryAction.log_id,
    };
  }

  // --------------------------------------------------------
  // MARK RECOVERY ACTION SUCCESS
  //
  // IMPORTANT:
  // revenue_recovery_actions DOES NOT HAVE updated_at.
  // Therefore DO NOT send updated_at.
  // --------------------------------------------------------

  const {
    data: updatedAction,
    error: recoveryActionUpdateError,
  } = await supabase
    .from("revenue_recovery_actions")
    .update({
      status:
        "SUCCESS",

      executed_at:
        new Date().toISOString(),
    })
    .eq("id", actionId)
    .eq("status", "AWAITING_PAYMENT")
    .select(`
      id,
      status,
      executed_at
    `)
    .maybeSingle();

  if (recoveryActionUpdateError) {
    console.error(
      "[Recovery] Failed to mark action SUCCESS:",
      recoveryActionUpdateError
    );

    throw recoveryActionUpdateError;
  }

  if (!updatedAction) {
    console.warn(
      `[Recovery] Action ${actionId} was not AWAITING_PAYMENT. ` +
      `Log was recovered, but action status was not changed.`
    );
  } else {
    console.log(
      `[Recovery] Action ${actionId} marked SUCCESS. ` +
      `Actual recovered amount = ₹${safeRecoveredAmount.toFixed(2)}`
    );
  }

  return {
    alreadyProcessed: false,
    actionId,
    logId: recoveryAction.log_id,
    recoveredAmount: safeRecoveredAmount,
  };
}

// ==========================================================
// 🚀 MAIN WEBHOOK HANDLER
// ==========================================================

Deno.serve(async (req) => {
  // ========================================================
  // CORS
  // ========================================================

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  // ========================================================
  // ENVIRONMENT
  // ========================================================

  try {
    const SUPABASE_URL =
      Deno.env.get("SUPABASE_URL");

    const SUPABASE_SECRET_KEY =
      Deno.env.get("SB_SECRET_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const RAZORPAY_WEBHOOK_SECRET =
      Deno.env.get("RAZORPAY_WEBHOOK_SECRET");

    if (
      !SUPABASE_URL ||
      !SUPABASE_SECRET_KEY ||
      !RAZORPAY_WEBHOOK_SECRET
    ) {
      console.error(
        "[Webhook] Required environment variables missing"
      );

      return new Response(
        JSON.stringify({
          success: false,
          message: "Server configuration error",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SECRET_KEY
    );

    // ======================================================
    // 🔐 READ RAW BODY
    // ======================================================

    const rawBody = await req.text();

    if (!rawBody) {
      await logSecurityEvent(
        supabase,
        "Empty webhook body"
      );

      return new Response(
        JSON.stringify({
          success: false,
          message: "Empty body",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ======================================================
    // 🔐 SIGNATURE
    // ======================================================

    const signature =
      req.headers.get("x-razorpay-signature");

    const razorpayEventId =
      req.headers.get("x-razorpay-event-id");

    if (!signature) {
      await logSecurityEvent(
        supabase,
        "Missing Razorpay signature",
        razorpayEventId
      );

      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing signature",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ======================================================
    // 🛡️ VERIFY SIGNATURE
    // ======================================================

    const validSignature =
      await verifySignature(
        rawBody,
        signature,
        RAZORPAY_WEBHOOK_SECRET
      );

    if (!validSignature) {
      console.error(
        "[Webhook Security] Invalid Razorpay signature"
      );

      await logSecurityEvent(
        supabase,
        "Invalid Razorpay signature",
        razorpayEventId
      );

      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid signature",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ======================================================
    // 📦 PARSE PAYLOAD
    // ======================================================

    let payload: any;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      await logSecurityEvent(
        supabase,
        "Invalid JSON payload",
        razorpayEventId
      );

      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid JSON",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const eventType =
      typeof payload.event === "string"
        ? payload.event
        : null;

    if (!eventType) {
      console.error(
        "[Webhook] Missing event type"
      );

      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing event type",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log(
      `[Webhook] Received event: ${eventType}`
    );

    // ======================================================
    // 🏢 LANE 1: SETTLEMENT
    // ======================================================

    if (eventType === "settlement.processed") {
      const settlementData =
        payload.payload?.settlement?.entity;

      if (!settlementData) {
        console.error(
          "[Settlement] Missing settlement entity"
        );

        return new Response(
          JSON.stringify({
            success: true,
            type: "settlement",
            message: "No settlement entity",
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const linkedAccountId =
        payload.account_id;

      const utr =
        settlementData.utr ?? null;

      const amountInINR =
        Number(
          settlementData.amount || 0
        ) / 100;

      if (!linkedAccountId) {
        console.error(
          "[Settlement] Missing account_id"
        );

        return new Response(
          JSON.stringify({
            success: true,
            type: "settlement",
            message: "Missing account ID",
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      // ----------------------------------------------------
      // Find campus
      // ----------------------------------------------------

      const {
        data: campus,
        error: campusError,
      } = await supabase
        .from("campuses")
        .select("id")
        .eq(
          "razorpay_account_id",
          linkedAccountId
        )
        .maybeSingle();

      if (campusError) {
        console.error(
          "[Settlement] Campus lookup failed:",
          campusError
        );
      }

      // ----------------------------------------------------
      // Prevent duplicate settlement by UTR
      // ----------------------------------------------------

      if (utr) {
        const {
          data: existingSettlement,
        } = await supabase
          .from("settlements")
          .select("id")
          .eq("utr_number", utr)
          .maybeSingle();

        if (existingSettlement) {
          console.log(
            `[Settlement] Duplicate UTR ignored: ${utr}`
          );

          return new Response(
            JSON.stringify({
              success: true,
              type: "settlement",
              message: "Settlement already processed",
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }
      }

      // ----------------------------------------------------
      // Insert settlement
      // ----------------------------------------------------

      const {
        error: settlementError,
      } = await supabase
        .from("settlements")
        .insert({
          campus_id:
            campus?.id || null,

          razorpay_account_id:
            linkedAccountId,

          amount:
            amountInINR,

          status:
            "SETTLED",

          utr_number:
            utr,

          settled_at:
            new Date().toISOString(),
        });

      if (settlementError) {
        console.error(
          "[Settlement] Insert failed:",
          settlementError
        );

        return new Response(
          JSON.stringify({
            success: false,
            type: "settlement",
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      if (campus?.id) {
        await sendSettlementNotification(
          campus.id,
          amountInINR
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: "settlement",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ======================================================
    // 🍕 LANE 2: ORDER PAYMENTS
    // ======================================================

    const paymentEntity =
      payload.payload?.payment?.entity;

    const paymentLinkEntity =
      payload.payload?.payment_link?.entity;

    const orderEntity =
      payload.payload?.order?.entity;

    // ------------------------------------------------------
    // Extract Razorpay IDs
    // ------------------------------------------------------

    const razorpayPaymentId =
      paymentEntity?.id ?? null;

    const razorpayOrderId =
      paymentEntity?.order_id ??
      orderEntity?.id ??
      paymentLinkEntity?.order_id ??
      null;

    // ------------------------------------------------------
    // Recovery action reference
    // ------------------------------------------------------

    let actionId =
      paymentLinkEntity?.reference_id ??
      null;

    // ------------------------------------------------------
    // RECOVERY payment.failed FALLBACK
    // ------------------------------------------------------
    // Razorpay payment.failed contains only the payment entity,
    // so payment_link.reference_id may be missing. Resolve the
    // Payment Link using the failed payment ID.
    if (
      eventType === "payment.failed" &&
      !actionId &&
      razorpayPaymentId
    ) {
      const razorpayKeyId =
        Deno.env.get("RAZORPAY_KEY_ID");

      const razorpayKeySecret =
        Deno.env.get("RAZORPAY_KEY_SECRET");

      if (
        razorpayKeyId &&
        razorpayKeySecret
      ) {
        try {
          const paymentLinksResponse =
            await fetch(
              `https://api.razorpay.com/v1/payment_links?payment_id=${encodeURIComponent(
                razorpayPaymentId
              )}`,
              {
                method: "GET",
                headers: {
                  Authorization:
                    `Basic ${btoa(
                      `${razorpayKeyId}:${razorpayKeySecret}`
                    )}`,
                },
              }
            );

          const paymentLinksData =
            await paymentLinksResponse.json();

          const matchedPaymentLink =
            Array.isArray(
              paymentLinksData?.payment_links
            )
              ? paymentLinksData.payment_links[0]
              : null;

          actionId =
            matchedPaymentLink?.reference_id ??
            null;

          console.log(
            "[Recovery] payment.failed Payment Link lookup:",
            JSON.stringify({
              paymentId: razorpayPaymentId,
              paymentLinkId:
                matchedPaymentLink?.id ?? null,
              referenceId:
                matchedPaymentLink?.reference_id ?? null,
              actionId,
              responseOk:
                paymentLinksResponse.ok,
            })
          );
        } catch (paymentLinkLookupError) {
          console.error(
            "[Recovery] Failed to resolve Payment Link from payment.failed:",
            paymentLinkLookupError
          );
        }
      } else {
        console.error(
          "[Recovery] Razorpay API credentials missing; cannot resolve Payment Link from payment.failed"
        );
      }
    }

    // ------------------------------------------------------
    // DEBUG: inspect IDs available on payment.failed
    // ------------------------------------------------------
    if (eventType === "payment.failed") {
      console.log(
        "[DEBUG payment.failed] IDs:",
        JSON.stringify({
          razorpayPaymentId,
          razorpayOrderId,
          actionId,
          paymentLinkId: paymentLinkEntity?.id ?? null,
          paymentLinkReferenceId:
            paymentLinkEntity?.reference_id ?? null,
          paymentEntityKeys:
            paymentEntity
              ? Object.keys(paymentEntity)
              : [],
        })
      );
    }

    // ======================================================
    // 🧱 BASIC EVENT VALIDATION
    // ======================================================

    if (
      SUCCESS_EVENTS.has(eventType) &&
      !razorpayPaymentId &&
      eventType !== "order.paid"
    ) {
      console.error(
        `[Webhook] ${eventType} missing payment ID`
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: "Missing payment ID",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ======================================================
    // 🔁 IDEMPOTENCY
    // ======================================================

    if (razorpayPaymentId) {
      const {
        data: existingWebhook,
        error: duplicateCheckError,
      } = await supabase
        .from("payment_webhooks")
        .select("id")
        .eq(
          "razorpay_payment_id",
          razorpayPaymentId
        )
        .eq(
          "event_type",
          eventType
        )
        .maybeSingle();

      if (duplicateCheckError) {
        console.error(
          "[Webhook] Duplicate check failed:",
          duplicateCheckError
        );
      }

      if (existingWebhook) {
        console.log(
          `[Webhook] Duplicate ignored: ${eventType}`
        );

        return new Response(
          JSON.stringify({
            success: true,
            message: "Already processed",
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // ======================================================
    // 📝 LOG VERIFIED WEBHOOK
    // ======================================================

    const {
      error: webhookLogError,
    } = await supabase
      .from("payment_webhooks")
      .insert({
        razorpay_order_id:
          razorpayOrderId,

        razorpay_payment_id:
          razorpayPaymentId,

        event_type:
          eventType,

        payload: {
          ...payload,

          _webhook_event_id:
            razorpayEventId,

          _received_at:
            new Date().toISOString(),
        },
      });

    if (webhookLogError) {
      console.error(
        "[Webhook] Failed to log webhook:",
        webhookLogError
      );
    }

    // ======================================================
    // 🔍 FIND GRABTHEBYTE ORDER
    // ======================================================

    let order: any = null;

    // ------------------------------------------------------
    // Payment Link Recovery Flow
    // ------------------------------------------------------

    if (eventType === "payment_link.paid") {
      if (!actionId) {
        console.error(
          "[Recovery] payment_link.paid missing reference_id"
        );

        return new Response(
          JSON.stringify({
            success: true,
            message:
              "Payment Link paid but recovery reference missing",
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const {
        data: action,
        error: actionError,
      } = await supabase
        .from("revenue_recovery_actions")
        .select(
          "id, order_id, status, log_id, user_id, campus_id, expected_recovery_value, attempt_count"
        )
        .eq("id", actionId)
        .maybeSingle();

      if (actionError) {
        console.error(
          "[Recovery] Action lookup failed:",
          actionError
        );
      }

      if (action?.order_id) {
        const {
          data: recoveredOrder,
          error: recoveredOrderError,
        } = await supabase
          .from("orders")
          .select(
            "id, status, payment_status, user_id, campus_id, total, razorpay_payment_id"
          )
          .eq("id", action.order_id)
          .maybeSingle();

        if (recoveredOrderError) {
          console.error(
            "[Recovery] Order lookup failed:",
            recoveredOrderError
          );
        }

        order = recoveredOrder;
      }
    }

    // ------------------------------------------------------
    // Normal Razorpay Order Flow
    // ------------------------------------------------------

    else if (razorpayOrderId) {
      const {
        data: normalOrder,
        error: normalOrderError,
      } = await supabase
        .from("orders")
        .select(
          "id, status, payment_status, user_id, campus_id, total, razorpay_payment_id"
        )
        .eq(
          "razorpay_order_id",
          razorpayOrderId
        )
        .maybeSingle();

      if (normalOrderError) {
        console.error(
          "[Order] Lookup failed:",
          normalOrderError
        );
      }

      order = normalOrder;
    }

    // ======================================================
    // 🔗 RECOVERY PAYMENT.FAILED ORDER MAPPING
    // ======================================================
    // A failed recovery Payment Link may not have a Razorpay
    // order_id that maps to GrabTheByte. Resolve it through
    // the recovery action reference instead.
    if (
      !order &&
      eventType === "payment.failed" &&
      actionId
    ) {
      const {
        data: recoveryActionForFailure,
        error: recoveryActionForFailureError,
      } = await supabase
        .from("revenue_recovery_actions")
        .select("id, order_id")
        .eq("id", actionId)
        .maybeSingle();

      if (recoveryActionForFailureError) {
        console.error(
          "[Recovery] Failed-payment action lookup failed:",
          recoveryActionForFailureError
        );
      }

      if (recoveryActionForFailure?.order_id) {
        const {
          data: recoveredOrderForFailure,
          error: recoveredOrderForFailureError,
        } = await supabase
          .from("orders")
          .select(
            "id, status, payment_status, user_id, campus_id, total, razorpay_payment_id"
          )
          .eq("id", recoveryActionForFailure.order_id)
          .maybeSingle();

        if (recoveredOrderForFailureError) {
          console.error(
            "[Recovery] Failed-payment order lookup failed:",
            recoveredOrderForFailureError
          );
        }

        order = recoveredOrderForFailure;
      }
    }

    // ======================================================
    // 🧩 NO MAPPED ORDER
    // ======================================================

    if (!order) {
      console.log(
        `[Webhook] No GrabTheByte order mapped. Event=${eventType}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          message:
            "No mapped GrabTheByte order; event ignored",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ======================================================
    // 💰 PAYMENT AMOUNT EXTRACTION
    // ======================================================

    const webhookPaymentAmountPaise =
      paymentEntity?.amount != null
        ? Number(paymentEntity.amount)
        : orderEntity?.amount != null
        ? Number(orderEntity.amount)
        : paymentLinkEntity?.amount_paid != null
        ? Number(paymentLinkEntity.amount_paid)
        : null;

    const orderAmountPaise =
      rupeesToPaise(
        Number(order.total || 0)
      );

    // ======================================================
    // 💰 AMOUNT SECURITY CHECK
    // ======================================================

    if (
      SUCCESS_EVENTS.has(eventType) &&
      eventType !== "payment_link.paid" &&
      webhookPaymentAmountPaise !== null
    ) {
      if (
        webhookPaymentAmountPaise !==
        orderAmountPaise
      ) {
        console.error(
          `[SECURITY] Amount mismatch for order ${order.id}. ` +
          `Expected=${orderAmountPaise}, ` +
          `Received=${webhookPaymentAmountPaise}`
        );

        await logSecurityEvent(
          supabase,
          `Payment amount mismatch for order ${order.id}`,
          razorpayEventId
        );

        return new Response(
          JSON.stringify({
            success: false,
            message:
              "Payment amount does not match order",
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // ======================================================
    // 🟡 PARTIAL PAYMENT
    // ======================================================

    if (
      eventType ===
      "payment_link.partially_paid"
    ) {
      const amountPaid =
        Number(
          paymentLinkEntity?.amount_paid || 0
        ) / 100;

      const amountDue =
        Number(
          paymentLinkEntity?.amount_due ??
            orderEntity?.amount_due ??
            Math.max(
              orderAmountPaise -
                Number(
                  paymentLinkEntity?.amount_paid ||
                    0
                ),
              0
            )
        ) / 100;

      console.log(
        `[Payment Link] Partial payment received. ` +
        `Order=${order.id}, ` +
        `Paid=₹${amountPaid}, ` +
        `Due=₹${amountDue}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          type: "partial_payment",
          message:
            "Partial payment received; order not completed",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ======================================================
    // 🔒 SUCCESS PAYMENT PROCESSING
    // ======================================================

    if (
      SUCCESS_EVENTS.has(eventType)
    ) {
      const paymentId =
        razorpayPaymentId;

      // ====================================================
      // 🦅 RECOVERY PAYMENT SUCCESS
      // ====================================================

      if (
        eventType ===
        "payment_link.paid"
      ) {
        if (!actionId) {
          console.error(
            "[Recovery] Successful payment link has no action ID"
          );

          return new Response(
            JSON.stringify({
              success: true,
              type: "payment_success",
              recovery: false,
              message:
                "Payment succeeded but recovery action reference missing",
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }

        // --------------------------------------------------
        // ACTUAL AMOUNT FROM RAZORPAY
        // --------------------------------------------------

        const actualRecoveredAmountPaise =
          paymentLinkEntity?.amount_paid != null
            ? Number(
                paymentLinkEntity.amount_paid
              )
            : paymentEntity?.amount != null
            ? Number(
                paymentEntity.amount
              )
            : null;

        if (
          actualRecoveredAmountPaise === null ||
          !Number.isFinite(
            actualRecoveredAmountPaise
          ) ||
          actualRecoveredAmountPaise <= 0
        ) {
          console.error(
            `[Recovery] Invalid recovered amount for action ${actionId}`
          );

          await logSecurityEvent(
            supabase,
            `Recovery payment ${actionId} succeeded without a valid amount`,
            razorpayEventId
          );

          return new Response(
            JSON.stringify({
              success: false,
              message:
                "Recovery payment amount missing or invalid",
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }

        const actualRecoveredAmount =
          actualRecoveredAmountPaise / 100;

        // --------------------------------------------------
        // MARK RECOVERY ACTION + LOG
        // --------------------------------------------------

        try {
          const recoveryResult =
            await markRecoverySuccessful(
              supabase,
              actionId,
              actualRecoveredAmount,
              paymentId,
              razorpayOrderId,
              razorpayEventId
            );

          console.log(
            "[Recovery] Recovery payment successfully accounted:",
            JSON.stringify(
              recoveryResult
            )
          );

          // --------------------------------------------------
          // REFRESH REVENUE RECOVERY BATCH TOTALS
          // --------------------------------------------------
          // The recovery log now contains the ACTUAL recovered
          // amount. Refresh the batch linked to this recovery case
          // so total_recovered_amount and recovery_rate stay current.
          if (recoveryResult?.logId) {
            const {
              data: batchCase,
              error: batchCaseLookupError,
            } = await supabase
              .from("revenue_recovery_batch_cases")
              .select("batch_id")
              .eq("log_id", recoveryResult.logId)
              .maybeSingle();

            if (batchCaseLookupError) {
              console.error(
                "[Recovery Batch] Batch case lookup failed:",
                batchCaseLookupError
              );
            } else if (batchCase?.batch_id) {
              const { error: batchRefreshError } =
                await supabase.rpc(
                  "refresh_revenue_recovery_batch",
                  {
                    p_batch_id: batchCase.batch_id,
                  }
                );

              if (batchRefreshError) {
                console.error(
                  "[Recovery Batch] Batch totals refresh failed:",
                  batchRefreshError
                );
              } else {
                console.log(
                  `[Recovery Batch] Batch ${batchCase.batch_id} refreshed after actual recovery.`
                );
              }
            } else {
              console.warn(
                `[Recovery Batch] No batch found for recovery log ${recoveryResult.logId}`
              );
            }
          }
        } catch (recoveryError) {
          console.error(
            "[Recovery] Failed to account recovery payment:",
            recoveryError
          );

          return new Response(
            JSON.stringify({
              success: false,
              message:
                "Recovery payment received but recovery accounting failed",
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }

        // ==================================================
        // COMPLETE ORIGINAL ORDER
        //
        // EXACT STATES REQUESTED:
        //
        // pending + pending
        // failed + failed
        // failed + not_confirmed
        //
        // → confirmed + completed
        // ==================================================

        const {
          data: updatedOrder,
          error: paymentUpdateError,
        } = await supabase
          .from("orders")
          .update({
            status:
              "confirmed",

            payment_status:
              "completed",

            razorpay_payment_id:
              paymentId ??
              order.razorpay_payment_id,

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", order.id)
          .or(
            "and(status.eq.pending,payment_status.eq.pending)," +
            "and(status.eq.failed,payment_status.eq.failed)," +
            "and(status.eq.failed,payment_status.eq.not_confirmed)"
          )
          .select(
            "id, status, payment_status, razorpay_payment_id"
          )
          .maybeSingle();

        if (paymentUpdateError) {
          console.error(
            "[Recovery] Order completion update failed:",
            paymentUpdateError
          );

          return new Response(
            JSON.stringify({
              success: false,
              message:
                "Recovery payment received and accounted, but order update failed",
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }

        if (updatedOrder) {
          console.log(
            `[Recovery] Order ${order.id} marked CONFIRMED + COMPLETED`
          );
        } else {
          console.log(
            `[Recovery] Order ${order.id} was already completed or did not match an allowed previous state`
          );
        }

        return new Response(
          JSON.stringify({
            success: true,

            type:
              "recovery_payment_success",

            recovery:
              true,

            action_id:
              actionId,

            order_id:
              order.id,

            recovered_amount:
              Number(
                actualRecoveredAmount.toFixed(2)
              ),
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      // ====================================================
      // NORMAL PAYMENT
      // ====================================================

      const {
        data: updatedOrder,
        error: paymentUpdateError,
      } = await supabase
        .from("orders")
        .update({
          status:
            "confirmed",

          payment_status:
            "completed",

          razorpay_payment_id:
            paymentId ??
            order.razorpay_payment_id,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", order.id)
        .or(
          "and(status.eq.pending,payment_status.eq.pending)," +
          "and(status.eq.failed,payment_status.eq.failed)," +
          "and(status.eq.failed,payment_status.eq.not_confirmed)"
        )
        .select(
          "id, status, payment_status, razorpay_payment_id"
        )
        .maybeSingle();

      if (paymentUpdateError) {
        console.error(
          "[Payment] Order update failed:",
          paymentUpdateError
        );

        return new Response(
          JSON.stringify({
            success: false,
            message:
              "Payment received but order update failed",
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      if (updatedOrder) {
        console.log(
          `[Payment] Order ${order.id} marked CONFIRMED + COMPLETED`
        );
      } else {
        console.log(
          `[Payment] Order ${order.id} was already completed or did not match an allowed previous state`
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: "payment_success",
          order_id: order.id,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ======================================================
    // ❌ FAILED PAYMENT PROCESSING
    // ======================================================

    if (
      FAILURE_EVENTS.has(eventType)
    ) {
      const failedPayment =
        payload.payload?.payment?.entity;

      const recoveryAmount =
        failedPayment?.amount
          ? Number(
              failedPayment.amount
            ) / 100
          : Number(
              order.total || 0
            );

      const rawErrorCode =
        failedPayment?.error_code ??
        null;

      const rawErrorMessage =
        failedPayment?.error_description ??
        null;

      // ----------------------------------------------------
      // IMPORTANT: preserve the ACTUAL failed payment method
      // from Razorpay so the recovery engine can choose an
      // alternative method instead of blindly defaulting to UPI.
      // ----------------------------------------------------
      const failedPaymentMethod =
        typeof failedPayment?.method === "string"
          ? failedPayment.method.toLowerCase().trim()
          : null;

      // ----------------------------------------------------
      // Update order to pending
      // ----------------------------------------------------

      const {
        error:
          orderFailureUpdateError,
      } = await supabase
        .from("orders")
        .update({
          status:
            "pending",

          payment_status:
            "pending",

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", order.id)
        .in(
          "payment_status",
          [
            "pending",
            "awaiting_payment",
            "failed",
          ]
        );

      if (
        orderFailureUpdateError
      ) {
        console.error(
          "[Payment Failed] Order update failed:",
          orderFailureUpdateError
        );
      }

      // ----------------------------------------------------
      // Calculate ACTUAL customer recovery attempts
      // ----------------------------------------------------
      // Recovery logs/actions are not payment attempts.
      // The original payment failure is attempt 0.
      // A payment.failed event tied to a recovery action is a real
      // post-original customer attempt and increments the count.
      let retryCount = 0;

      if (actionId) {
        const {
          data: recoveryAction,
          error: recoveryActionLookupError,
        } = await supabase
          .from("revenue_recovery_actions")
          .select(
            "id, order_id, log_id, status, attempt_count"
          )
          .eq("id", actionId)
          .eq("order_id", order.id)
          .maybeSingle();

        if (recoveryActionLookupError) {
          console.error(
            "[Recovery] Recovery action lookup failed while recording failed attempt:",
            recoveryActionLookupError
          );
        } else if (recoveryAction) {
          const nextAttemptCount =
            Number(recoveryAction.attempt_count || 0) + 1;

          const { error: attemptActionUpdateError } =
            await supabase
              .from("revenue_recovery_actions")
              .update({
                attempt_count: nextAttemptCount,
              })
              .eq("id", recoveryAction.id)
              .eq("order_id", order.id);

          if (attemptActionUpdateError) {
            console.error(
              "[Recovery] Failed to record failed payment attempt on action:",
              attemptActionUpdateError
            );
          } else {
            retryCount = nextAttemptCount;

            // --------------------------------------------------
            // CLOSE THE CURRENT RECOVERY ACTION AFTER A REAL
            // CUSTOMER PAYMENT FAILURE.
            //
            // The failed action is historical. The next recovery
            // action created by the recovery engine becomes the
            // only active action for this order.
            // --------------------------------------------------
            const { error: failedActionStatusError } =
              await supabase
                .from("revenue_recovery_actions")
                .update({
                  status: "FAILED",
                  executed_at: new Date().toISOString(),
                })
                .eq("id", recoveryAction.id)
                .eq("order_id", order.id)
                .eq("status", "AWAITING_PAYMENT");

            if (failedActionStatusError) {
              console.error(
                "[Recovery] Failed to close recovery action after failed payment:",
                failedActionStatusError
              );
            } else {
              console.log(
                `[Recovery] Recovery action ${recoveryAction.id} marked FAILED after customer payment attempt #${nextAttemptCount}.`
              );
            }

            if (recoveryAction.log_id) {
              const { error: attemptLogUpdateError } =
                await supabase
                  .from("revenue_recovery_logs")
                  .update({
                    attempt_count: nextAttemptCount,
                  })
                  .eq("id", recoveryAction.log_id);

              if (attemptLogUpdateError) {
                console.error(
                  "[Recovery] Failed to sync failed payment attempt to recovery log:",
                  attemptLogUpdateError
                );
              }
            }
          }
        }
      }
      // ----------------------------------------------------
      // AI Revenue Recovery
      // ----------------------------------------------------

      console.log(
        `[Revenue Recovery] Triggering AI analysis. ` +
        `Order=${order.id}, ` +
        `Amount=₹${recoveryAmount}, ` +
        `RetryCount=${retryCount}, ` +
        `FailedMethod=${failedPaymentMethod || "unknown"}, ` +
        `Error=${rawErrorCode || "unknown"}`
      );

      await triggerRevenueRecovery(
        SUPABASE_URL,
        SUPABASE_SECRET_KEY,
        order.id,
        order.user_id ||
          null,
        order.campus_id ||
          null,
        recoveryAmount,
        eventType,
        rawErrorCode,
        rawErrorMessage,
        failedPaymentMethod,
        retryCount
      );

      return new Response(
        JSON.stringify({
          success: true,
          type:
            "payment_failed",
          recovery_triggered:
            true,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    // ======================================================
    // ℹ️ OTHER EVENTS
    // ======================================================

    console.log(
      `[Webhook] Event ${eventType} acknowledged but no action required`
    );

    return new Response(
      JSON.stringify({
        success: true,
        type:
          "ignored_event",
        event:
          eventType,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error: any) {
    // ======================================================
    // 🚨 GLOBAL ERROR
    // ======================================================

    console.error(
      "[Webhook] Critical error:",
      error?.message ||
        error
    );

    return new Response(
      JSON.stringify({
        success: false,
        message:
          "Webhook processing failed",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});