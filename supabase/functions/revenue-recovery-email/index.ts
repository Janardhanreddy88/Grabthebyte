import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

// =========================================================
// ENVIRONMENT / SECRETS
// =========================================================

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL");

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const SUPABASE_SECRET_KEYS_RAW =
  Deno.env.get("SUPABASE_SECRET_KEYS");

// =========================================================
// HOSTINGER SMTP
// =========================================================
//
// Recommended Hostinger SMTP configuration:
//
// HOSTINGER_SMTP_HOST=smtp.hostinger.com
// HOSTINGER_SMTP_PORT=465
// HOSTINGER_SMTP_SECURE=true
// HOSTINGER_SMTP_USER=your-email@yourdomain.com
// HOSTINGER_SMTP_PASSWORD=your-email-password
// HOSTINGER_SMTP_FROM=GrabTheByte <your-email@yourdomain.com>
//
// Keep these values ONLY in Supabase Edge Function Secrets.
// NEVER put them in frontend code.
// =========================================================

const SMTP_HOST =
  Deno.env.get("HOSTINGER_SMTP_HOST") ||
  "smtp.hostinger.com";

const SMTP_PORT =
  Number(
    Deno.env.get("HOSTINGER_SMTP_PORT") || "465"
  );

const SMTP_SECURE =
  (
    Deno.env.get("HOSTINGER_SMTP_SECURE") ||
    "true"
  ).toLowerCase() === "true";

const SMTP_USER =
  Deno.env.get("HOSTINGER_SMTP_USER");

const SMTP_PASSWORD =
  Deno.env.get("HOSTINGER_SMTP_PASSWORD");

const SMTP_FROM =
  Deno.env.get("HOSTINGER_SMTP_FROM") ||
  SMTP_USER;

// =========================================================
// REQUIRED ENVIRONMENT CHECK
// =========================================================

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error(
    "Supabase server-side secrets are not configured."
  );
}

if (
  !SMTP_USER ||
  !SMTP_PASSWORD ||
  !SMTP_FROM
) {
  throw new Error(
    "Hostinger SMTP credentials are not configured."
  );
}

// =========================================================
// SUPABASE ADMIN CLIENT
// =========================================================

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  );

// =========================================================
// RESPONSE HELPERS
// =========================================================

const jsonHeaders = {
  "Content-Type": "application/json"
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: jsonHeaders
    }
  );
}

// =========================================================
// INTERNAL AUTHENTICATION
// =========================================================
//
// This function is NOT a public frontend endpoint.
//
// Only another trusted backend function should call it.
//
// Expected header:
//
// apikey: <SUPABASE_SERVICE_ROLE_KEY or configured secret>
// =========================================================

function isInternalRequest(
  req: Request
): boolean {

  const apiKey =
    req.headers.get("apikey");

  if (!apiKey) {
    return false;
  }

  // -------------------------------------------------------
  // Check SUPABASE_SECRET_KEYS
  // -------------------------------------------------------

  if (SUPABASE_SECRET_KEYS_RAW) {

    try {

      const secretKeys =
        JSON.parse(
          SUPABASE_SECRET_KEYS_RAW
        );

      if (
        secretKeys &&
        typeof secretKeys === "object"
      ) {

        const allowedKeys =
          Object.values(secretKeys)
            .filter(
              (
                value
              ): value is string =>
                typeof value === "string"
            );

        if (
          allowedKeys.includes(apiKey)
        ) {
          return true;
        }
      }

    } catch {
      // Continue to service-role check.
    }
  }

  // -------------------------------------------------------
  // Check service-role key
  // -------------------------------------------------------

  if (
    SUPABASE_SERVICE_ROLE_KEY &&
    apiKey === SUPABASE_SERVICE_ROLE_KEY
  ) {
    return true;
  }

  return false;
}

// =========================================================
// UUID VALIDATION
// =========================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(
  value: unknown
): value is string {

  return (
    typeof value === "string" &&
    UUID_REGEX.test(value)
  );
}

// =========================================================
// CREATE SMTP TRANSPORT
// =========================================================
//
// Port 465:
//     secure = true
//
// Port 587:
//     secure = false
//     STARTTLS is used
//
// Nodemailer supports both configurations.
// =========================================================

