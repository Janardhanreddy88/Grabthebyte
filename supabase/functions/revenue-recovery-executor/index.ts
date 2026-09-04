import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =========================================================
// ENVIRONMENT / SECRETS
// =========================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const RAZORPAY_KEY_ID =
  Deno.env.get("RAZORPAY_KEY_ID");

const RAZORPAY_KEY_SECRET =
  Deno.env.get("RAZORPAY_KEY_SECRET");

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !RAZORPAY_KEY_ID ||
  !RAZORPAY_KEY_SECRET
) {
  throw new Error(
    "Required production secrets are not configured."
  );
}

// =========================================================
// SUPABASE ADMIN CLIENT
// =========================================================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// =========================================================
// RESPONSE HEADERS
// =========================================================

const jsonHeaders = {
  "Content-Type": "application/json",
};

// =========================================================
// RESPONSE HELPER
// =========================================================

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: jsonHeaders,
    }
  );
}

// =========================================================
// RAZORPAY AUTHENTICATION
// =========================================================

function razorpayAuthorizationHeader(): string {
  const credentials =
    `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`;

  return `Basic ${btoa(credentials)}`;
}

// =========================================================
// SEND REVENUE RECOVERY EMAIL
// =========================================================
//
// The actual email logic is handled by:
//
// revenue-recovery-email
//
// We only pass action_id.
//
// IMPORTANT:
//
// The recovery action MUST already be in
// AWAITING_PAYMENT state before this function is called.
//
// The email function independently:
//   - fetches the recovery action
//   - fetches the original order
//   - verifies the order is unpaid
//   - gets the authoritative customer email
//   - gets the Razorpay payment link
//   - sends the Hostinger SMTP email
//
// Email failure must NOT cause the already-created
// financial recovery Payment Link to become FAILED.
// =========================================================