const transporter =
  nodemailer.createTransport({

    host:
      SMTP_HOST,

    port:
      SMTP_PORT,

    secure:
      SMTP_SECURE,

    auth: {
      user:
        SMTP_USER,

      pass:
        SMTP_PASSWORD
    },

    // -----------------------------------------------------
    // Security
    // -----------------------------------------------------

    tls: {
      rejectUnauthorized: true
    },

    // -----------------------------------------------------
    // Avoid hanging forever
    // -----------------------------------------------------

    connectionTimeout:
      20_000,

    greetingTimeout:
      15_000,

    socketTimeout:
      30_000
  });

// =========================================================
// VERIFY SMTP CONNECTION
// =========================================================
//
// We do NOT verify during module startup.
// That would unnecessarily open an SMTP connection on every
// cold start.
//
// Instead this can be called immediately before sending.
// =========================================================

async function verifySmtpConnection() {

  try {

    await transporter.verify();

    console.log(
      "[Email] Hostinger SMTP connection verified."
    );

  } catch (error) {

    console.error(
      "[Email] Hostinger SMTP verification failed:",
      error
    );

    throw new Error(
      "Hostinger SMTP connection failed."
    );
  }
}

// =========================================================
// FETCH RECOVERY ACTION
// =========================================================

async function fetchRecoveryAction(
  actionId: string
) {

  const {
    data: action,
    error
  } = await supabase
    .from(
      "revenue_recovery_actions"
    )
    .select("*")
    .eq(
      "id",
      actionId
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return action;
}

// =========================================================
// FETCH ORIGINAL ORDER
// =========================================================

async function fetchOrder(
  orderId: string
) {

  const {
    data: order,
    error
  } = await supabase
    .from("orders")
    .select(
      "id,order_number,total,user_id,campus_id,status,payment_status"
    )
    .eq(
      "id",
      orderId
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return order;
}

// =========================================================
// FETCH CUSTOMER EMAIL
// =========================================================
//
// The recovery action contains user_id.
// We use Supabase Auth Admin API to retrieve the user's
// authoritative email address.
//
// We NEVER accept an email address from the frontend.
// =========================================================

async function fetchCustomerEmail(
  userId: string
): Promise<string> {

  const {
    data,
    error
  } =
    await supabase.auth.admin.getUserById(
      userId
    );

  if (error) {
    throw error;
  }

  const email =
    data?.user?.email;

  if (
    typeof email !== "string" ||
    email.trim() === ""
  ) {
    throw new Error(
      "Customer does not have a valid email address."
    );
  }

  return email.trim();
}

// =========================================================
// FORMAT INR
// =========================================================

function formatINR(
  amount: unknown
): string {

  const number =
    Number(amount);

  if (
    !Number.isFinite(number)
  ) {
    return "₹0.00";
  }

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2
    }
  ).format(number);
}

// =========================================================
// ESCAPE HTML
// =========================================================
//
// The payment URL is generated by Razorpay and fetched from
// our database, but we still HTML-escape dynamic values.
// =========================================================

function escapeHtml(
  value: string
): string {

  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

// =========================================================
// RECOVERY EMAIL CONTEXT
// =========================================================
//
// The recovery engine remains responsible for diagnosis and
// recovery decisions. This helper only reads information already
// produced/stored by the recovery action and formats it for the
// customer-facing email.
//
// No new recovery decision is made here.
// =========================================================

function getRecoveryEmailContext(action: any) {

  const result =
    action.result &&
    typeof action.result === "object"
      ? action.result
      : {};

  const diagnosisSource =
    result.failure_reason ||
    result.recovery_reason ||
    result.diagnosis ||
    result.reason ||
    result.error_reason ||
    action.failure_reason ||
    action.recovery_reason ||
    action.diagnosis ||
    action.reason ||
    "";

  const failureReason =
    typeof diagnosisSource === "string" &&
    diagnosisSource.trim() !== ""
      ? diagnosisSource.trim()
      : "The previous payment attempt could not be completed successfully.";

  const recommendedMethod =
    action.action_type === "RETRY_WITH_UPI"
      ? "UPI"
      : action.action_type === "RETRY_WITH_CARD"
        ? "Card"
        : "the available payment methods";

  const recommendationText =
    action.action_type === "RETRY_WITH_UPI"
      ? "The recovery system recommends trying UPI for the next payment attempt."
      : action.action_type === "RETRY_WITH_CARD"
        ? "The recovery system recommends trying a card for the next payment attempt."
        : "Please use one of the available payment methods on the secure checkout.";

  return {
    failureReason,
    recommendedMethod,
    recommendationText
  };
}

// =========================================================
// BUILD EMAIL
// =========================================================

function buildRecoveryEmail(
  params: {
    orderId: string;
    paymentLink: string;
    amount: number;
    failureReason: string;
    recommendedMethod: string;
    recommendationText: string;
  }
) {

  const safeOrderId =
    escapeHtml(
      params.orderId
    );

  const safePaymentLink =
    escapeHtml(
      params.paymentLink
    );

  const safeFailureReason =
    escapeHtml(
      params.failureReason
    );

  const safeRecommendedMethod =
    escapeHtml(
      params.recommendedMethod
    );

  const safeRecommendationText =
    escapeHtml(
      params.recommendationText
    );

  const formattedAmount =
    formatINR(
      params.amount
    );

  // =======================================================
  // TEXT VERSION
  // =======================================================

  const text = `
Hello,

We couldn't complete the payment for your GrabTheByte order.

ORDER DETAILS
Order: ${params.orderId}
Amount: ${formattedAmount}
Payment status: Failed

WHAT HAPPENED?
${params.failureReason}

RECOMMENDED NEXT STEP
Recommended payment method: ${params.recommendedMethod}
${params.recommendationText}

You can securely retry your payment using the link below:

${params.paymentLink}

This recovery payment link is temporary and may expire shortly.

If you have already completed the payment, please ignore this email.

Thank you,
GrabTheByte
  `.trim();

  // =======================================================
  // HTML VERSION
  // =======================================================

  const html = `
<!DOCTYPE html>

<html>
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    Payment recovery for your GrabTheByte order
  </title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f5f7fa;
    font-family:Arial,Helvetica,sans-serif;
  "
>

  <div
    style="
      max-width:600px;
      margin:40px auto;
      background:#ffffff;
      border-radius:14px;
      overflow:hidden;
      box-shadow:0 2px 12px rgba(0,0,0,0.08);
    "
  >

    <!-- HEADER -->

    <div
      style="
        padding:26px 24px;
        text-align:center;
        background:#111827;
        color:#ffffff;
      "
    >

      <h1
        style="
          margin:0;
          font-size:24px;
          line-height:1.3;
        "
      >
        GrabTheByte
      </h1>

      <p
        style="
          margin:8px 0 0 0;
          font-size:13px;
          color:#d1d5db;
        "
      >
        Payment Recovery Assistance
      </p>

    </div>


    <!-- CONTENT -->

    <div
      style="
        padding:32px 28px;
        color:#1f2937;
      "
    >

      <h2
        style="
          margin:0 0 12px 0;
          font-size:23px;
          line-height:1.3;
        "
      >
        Your payment couldn't be completed
      </h2>

      <p
        style="
          margin:0 0 24px 0;
          font-size:15px;
          line-height:1.7;
          color:#4b5563;
        "
      >
        We noticed that the payment for your GrabTheByte order
        was unsuccessful. Your order can still be completed
        securely.
      </p>


      <!-- ORDER SUMMARY -->

      <div
        style="
          margin:24px 0;
          padding:20px;
          background:#f9fafb;
          border:1px solid #e5e7eb;
          border-radius:10px;
        "
      >

        <p
          style="
            margin:0 0 12px 0;
            font-size:13px;
            font-weight:bold;
            color:#6b7280;
            text-transform:uppercase;
            letter-spacing:0.4px;
          "
        >
          GrabTheByte Order
        </p>

        <p
          style="
            margin:0 0 10px 0;
            font-size:14px;
            line-height:1.5;
          "
        >
          <strong>Order:</strong>
          ${safeOrderId}
        </p>

        <p
          style="
            margin:0 0 10px 0;
            font-size:14px;
            line-height:1.5;
          "
        >
          <strong>Amount:</strong>
          ${formattedAmount}
        </p>

        <p
          style="
            margin:0;
            font-size:14px;
            line-height:1.5;
          "
        >
          <strong>Payment status:</strong>
          <span style="font-weight:bold;">
            Failed
          </span>
        </p>

      </div>


      <!-- WHAT HAPPENED -->

      <div
        style="
          margin:26px 0;
          padding:20px;
          background:#fffaf0;
          border:1px solid #f3e4c1;
          border-radius:10px;
        "
      >

        <h3
          style="
            margin:0 0 10px 0;
            font-size:16px;
          "
        >
          What happened?
        </h3>

        <p
          style="
            margin:0;
            font-size:14px;
            line-height:1.7;
            color:#4b5563;
          "
        >
          ${safeFailureReason}
        </p>

      </div>


      <!-- RECOMMENDATION -->

      <div
        style="
          margin:26px 0;
          padding:20px;
          background:#f9fafb;
          border:1px solid #e5e7eb;
          border-radius:10px;
        "
      >

        <h3
          style="
            margin:0 0 10px 0;
            font-size:16px;
          "
        >
          Recommended next step
        </h3>

        <p
          style="
            margin:0 0 8px 0;
            font-size:14px;
            line-height:1.6;
          "
        >
          <strong>Recommended payment method:</strong>
          ${safeRecommendedMethod}
        </p>

        <p
          style="
            margin:0;
            font-size:14px;
            line-height:1.7;
            color:#4b5563;
          "
        >
          ${safeRecommendationText}
        </p>

      </div>


      <!-- PAYMENT CTA -->

      <div
        style="
          text-align:center;
          margin:32px 0;
        "
      >

        <a
          href="${safePaymentLink}"
          style="
            display:inline-block;
            padding:15px 30px;
            background:#111827;
            color:#ffffff;
            text-decoration:none;
            border-radius:8px;
            font-size:16px;
            font-weight:bold;
          "
        >
          Retry Payment Securely
        </a>

      </div>


      <!-- FALLBACK URL -->

      <p
        style="
          margin:0 0 8px 0;
          font-size:12px;
          color:#6b7280;
          line-height:1.5;
        "
      >
        If the button does not work, copy and open the
        following secure payment link in your browser:
      </p>

      <p
        style="
          margin:0;
          font-size:12px;
          word-break:break-all;
          color:#4b5563;
          line-height:1.5;
        "
      >
        ${safePaymentLink}
      </p>


      <!-- REASSURANCE -->

      <div
        style="
          margin-top:28px;
          padding-top:20px;
          border-top:1px solid #e5e7eb;
        "
      >

        <p
          style="
            margin:0;
            font-size:13px;
            line-height:1.7;
            color:#6b7280;
          "
        >
          If you have already completed this payment,
          no further action is required and you can ignore
          this email.
        </p>

      </div>

    </div>


    <!-- FOOTER -->

    <div
      style="
        padding:18px 28px;
        background:#f9fafb;
        color:#6b7280;
        font-size:12px;
        line-height:1.5;
        text-align:center;
      "
    >

      This is an automated payment recovery email
      from GrabTheByte.

    </div>

  </div>

</body>
</html>
  `.trim();

  return {
    text,
    html
  };
}

// =========================================================
// SEND RECOVERY EMAIL
// =========================================================

async function sendRecoveryEmail(
  params: {
    to: string;
    orderId: string;
    paymentLink: string;
    amount: number;
    failureReason: string;
    recommendedMethod: string;
    recommendationText: string;
  }
) {

  const {
    text,
    html
  } =
    buildRecoveryEmail({
      orderId:
        params.orderId,

      paymentLink:
        params.paymentLink,

      amount:
        params.amount,

      failureReason:
        params.failureReason,

      recommendedMethod:
        params.recommendedMethod,

      recommendationText:
        params.recommendationText
    });

  const info =
    await transporter.sendMail({

      from:
        SMTP_FROM,

      to:
        params.to,

      subject:
        `Complete your GrabTheByte payment – Order ${params.orderId}`,

      text,

      html
    });

  console.log(
    "[Email] Recovery email sent.",
    {
      messageId:
        info.messageId,

      orderId:
        params.orderId,

      recipient:
        params.to
    }
  );

  return info;
}

// =========================================================
// RECORD EMAIL DELIVERY RESULT
// =========================================================
//
// We store delivery information inside the existing JSONB
// `result` column.
//
// No new database column is required.
// =========================================================

async function recordEmailSuccess(
  action: any,
  email: string,
  messageId: string | null
) {

  const currentResult =
    action.result &&
    typeof action.result === "object"
      ? action.result
      : {};

  const updatedResult = {

    ...currentResult,

    email_delivery: {

      status:
        "SENT",

      recipient:
        email,

      message_id:
        messageId,

      sent_at:
        new Date().toISOString()
    }
  };

  const {
    error
  } = await supabase
    .from(
      "revenue_recovery_actions"
    )
    .update({
      result:
        updatedResult
    })
    .eq(
      "id",
      action.id
    );

  if (error) {
    console.error(
      "[Email] Failed to record email success:",
      error
    );
  }
}

// =========================================================
// RECORD EMAIL FAILURE
// =========================================================

async function recordEmailFailure(
  action: any,
  errorMessage: string
) {

  const currentResult =
    action.result &&
    typeof action.result === "object"
      ? action.result
      : {};

  const updatedResult = {

    ...currentResult,

    email_delivery: {

      status:
        "FAILED",

      error:
        errorMessage,

      failed_at:
        new Date().toISOString()
    }
  };

  const {
    error
  } = await supabase
    .from(
      "revenue_recovery_actions"
    )
    .update({
      result:
        updatedResult
    })
    .eq(
      "id",
      action.id
    );

  if (error) {
    console.error(
      "[Email] Failed to record email failure:",
      error
    );
  }
}

// =========================================================
// MAIN EDGE FUNCTION
// =========================================================

serve(
  async (req) => {

    try {

      // =====================================================
      // 1. METHOD CHECK
      // =====================================================

      if (
        req.method !== "POST"
      ) {

        return jsonResponse(
          {
            success:
              false,

            error:
              "Only POST requests are allowed."
          },
          405
        );
      }

      // =====================================================
      // 2. INTERNAL AUTHENTICATION
      // =====================================================

      if (
        !isInternalRequest(req)
      ) {

        console.warn(
          "[Email] Unauthorized request."
        );

        return jsonResponse(
          {
            success:
              false,

            error:
              "Unauthorized."
          },
          401
        );
      }

      // =====================================================
      // 3. PARSE REQUEST
      // =====================================================

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
              "Request body must be valid JSON."
          },
          400
        );
      }

      const actionId =
        body?.action_id;

      if (
        !isValidUuid(actionId)
      ) {

        return jsonResponse(
          {
            success:
              false,

            error:
              "Valid action_id UUID is required."
          },
          400
        );
      }

      // =====================================================
      // 4. FETCH RECOVERY ACTION
      // =====================================================

      const action =
        await fetchRecoveryAction(
          actionId
        );

      if (!action) {

        return jsonResponse(
          {
            success:
              false,

            error:
              "Recovery action not found."
          },
          404
        );
      }

      // =====================================================
      // 5. VERIFY ACTION TYPE
      // =====================================================

      if (
        action.action_type !==
          "RETRY_WITH_UPI" &&
        action.action_type !==
          "RETRY_WITH_CARD"
      ) {

        return jsonResponse(
          {
            success:
              false,

            error:
              "Email delivery is only supported for RETRY_WITH_UPI or RETRY_WITH_CARD recovery actions."
          },
          400
        );
      }

      // =====================================================
      // 6. VERIFY ACTION STATE
      // =====================================================

      if (
        action.status !==
        "AWAITING_PAYMENT"
      ) {

        return jsonResponse(
          {
            success:
              false,

            action_id:
              action.id,

            status:
              action.status,

            error:
              "Recovery action is not awaiting payment."
          },
          409
        );
      }

      // =====================================================
      // 7. GET PAYMENT LINK
      // =====================================================

      const paymentLink =
        action.razorpay_payment_link_url;

      if (
        typeof paymentLink !== "string" ||
        paymentLink.trim() === ""
      ) {

        return jsonResponse(
          {
            success:
              false,

            error:
              "Recovery action does not contain a payment link."
          },
          400
        );
      }

      // =====================================================
      // 8. GET ORDER
      // =====================================================

      if (
        !isValidUuid(
          action.order_id
        )
      ) {

        return jsonResponse(
          {
            success:
              false,

            error:
              "Recovery action has an invalid order_id."
          },
          400
        );
      }

      const order =
        await fetchOrder(
          action.order_id
        );

      if (!order) {

        return jsonResponse(
          {
            success:
              false,

            error:
              "Original order not found."
          },
          404
        );
      }

      // =====================================================
      // 9. SAFETY CHECK
      // =====================================================
      //
      // Do not send a recovery email if the order has already
      // been paid.
      // =====================================================

      const orderAlreadyPaid =
        order.payment_status ===
          "completed" ||
        order.status ===
          "confirmed" ||
        order.status ===
          "collected";

      if (
        orderAlreadyPaid
      ) {

        return jsonResponse(
          {
            success:
              false,

            action_id:
              action.id,

            error:
              "Original order is already paid. Recovery email will not be sent."
          },
          409
        );
      }

      // =====================================================
      // 10. GET CUSTOMER
      // =====================================================

      const userId =
        action.user_id ||
        order.user_id;

      if (
        !isValidUuid(userId)
      ) {

        return jsonResponse(
          {
            success:
              false,

            error:
              "Customer user_id is missing or invalid."
          },
          400
        );
      }

      const customerEmail =
        await fetchCustomerEmail(
          userId
        );

      // =====================================================
      // 11. CHECK PREVIOUS EMAIL
      // =====================================================
      //
      // This prevents normal repeated invocations from sending
      // another email after a successful delivery.
      // =====================================================

      const existingResult =
        action.result &&
        typeof action.result === "object"
          ? action.result
          : {};

      const existingEmailDelivery =
        existingResult.email_delivery;

      if (
        existingEmailDelivery &&
        typeof existingEmailDelivery === "object" &&
        existingEmailDelivery.status ===
          "SENT"
      ) {

        return jsonResponse(
          {
            success:
              true,

            already_sent:
              true,

            action_id:
              action.id,

            recipient:
              existingEmailDelivery.recipient,

            message:
              "Recovery email has already been sent."
          }
        );
      }

      // =====================================================
      // 12. VERIFY SMTP
      // =====================================================

      await verifySmtpConnection();

      // =====================================================
      // 13. SEND EMAIL
      // =====================================================

      const orderAmount =
        Number(order.total);

      if (
        !Number.isFinite(orderAmount) ||
        orderAmount <= 0
      ) {

        return jsonResponse(
          {
            success:
              false,

            error:
              "Original order has an invalid amount."
          },
          400
        );
      }

      const recoveryEmailContext =
        getRecoveryEmailContext(
          action
        );

      const customerOrderNumber =
        typeof order.order_number === "string" &&
        order.order_number.trim() !== ""
          ? order.order_number
          : order.id;

      let mailInfo;

      try {

        mailInfo =
          await sendRecoveryEmail({

            to:
              customerEmail,

            orderId:
              customerOrderNumber,

            paymentLink:
              paymentLink,

            amount:
              orderAmount,

            failureReason:
              recoveryEmailContext.failureReason,

            recommendedMethod:
              recoveryEmailContext.recommendedMethod,

            recommendationText:
              recoveryEmailContext.recommendationText
          });

      } catch (error) {

        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown email delivery error.";

        await recordEmailFailure(
          action,
          errorMessage
        );

        throw error;
      }

      // =====================================================
      // 14. RECORD SUCCESS
      // =====================================================

      await recordEmailSuccess(
        action,
        customerEmail,
        mailInfo?.messageId ||
          null
      );

      // =====================================================
      // 15. FINAL RESPONSE
      // =====================================================

      return jsonResponse(
        {
          success:
            true,

          already_sent:
            false,

          action_id:
            action.id,

          order_id:
            order.id,

          recipient:
            customerEmail,

          payment_link:
            paymentLink,

          message:
            "Recovery payment email sent successfully."
        }
      );

    } catch (error) {

      console.error(
        "[Email] Revenue recovery email error:",
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error.";

      return jsonResponse(
        {
          success:
            false,

          error:
            errorMessage
        },
        500
      );
    }
  }
);