async function sendRecoveryEmail(
  actionId: string
) {
  const functionUrl =
    `${SUPABASE_URL}/functions/v1/revenue-recovery-email`;

  try {
    const response = await fetch(
      functionUrl,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          // -------------------------------------------------
          // Internal authentication.
          //
          // revenue-recovery-email accepts the service-role
          // key as an internal key.
          //
          // This key NEVER reaches the frontend.
          // -------------------------------------------------

          "apikey":
            SUPABASE_SERVICE_ROLE_KEY,

          "Authorization":
            `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },

        body: JSON.stringify({
          action_id:
            actionId,
        }),
      }
    );

    const responseText =
      await response.text();

    let data: any;

    try {
      data =
        JSON.parse(responseText);
    } catch {
      data = {
        raw:
          responseText,
      };
    }

    if (!response.ok) {
      console.error(
        "[Email] revenue-recovery-email failed:",
        {
          status:
            response.status,

          response:
            data,

          action_id:
            actionId,
        }
      );

      return {
        success:
          false,

        status:
          response.status,

        error:
          data?.error ||
          "Revenue recovery email function failed.",

        action_id:
          actionId,
      };
    }

    console.log(
      "[Email] revenue-recovery-email completed:",
      {
        action_id:
          actionId,

        result:
          data,
      }
    );

    return {
      success:
        data?.success === true,

      status:
        response.status,

      already_sent:
        data?.already_sent === true,

      recipient:
        data?.recipient ||
        null,

      message:
        data?.message ||
        null,

      error:
        data?.error ||
        null,

      action_id:
        actionId,
    };

  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown email function error.";

    console.error(
      "[Email] Unable to invoke revenue-recovery-email:",
      {
        action_id:
          actionId,

        error:
          errorMessage,
      }
    );

    // -------------------------------------------------------
    // IMPORTANT:
    //
    // Do NOT throw here.
    //
    // The Razorpay Payment Link has already been created and
    // the recovery action has already moved to
    // AWAITING_PAYMENT.
    //
    // Email delivery is auxiliary and must not roll back
    // or fail the financial recovery action.
    // -------------------------------------------------------

    return {
      success:
        false,

      status:
        0,

      already_sent:
        false,

      recipient:
        null,

      message:
        null,

      error:
        errorMessage,

      action_id:
        actionId,
    };
  }
}

// =========================================================
// FIND EXISTING PAYMENT LINK
// =========================================================
//
// Uses the recovery action UUID as reference_id.
//
// IMPORTANT SECURITY RULE:
//
// If an existing Payment Link is found, it is reused ONLY when
// the Payment Link itself confirms the same Razorpay Linked
// Account that belongs to the order's campus.
//
// This prevents an old/wrong Payment Link from being reused.
// =========================================================

async function findExistingPaymentLink(
  referenceId: string,
  expectedRazorpayAccountId: string
) {
  const url =
    `https://api.razorpay.com/v1/payment_links/?reference_id=${encodeURIComponent(
      referenceId
    )}`;

  const response = await fetch(
    url,
    {
      method: "GET",

      headers: {
        "Content-Type":
          "application/json",

        "Authorization":
          razorpayAuthorizationHeader(),
      },
    }
  );

  const responseText =
    await response.text();

  let data: any;

  try {
    data =
      JSON.parse(responseText);
  } catch {
    data = {
      raw:
        responseText,
    };
  }

  if (!response.ok) {
    throw new Error(
      `Razorpay payment-link lookup failed (${response.status}): ${JSON.stringify(
        data
      )}`
    );
  }

  if (
    Array.isArray(data?.payment_links) &&
    data.payment_links.length > 0
  ) {
    const existingLink =
      data.payment_links[0];

    // -------------------------------------------------------
    // CRITICAL VENDOR SAFETY CHECK
    // -------------------------------------------------------

    const existingAccountId =
      existingLink?.notes?.razorpay_account_id;

    if (
      existingAccountId !==
      expectedRazorpayAccountId
    ) {
      throw new Error(
        `Existing Razorpay Payment Link belongs to a different or unknown Linked Account. Expected ${expectedRazorpayAccountId}, received ${existingAccountId || "missing"}. Refusing to reuse the Payment Link.`
      );
    }

    return existingLink;
  }

  return null;
}

// =========================================================
// CREATE RAZORPAY MULTI-METHOD PAYMENT LINK
// =========================================================
//
// The AI/webhook selects one bounded recovery intervention:
//
//   RETRY_WITH_UPI
//   RETRY_WITH_CARD
//   RETRY_WITH_NETBANKING
//   RETRY_WITH_WALLET
//
// Razorpay Standard Payment Links support these payment methods.
// We create a STANDARD Payment Link and configure Checkout so the
// selected recovery method is the displayed/available method.
//
// This is intentionally different from `upi_link: true`:
// `upi_link: true` creates a UPI-only Payment Link. For the other
// recovery methods we need the Standard Payment Link API.
// =========================================================

type RecoveryPaymentMethod =
  "upi" |
  "card" |
  "netbanking" |
  "wallet";

function getRecoveryPaymentMethod(
  actionType: string
): RecoveryPaymentMethod {
  switch (actionType) {
    case "RETRY_WITH_UPI":
      return "upi";

    case "RETRY_WITH_CARD":
      return "card";

    case "RETRY_WITH_NETBANKING":
      return "netbanking";

    case "RETRY_WITH_WALLET":
      return "wallet";

    default:
      throw new Error(
        `Unsupported recovery action type: ${actionType}.`
      );
  }
}

async function createRecoveryPaymentLink(params: {
  amountInPaise: number;
  foodAmountInPaise: number;
  referenceId: string;
  description: string;
  razorpayAccountId: string;
  campusId: string;
  actionType: string;
}) {
  const nowSeconds =
    Math.floor(Date.now() / 1000);

  // Recovery link expires after 30 minutes.
  const expireBy =
    nowSeconds + 30 * 60;

  // -------------------------------------------------------
  // CRITICAL TRANSFER SAFETY CHECK
  // -------------------------------------------------------

  if (
    params.foodAmountInPaise <= 0
  ) {
    throw new Error(
      "Food amount for vendor transfer must be greater than zero."
    );
  }

  if (
    params.foodAmountInPaise >
    params.amountInPaise
  ) {
    throw new Error(
      "Vendor transfer amount cannot exceed the customer payment amount."
    );
  }

  const paymentMethod =
    getRecoveryPaymentMethod(
      params.actionType
    );

  const response = await fetch(
    "https://api.razorpay.com/v1/payment_links",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "Authorization":
          razorpayAuthorizationHeader(),
      },

      body: JSON.stringify({
        // ===================================================
        // CUSTOMER PAYS FULL ORDER TOTAL
        // ===================================================

        // IMPORTANT:
        // Do NOT set upi_link=true here. That would force the
        // Razorpay UPI Payment Link flow for every intervention.
        // Omitting it creates a Standard Payment Link.

        amount:
          params.amountInPaise,

        currency:
          "INR",

        accept_partial:
          false,

        expire_by:
          expireBy,

        reference_id:
          params.referenceId,

        description:
          params.description,

        reminder_enable:
          false,

        // ===================================================
        // CHECKOUT METHOD SELECTION
        // ===================================================
        //
        // Razorpay supports configuring which payment methods
        // are displayed on a Payment Link checkout. We expose
        // only the AI-selected recovery method for this bounded
        // intervention.

        options: {
          checkout: {
            config: {
              display: {
                blocks: {
                  recovery_method: {
                    name:
                      `Recommended recovery: ${paymentMethod.toUpperCase()}`,

                    instruments: [
                      {
                        method:
                          paymentMethod,
                      },
                    ],
                  },
                },

                sequence: [
                  "block.recovery_method",
                ],

                preferences: {
                  show_default_blocks:
                    false,
                },
              },
            },
          },

          // =================================================
          // RAZORPAY ROUTE VENDOR TRANSFER
          // =================================================

          order: {
            transfers: [
              {
                account:
                  params.razorpayAccountId,

                amount:
                  params.foodAmountInPaise,

                currency:
                  "INR",

                notes: {
                  campus_id:
                    params.campusId,

                  recovery_action_id:
                    params.referenceId,

                  transfer_type:
                    "FOOD_AMOUNT_ONLY",

                  source:
                    "grabthebyte_revenue_recovery",
                },

                linked_account_notes: [
                  "campus_id",
                  "recovery_action_id",
                  "transfer_type",
                  "source",
                ],
              },
            ],
          },
        },

        // ===================================================
        // RECONCILIATION / AUDIT NOTES
        // ===================================================

        notes: {
          source:
            "grabthebyte_revenue_recovery",

          recovery_action_id:
            params.referenceId,

          campus_id:
            params.campusId,

          razorpay_account_id:
            params.razorpayAccountId,

          transfer_type:
            "FOOD_AMOUNT_ONLY",

          recovery_action_type:
            params.actionType,

          recovery_payment_method:
            paymentMethod,
        },
      }),
    }
  );

  const responseText =
    await response.text();

  let data: any;

  try {
    data =
      JSON.parse(responseText);
  } catch {
    data = {
      raw:
        responseText,
    };
  }

  if (!response.ok) {
    throw new Error(
      `Razorpay Payment Link creation failed (${response.status}): ${JSON.stringify(
        data
      )}`
    );
  }

  return data;
}

// =========================================================
// MARK ACTION FAILED
// =========================================================
//
// Only changes PROCESSING -> FAILED.
//
// This prevents an already SUCCESS/AWAITING_PAYMENT action
// from accidentally being overwritten.
// =========================================================

async function markActionFailed(
  actionId: string,
  logId: string | null,
  errorResult: Record<string, unknown>
) {
  const now =
    new Date().toISOString();

  const {
    error: actionUpdateError,
  } = await supabase
    .from("revenue_recovery_actions")
    .update({
      status:
        "FAILED",

      executed_at:
        now,

      result:
        errorResult,
    })
    .eq(
      "id",
      actionId
    )
    .eq(
      "status",
      "PROCESSING"
    );

  if (actionUpdateError) {
    console.error(
      "Failed to mark recovery action as FAILED:",
      actionUpdateError
    );
  }

  if (logId) {
    const {
      error: logUpdateError,
    } = await supabase
      .from("revenue_recovery_logs")
      .update({
        action_executed: {
          type:
            "INTERVENTION_FAILED",

          action_id:
            actionId,

          execution:
            errorResult,
        },

        status:
          "FAILED",

        updated_at:
          now,
      })
      .eq(
        "id",
        logId
      );

    if (logUpdateError) {
      console.error(
        "Failed to update recovery audit log:",
        logUpdateError
      );
    }
  }
}

// =========================================================
// MAIN EDGE FUNCTION
// =========================================================

serve(async (req) => {
  // Keep track of the action that has been atomically claimed.
  //
  // If something fails after PROCESSING begins, the outer
  // catch block can safely move that action to FAILED.

  let claimedActionForFailure: any = null;

  try {
    // =======================================================
    // BUILDATHON MODE: NO FUNCTION-LEVEL AUTHENTICATION
    // =======================================================
    //
    // This executor is intentionally callable directly by the
    // buildathon dashboard. Do NOT use this configuration for a
    // production financial endpoint.
    //
    // Razorpay credentials and the Supabase service-role key
    // remain server-side and are never returned to the client.
    // =======================================================

    // =======================================================
    // 0. METHOD CHECK
    // =======================================================

    if (req.method !== "POST") {
      return jsonResponse(
        {
          success:
            false,

          error:
            "Only POST requests are allowed.",
        },
        405
      );
    }

    // =======================================================
    // 1. PARSE REQUEST BODY
    // =======================================================

    let body: any;

    try {
      body =
        await req.json();
    } catch {
      return jsonResponse(
        {
          success:
            false,

          error:
            "Request body must be valid JSON.",
        },
        400
      );
    }

    const actionId =
      body?.action_id;

    // UUID format validation.
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      typeof actionId !== "string" ||
      !uuidRegex.test(actionId)
    ) {
      return jsonResponse(
        {
          success:
            false,

          error:
            "Valid action_id UUID is required.",
        },
        400
      );
    }

    // =======================================================
    // 2. FETCH RECOVERY ACTION
    // =======================================================

    const {
      data: action,
      error: fetchError,
    } = await supabase
      .from("revenue_recovery_actions")
      .select("*")
      .eq(
        "id",
        actionId
      )
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!action) {
      return jsonResponse(
        {
          success:
            false,

          error:
            "Recovery action not found.",
        },
        404
      );
    }

    // =======================================================
    // 3. STATE PROTECTION
    // =======================================================

    // -------------------------------------------------------
    // SUCCESS
    // -------------------------------------------------------

    if (
      action.status ===
      "SUCCESS"
    ) {
      return jsonResponse(
        {
          success:
            true,

          action_id:
            action.id,

          status:
            "SUCCESS",

          message:
            "Recovery action already completed.",
        }
      );
    }

    // -------------------------------------------------------
    // AWAITING PAYMENT
    // -------------------------------------------------------

    if (
      action.status ===
      "AWAITING_PAYMENT"
    ) {
      return jsonResponse(
        {
          success:
            true,

          action_id:
            action.id,

          status:
            "AWAITING_PAYMENT",

          payment_link_id:
            action.razorpay_payment_link_id,

          payment_link_url:
            action.razorpay_payment_link_url,

          message:
            "Recovery payment link already active. Awaiting payment.",
        }
      );
    }

    // -------------------------------------------------------
    // PROCESSING
    // -------------------------------------------------------

    if (
      action.status ===
      "PROCESSING"
    ) {
      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          status:
            "PROCESSING",

          message:
            "Action is already being processed.",
        },
        409
      );
    }

    // -------------------------------------------------------
    // OTHER TERMINAL STATES
    // -------------------------------------------------------

    if (
      action.status !==
      "PENDING"
    ) {
      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          status:
            action.status,

          message:
            "Action cannot be executed from its current state.",
        },
        409
      );
    }

    // =======================================================
    // 4. VERIFY ACTION TYPE
    // =======================================================

    const supportedActionTypes = [
      "RETRY_WITH_UPI",
      "RETRY_WITH_CARD",
      "RETRY_WITH_NETBANKING",
      "RETRY_WITH_WALLET",
    ];

    if (
      !supportedActionTypes.includes(
        action.action_type
      )
    ) {
      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Unsupported recovery action type. Supported methods: RETRY_WITH_UPI, RETRY_WITH_CARD, RETRY_WITH_NETBANKING, RETRY_WITH_WALLET.",
        },
        400
      );
    }

    const selectedPaymentMethod =
      getRecoveryPaymentMethod(
        action.action_type
      );

    // =======================================================
    // 5. VERIFY ORDER ID
    // =======================================================

    if (!action.order_id) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Recovery action has no order_id.",
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Recovery action has no order_id.",
        },
        400
      );
    }

    // =======================================================
    // 6. FETCH ORIGINAL ORDER
    // =======================================================

    const {
      data: order,
      error: orderError,
    } = await supabase
      .from("orders")
      .select(
        "id,total,platform_fee,canteen_revenue,status,payment_status,user_id,campus_id,razorpay_order_id"
      )
      .eq(
        "id",
        action.order_id
      )
      .maybeSingle();

    if (orderError) {
      throw orderError;
    }

    if (!order) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Original order not found.",
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Original order not found.",
        },
        404
      );
    }

    // =======================================================
    // 6A. VERIFY CAMPUS / VENDOR RELATIONSHIP
    // =======================================================

    if (!order.campus_id) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Original order has no campus_id. Vendor routing cannot be determined safely.",
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Original order has no campus_id. Vendor routing cannot be determined safely.",
        },
        400
      );
    }

    // -------------------------------------------------------
    // Optional consistency check.
    // -------------------------------------------------------

    if (
      action.campus_id &&
      action.campus_id !== order.campus_id
    ) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Recovery action campus_id does not match the original order campus_id.",
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Recovery action campus_id does not match the original order campus_id.",
        },
        409
      );
    }

    // -------------------------------------------------------
    // Fetch authoritative Razorpay Linked Account.
    // -------------------------------------------------------

    const {
      data: campus,
      error: campusError,
    } = await supabase
      .from("campuses")
      .select(
        "id,name,razorpay_account_id"
      )
      .eq(
        "id",
        order.campus_id
      )
      .maybeSingle();

    if (campusError) {
      throw campusError;
    }

    if (!campus) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Campus linked to the original order was not found.",
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Campus linked to the original order was not found.",
        },
        404
      );
    }

    const razorpayAccountId =
      campus.razorpay_account_id;

    // -------------------------------------------------------
    // Razorpay Route Linked Account IDs.
    // -------------------------------------------------------

    if (
      typeof razorpayAccountId !== "string" ||
      razorpayAccountId.trim() === ""
    ) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            `Campus ${campus.id} does not have a configured Razorpay Linked Account.`,
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "This campus does not have a configured Razorpay Linked Account.",
        },
        400
      );
    }

    if (
      !razorpayAccountId.startsWith("acc_")
    ) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            `Invalid Razorpay Linked Account ID configured for campus ${campus.id}.`,
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Invalid Razorpay Linked Account ID configured for this campus.",
        },
        400
      );
    }

    console.log(
      `[Vendor Routing] Order ${order.id} belongs to campus ${campus.id} (${campus.name}).`
    );

    console.log(
      `[Vendor Routing] Razorpay Linked Account: ${razorpayAccountId}`
    );

    // =======================================================
    // 7. CRITICAL MONEY SAFETY CHECK
    // =======================================================

    const orderAmount =
      Number(order.total);

    if (
      !Number.isFinite(orderAmount) ||
      orderAmount <= 0
    ) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Original order has an invalid amount.",
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Original order has an invalid amount.",
        },
        400
      );
    }

    // -------------------------------------------------------
    // Platform fee
    // -------------------------------------------------------

    const platformFee =
      Number(order.platform_fee ?? 0);

    if (
      !Number.isFinite(platformFee) ||
      platformFee < 0
    ) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Original order has an invalid platform_fee.",
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Original order has an invalid platform_fee.",
        },
        400
      );
    }

    // -------------------------------------------------------
    // Use database-generated canteen_revenue.
    // -------------------------------------------------------

    const foodAmount =
      Number(order.canteen_revenue);

    if (
      !Number.isFinite(foodAmount) ||
      foodAmount < 0
    ) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Original order has an invalid canteen_revenue value.",
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Original order has an invalid canteen_revenue value.",
        },
        400
      );
    }

    // -------------------------------------------------------
    // Independent reconciliation check.
    // -------------------------------------------------------

    const expectedFoodAmount =
      orderAmount - platformFee;

    const moneyTolerance =
      0.01;

    if (
      Math.abs(
        foodAmount - expectedFoodAmount
      ) > moneyTolerance
    ) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Order canteen_revenue does not reconcile with total minus platform_fee.",

          order_total:
            orderAmount,

          platform_fee:
            platformFee,

          canteen_revenue:
            foodAmount,

          expected_canteen_revenue:
            expectedFoodAmount,
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Order revenue values failed reconciliation.",
        },
        409
      );
    }

    // -------------------------------------------------------
    // Convert INR -> paise once.
    // -------------------------------------------------------

    const amountInPaise =
      Math.round(
        orderAmount * 100
      );

    const foodAmountInPaise =
      Math.round(
        foodAmount * 100
      );

    const platformFeeInPaise =
      Math.round(
        platformFee * 100
      );

    // -------------------------------------------------------
    // Final money reconciliation in paise.
    // -------------------------------------------------------

    if (
      amountInPaise !==
      foodAmountInPaise +
      platformFeeInPaise
    ) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Order amount does not reconcile with food amount plus platform fee.",

          amount_in_paise:
            amountInPaise,

          food_amount_in_paise:
            foodAmountInPaise,

          platform_fee_in_paise:
            platformFeeInPaise,
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Order amount reconciliation failed.",
        },
        409
      );
    }

    // -------------------------------------------------------
    // Razorpay minimum amount.
    // -------------------------------------------------------

    if (
      amountInPaise < 100
    ) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Recovery amount is below Razorpay's minimum amount.",
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Recovery amount is below Razorpay's minimum amount.",
        },
        400
      );
    }

    // -------------------------------------------------------
    // Vendor transfer must be positive.
    // -------------------------------------------------------

    if (
      foodAmountInPaise <= 0
    ) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Food amount is zero or negative. Vendor transfer cannot be created.",
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Food amount is zero or negative. Vendor transfer cannot be created.",
        },
        400
      );
    }

    // -------------------------------------------------------
    // Vendor transfer cannot exceed customer payment.
    // -------------------------------------------------------

    if (
      foodAmountInPaise >
      amountInPaise
    ) {
      await markActionFailed(
        action.id,
        action.log_id,
        {
          success:
            false,

          error:
            "Vendor transfer amount exceeds customer payment amount.",
        }
      );

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          error:
            "Vendor transfer amount exceeds customer payment amount.",
        },
        409
      );
    }

    // =======================================================
    // 8. CHECK WHETHER ORIGINAL ORDER IS ALREADY PAID
    // =======================================================

    if (
      order.payment_status ===
        "completed" ||
      order.status ===
        "confirmed" ||
      order.status ===
        "collected"
    ) {
      const cancelResult = {
        success:
          false,

        reason:
          "Original order is already paid.",

        order_id:
          order.id,
      };

      const {
        error: cancelError,
      } = await supabase
        .from("revenue_recovery_actions")
        .update({
          status:
            "CANCELLED",

          executed_at:
            new Date().toISOString(),

          result:
            cancelResult,
        })
        .eq(
          "id",
          action.id
        )
        .eq(
          "status",
          "PENDING"
        );

      if (cancelError) {
        throw cancelError;
      }

      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          status:
            "CANCELLED",

          message:
            "Original order is already paid. Recovery action cancelled.",
        }
      );
    }

    // =======================================================
    // 9. ATOMICALLY CLAIM ACTION
    // =======================================================
    //
    // PENDING -> PROCESSING
    //
    // The WHERE status = PENDING condition prevents two
    // workers from processing the same recovery action.
    // =======================================================

    const {
      data: claimedAction,
      error: claimError,
    } = await supabase
      .from("revenue_recovery_actions")
      .update({
        status:
          "PROCESSING",

        executed_at:
          null,
      })
      .eq(
        "id",
        action.id
      )
      .eq(
        "status",
        "PENDING"
      )
      .select()
      .maybeSingle();

    if (claimError) {
      throw claimError;
    }

    if (!claimedAction) {
      return jsonResponse(
        {
          success:
            false,

          action_id:
            action.id,

          message:
            "Action was already claimed by another worker.",
        },
        409
      );
    }

    // Remember this for the outer error handler.
    claimedActionForFailure =
      claimedAction;

    // =======================================================
    // 10. IDEMPOTENCY RECOVERY
    // =======================================================

    const referenceId =
      claimedAction.id;

    let paymentLink =
      await findExistingPaymentLink(
        referenceId,
        razorpayAccountId
      );

    // =======================================================
    // 11. CREATE PAYMENT LINK IF NECESSARY
    // =======================================================

    if (!paymentLink) {
      paymentLink =
        await createRecoveryPaymentLink({
          // Customer pays FULL amount.
          amountInPaise,

          // Vendor receives FOOD amount only.
          foodAmountInPaise,

          referenceId,

          description:
            `GrabTheByte order ${order.id} payment recovery`,

          razorpayAccountId,

          campusId:
            order.campus_id,

          actionType:
            claimedAction.action_type,
        });
    }

    // =======================================================
    // 12. VALIDATE RAZORPAY RESPONSE
    // =======================================================

    const razorpayLinkId =
      paymentLink?.id;

    const razorpayShortUrl =
      paymentLink?.short_url;

    const razorpayAmount =
      Number(
        paymentLink?.amount
      );

    const razorpayCurrency =
      paymentLink?.currency;

    const razorpayStatus =
      paymentLink?.status;

    const linkedAccountFromNotes =
      paymentLink?.notes?.razorpay_account_id;

    // -------------------------------------------------------
    // LINK ID + URL
    // -------------------------------------------------------

    if (
      typeof razorpayLinkId !==
        "string" ||
      typeof razorpayShortUrl !==
        "string"
    ) {
      throw new Error(
        "Razorpay returned an invalid Payment Link response."
      );
    }

    // -------------------------------------------------------
    // VENDOR ACCOUNT
    // -------------------------------------------------------

    if (
      linkedAccountFromNotes !==
      razorpayAccountId
    ) {
      throw new Error(
        `Razorpay Payment Link vendor mismatch. Expected Linked Account ${razorpayAccountId}, received ${linkedAccountFromNotes || "missing"}.`
      );
    }

    // -------------------------------------------------------
    // CUSTOMER PAYMENT AMOUNT
    // -------------------------------------------------------

    if (
      razorpayAmount !==
      amountInPaise
    ) {
      throw new Error(
        `Payment Link amount mismatch. Expected full customer payment of ${amountInPaise} paise, received ${razorpayAmount} paise.`
      );
    }

    // -------------------------------------------------------
    // CURRENCY
    // -------------------------------------------------------

    if (
      razorpayCurrency !==
      "INR"
    ) {
      throw new Error(
        `Payment Link currency mismatch. Expected INR, received ${razorpayCurrency}.`
      );
    }

    // -------------------------------------------------------
    // STATUS
    // -------------------------------------------------------

    if (
      razorpayStatus ===
      "paid"
    ) {
      throw new Error(
        "Recovery Payment Link is already paid. Payment reconciliation must be handled by the payment webhook."
      );
    }

    if (
      razorpayStatus ===
        "expired" ||
      razorpayStatus ===
        "cancelled"
    ) {
      throw new Error(
        `Razorpay returned an unusable Payment Link status: ${razorpayStatus}.`
      );
    }

    if (
      razorpayStatus !==
        "created" &&
      razorpayStatus !==
        "partially_paid"
    ) {
      throw new Error(
        `Unexpected Razorpay Payment Link status: ${razorpayStatus}.`
      );
    }

    // =======================================================
    // 13. BUILD AWAITING PAYMENT RESULT
    // =======================================================

    const awaitingPaymentResult = {
      success:
        true,

      simulated:
        false,

      channel:
        "RAZORPAY_STANDARD_PAYMENT_LINK",

      razorpay_payment_link_id:
        razorpayLinkId,

      razorpay_payment_link_url:
        razorpayShortUrl,

      reference_id:
        referenceId,

      // =====================================================
      // CUSTOMER PAYMENT
      // =====================================================

      customer_payment_amount:
        orderAmount,

      customer_payment_amount_in_paise:
        amountInPaise,

      // =====================================================
      // PLATFORM FEE
      // =====================================================

      platform_fee:
        platformFee,

      platform_fee_in_paise:
        platformFeeInPaise,

      // =====================================================
      // VENDOR FOOD AMOUNT
      // =====================================================

      food_amount:
        foodAmount,

      food_amount_in_paise:
        foodAmountInPaise,

      transfer_amount:
        foodAmount,

      transfer_amount_in_paise:
        foodAmountInPaise,

      // =====================================================
      // ROUTING
      // =====================================================

      campus_id:
        order.campus_id,

      razorpay_account_id:
        razorpayAccountId,

      transfer_currency:
        "INR",

      currency:
        "INR",

      razorpay_status:
        razorpayStatus,

      recovery_action_type:
        claimedAction.action_type,

      selected_payment_method:
        selectedPaymentMethod,

      message:
        `Real Razorpay Standard Payment Link created for ${selectedPaymentMethod.toUpperCase()} recovery. Customer pays the full order amount; only the food amount is transferred to the campus linked account and the platform fee remains with GrabTheByte.`,

      next_step:
        "Await payment_link.paid webhook and transfer reconciliation.",
    };

    // =======================================================
    // 14. STORE PAYMENT LINK
    // =======================================================
    //
    // IMPORTANT:
    //
    // We MUST first move the action to AWAITING_PAYMENT.
    //
    // Only after this database update succeeds do we invoke
    // revenue-recovery-email.
    //
    // This guarantees that the email function sees the correct
    // AWAITING_PAYMENT state.
    // =======================================================

    const {
      data: awaitingAction,
      error: awaitingError,
    } = await supabase
      .from("revenue_recovery_actions")
      .update({
        status:
          "AWAITING_PAYMENT",

        razorpay_payment_link_id:
          razorpayLinkId,

        razorpay_payment_link_url:
          razorpayShortUrl,

        executed_at:
          new Date().toISOString(),

        result:
          awaitingPaymentResult,
      })
      .eq(
        "id",
        claimedAction.id
      )
      .eq(
        "status",
        "PROCESSING"
      )
      .select()
      .single();

    if (awaitingError) {
      throw awaitingError;
    }

    if (!awaitingAction) {
      throw new Error(
        "Recovery action could not be moved to AWAITING_PAYMENT."
      );
    }

    // =======================================================
    // 15. ACTION NO LONGER NEEDS FAILURE HANDLING
    // =======================================================
    //
    // From this point onward the action is AWAITING_PAYMENT.
    //
    // Clear the failure tracker so an unrelated later error
    // cannot incorrectly change it to FAILED.
    // =======================================================

    claimedActionForFailure =
      null;

    // =======================================================
    // 16. UPDATE AUDIT LOG
    // =======================================================

    if (
      claimedAction.log_id
    ) {
      const {
        error: logUpdateError,
      } = await supabase
        .from("revenue_recovery_logs")
        .update({
          action_executed: {
            type:
              "INTERVENTION_EXECUTED",

            action_type:
              claimedAction.action_type,

            action_id:
              claimedAction.id,

            expected_recovery_value:
              claimedAction.expected_recovery_value,

            execution:
              awaitingPaymentResult,
          },

          status:
            "PENDING",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          claimedAction.log_id
        );

      if (logUpdateError) {
        // Do NOT fail the financial action just because the
        // audit-log update failed.
        console.error(
          "Recovery audit log update failed:",
          logUpdateError
        );
      }
    }

    // =======================================================
    // 17. SEND RECOVERY EMAIL
    // =======================================================
    //
    // IMPORTANT:
    //
    // The Payment Link is already safely stored as
    // AWAITING_PAYMENT.
    //
    // The email function receives ONLY action_id.
    //
    // It then securely fetches:
    //   - customer email
    //   - order
    //   - payment link
    //   - amount
    //
    // Email failure DOES NOT fail the recovery action.
    // =======================================================

    const emailResult =
      await sendRecoveryEmail(
        awaitingAction.id
      );

    // =======================================================
    // 18. FINAL RESPONSE
    // =======================================================

    return jsonResponse(
      {
        success:
          true,

        action_id:
          awaitingAction.id,

        action_type:
          awaitingAction.action_type,

        selected_payment_method:
          selectedPaymentMethod,

        status:
          awaitingAction.status,

        attempt_count:
          awaitingAction.attempt_count,

        expected_recovery_value:
          awaitingAction.expected_recovery_value,

        // ===================================================
        // CUSTOMER PAYMENT
        // ===================================================

        recovery_amount:
          orderAmount,

        recovery_amount_in_paise:
          amountInPaise,

        // ===================================================
        // PLATFORM FEE
        // ===================================================

        platform_fee:
          platformFee,

        platform_fee_in_paise:
          platformFeeInPaise,

        // ===================================================
        // FOOD / VENDOR AMOUNT
        // ===================================================

        food_amount:
          foodAmount,

        food_amount_in_paise:
          foodAmountInPaise,

        transfer_amount:
          foodAmount,

        transfer_amount_in_paise:
          foodAmountInPaise,

        // ===================================================
        // VENDOR ROUTING
        // ===================================================

        campus_id:
          order.campus_id,

        razorpay_account_id:
          razorpayAccountId,

        razorpay_payment_link_id:
          razorpayLinkId,

        razorpay_payment_link_url:
          razorpayShortUrl,

        // ===================================================
        // EMAIL DELIVERY
        // ===================================================

        email_delivery:
          emailResult,

        result:
          awaitingPaymentResult,
      }
    );

  } catch (error) {
    // =======================================================
    // GLOBAL ERROR HANDLING
    // =======================================================

    console.error(
      "Revenue recovery executor error:",
      error
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error";

    // -------------------------------------------------------
    // IMPORTANT:
    //
    // If we already claimed the action as PROCESSING,
    // do NOT leave it stuck there.
    // -------------------------------------------------------

    if (
      claimedActionForFailure
    ) {
      try {
        await markActionFailed(
          claimedActionForFailure.id,

          claimedActionForFailure.log_id ??
            null,

          {
            success:
              false,

            error:
              errorMessage,

            action_id:
              claimedActionForFailure.id,

            attempt_count:
              claimedActionForFailure.attempt_count,

            failed_at:
              new Date().toISOString(),
          }
        );
      } catch (failureHandlingError) {
        console.error(
          "Failed while marking recovery action as FAILED:",
          failureHandlingError
        );
      }
    }

    return jsonResponse(
      {
        success:
          false,

        error:
          errorMessage,
      },
      500
    );
  }
});