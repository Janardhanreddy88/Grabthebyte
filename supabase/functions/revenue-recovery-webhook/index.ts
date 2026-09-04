import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =========================================================
// ENVIRONMENT / SECRETS
// =========================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const GEMINI_API_KEY =
  Deno.env.get("GEMINI_API_KEY");

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is not configured.");
}

// =========================================================
// SUPABASE SERVER KEY
// =========================================================
//
// Incoming requests are intentionally unauthenticated for the
// buildathon/demo environment. The service-role key remains server-side
// only and is used for trusted database operations.
// =========================================================

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is not configured."
  );
}

const SUPABASE_ADMIN_KEY =
  SUPABASE_SERVICE_ROLE_KEY;

// =========================================================
// SUPABASE ADMIN CLIENT
// =========================================================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ADMIN_KEY
);

// =========================================================
// CONSTANTS
// =========================================================

const VALID_DIAGNOSES = [
  "temporary_payment_failure",
  "insufficient_funds",
  "checkout_abandonment",
  "unknown_failure"
] as const;

const EXECUTABLE_ACTION_TYPES = [
  "RETRY_WITH_UPI",
  "RETRY_WITH_CARD",
  "RETRY_WITH_NETBANKING",
  "RETRY_WITH_WALLET"
] as const;

const MIN_RECOVERY_SCORE = 15;

const DEFAULT_POLICY = {
  is_recovery_enabled: true,
  min_cart_value: 30,
  max_daily_discount_budget: 500,
  daily_budget_used: 0,
  max_retries_per_user: 2
};

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
// SAFE STRING
// =========================================================

function safeString(
  value: unknown,
  maxLength = 1000
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value
    .trim()
    .slice(0, maxLength);
}

// =========================================================
// SAFE POSITIVE NUMBER
// =========================================================

function safePositiveNumber(
  value: unknown
): number | null {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

// =========================================================
// FETCH CAMPUS POLICY
// =========================================================

async function fetchPolicy(
  campusId: string | null
) {
  let policy = null;

  if (campusId) {
    const {
      data,
      error
    } = await supabase
      .from("revenue_recovery_policies")
      .select("*")
      .eq("campus_id", campusId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    policy = data;
  }

  if (!policy) {
    const {
      data,
      error
    } = await supabase
      .from("revenue_recovery_policies")
      .select("*")
      .is("campus_id", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    policy = data;
  }

  return policy || DEFAULT_POLICY;
}

// =========================================================
// FETCH TRUSTED ORDER
// =========================================================

async function fetchTrustedOrder(
  orderId: string
) {
  const {
    data: order,
    error
  } = await supabase
    .from("orders")
    .select(
      "id,total,status,payment_status,user_id,campus_id,razorpay_order_id"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return order;
}

// =========================================================
// COMPLIANT ESCALATION BUILDER
// =========================================================
//
// IMPORTANT:
//
// STOP means:
// - No automated recovery action
// - No recovery executor
// - No additional payment attempt
// - Case is explicitly marked for compliant/manual review
//
// This object becomes part of the audit trail.
// =========================================================

function buildComplianceEscalation(stopReason: string) {
  return {
    required: true,

    type: "COMPLIANT_ESCALATION",

    channel: "MANUAL_REVIEW",

    reason: stopReason,

    status: "PENDING",

    automated_action_blocked: true,

    executor_blocked: true,

    audit_required: true,

    created_at: new Date().toISOString(),

    // Escalation lifecycle
    escalated_at: new Date().toISOString(),

    reviewed_at: null,

    resolved_at: null,

    resolution_reason: null
  };
}

// =========================================================
// INSERT RECOVERY AUDIT LOG
// =========================================================

async function insertRecoveryLog(
  params: {
    campusId: string | null;
    orderId: string | null;
    cartId: string | null;
    userId: string | null;
    eventType: string;
    rawErrorCode: string | null;
    rawErrorMessage: string | null;
    aiDiagnosis: Record<string, unknown>;
    recoveryScore: number;
    policyEvaluation: Record<string, unknown>;
    decision: string;
    selectedAction: string | null;
    actionExecuted: Record<string, unknown>;
    status: string;
    stopReason: string | null;
    attemptCount: number;
    originalAmount: number;
    expectedRecoveryValue: number;
    escalationStatus: string | null;
    escalatedAt: string | null;
    reviewedAt: string | null;
    resolvedAt: string | null;
    resolutionReason: string | null;
  }
) {
  const {
    data,
    error
  } = await supabase
    .from("revenue_recovery_logs")
    .insert({
      campus_id: params.campusId,

      order_id: params.orderId,

      cart_id: params.cartId,

      user_id: params.userId,

      event_type: params.eventType,

      raw_error_code: params.rawErrorCode,

      raw_error_message: params.rawErrorMessage,

      ai_diagnosis: params.aiDiagnosis,

      recovery_score: params.recoveryScore,

      policy_evaluation:
        params.policyEvaluation,

      decision: params.decision,

      selected_action:
        params.selectedAction,

      action_executed:
        params.actionExecuted,

      status: params.status,

      recovered_amount: 0,

      stop_reason: params.stopReason,

      recovery_state:
        params.decision === "STOP"
          ? "STOPPED"
          : "ACTION_QUEUED",

      attempt_count:
        params.attemptCount,

      original_amount:
        params.originalAmount,

      intervention_cost: 0,

      expected_recovery_value:
        params.expectedRecoveryValue,

      escalation_status:
        params.escalationStatus || "NONE",

      escalated_at:
        params.escalatedAt,

      reviewed_at:
        params.reviewedAt,

      resolved_at:
        params.resolvedAt,

      resolution_reason:
        params.resolutionReason
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// =========================================================
// UPDATE LOG AFTER ACTION IS QUEUED
// =========================================================

async function updateLogAfterQueue(
  logId: string,
  actionId: string,
  actionType: string,
  expectedRecoveryValue: number,
  reason: string
) {
  const {
    error
  } = await supabase
    .from("revenue_recovery_logs")
    .update({
      action_executed: {
        type: "INTERVENTION_QUEUED",

        strategy: actionType,

        action_id: actionId,

        expected_recovery_value:
          expectedRecoveryValue,

        reason
      },

      recovery_state:
        "ACTION_QUEUED",

      updated_at:
        new Date().toISOString()
    })
    .eq("id", logId);

  if (error) {
    console.error(
      "Recovery log queue update failed:",
      error
    );
  }
}

// =========================================================
// AI DIAGNOSIS + INTERVENTION RECOMMENDATION
// =========================================================
//
// The model now does two jobs:
// 1. Diagnose the failure.
// 2. Recommend the most suitable payment route.
//
// The recommendation is NOT blindly trusted. We still apply a
// deterministic compatibility layer before an action is queued.
// This keeps the AI useful while preventing an invalid action
// from being selected just because the model suggested it.
// =========================================================

const VALID_ACTION_RECOMMENDATIONS = [
  "RETRY_WITH_UPI",
  "RETRY_WITH_CARD",
  "RETRY_WITH_NETBANKING",
  "RETRY_WITH_WALLET"
] as const;

type RecoveryActionType =
  (typeof VALID_ACTION_RECOMMENDATIONS)[number];

function normalizePaymentMethod(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const method = value.trim().toLowerCase();

  if (!method) {
    return null;
  }

  if (
    method === "upi" ||
    method === "upi_intent" ||
    method === "upi_qr"
  ) {
    return "upi";
  }

  if (
    method === "card" ||
    method === "credit_card" ||
    method === "debit_card"
  ) {
    return "card";
  }

  if (
    method === "netbanking" ||
    method === "net_banking" ||
    method === "bank"
  ) {
    return "netbanking";
  }

  if (
    method === "wallet" ||
    method === "wallets"
  ) {
    return "wallet";
  }

  return method;
}

function actionForMethod(method: string): RecoveryActionType | null {
  switch (method) {
    case "upi":
      return "RETRY_WITH_UPI";
    case "card":
      return "RETRY_WITH_CARD";
    case "netbanking":
      return "RETRY_WITH_NETBANKING";
    case "wallet":
      return "RETRY_WITH_WALLET";
    default:
      return null;
  }
}

function methodForAction(action: string): string | null {
  switch (action) {
    case "RETRY_WITH_UPI":
      return "upi";
    case "RETRY_WITH_CARD":
      return "card";
    case "RETRY_WITH_NETBANKING":
      return "netbanking";
    case "RETRY_WITH_WALLET":
      return "wallet";
    default:
      return null;
  }
}

function deterministicMethodPreference(
  diagnosis: string,
  errorCode: string | null,
  errorMessage: string | null,
  failedPaymentMethod: string | null,
  userHistory: unknown
): Array<{
  method: string;
  probability: number;
  reason: string;
}> {
  const code = (errorCode || "").toLowerCase();
  const message = (errorMessage || "").toLowerCase();
  const history =
    userHistory && typeof userHistory === "object"
      ? userHistory as Record<string, unknown>
      : {};

  const previousSuccessfulMethod = normalizePaymentMethod(
    history.successful_payment_method ??
    history.last_successful_payment_method
  );

  const failedMethod = normalizePaymentMethod(failedPaymentMethod);

  const preferences = new Map<string, { probability: number; reason: string }>();

  const add = (method: string, probability: number, reason: string) => {
    const current = preferences.get(method);
    if (!current || probability > current.probability) {
      preferences.set(method, { probability, reason });
    }
  };

  // Start with a root-cause-aware baseline.
  if (diagnosis === "temporary_payment_failure") {
    add("upi", 0.82, "UPI is a strong alternate rail for a temporary payment failure.");
    add("card", 0.80, "Card is an independent payment rail for a temporary gateway failure.");
    add("netbanking", 0.76, "NetBanking is an independent bank rail for a temporary gateway failure.");
    add("wallet", 0.68, "Wallet is another bounded payment rail when supported by the customer.");
  } else if (diagnosis === "insufficient_funds") {
    add("netbanking", 0.84, "NetBanking can use a separate bank account with available funds.");
    add("card", 0.78, "A different card can use a separate funding source.");
    add("upi", 0.62, "UPI may work if the customer switches to a funded bank account.");
    add("wallet", 0.68, "A funded wallet can provide a separate source of funds.");
  } else if (diagnosis === "checkout_abandonment") {
    add("upi", 0.84, "UPI is a low-friction recovery route after checkout abandonment.");
    add("card", 0.78, "Card is a familiar alternative checkout route.");
    add("wallet", 0.72, "Wallet can reduce friction when already funded.");
    add("netbanking", 0.66, "NetBanking is a valid alternate checkout route.");
  } else {
    add("upi", 0.60, "UPI is a bounded alternate route for an uncertain failure.");
    add("card", 0.58, "Card is an independent alternate route for an uncertain failure.");
    add("netbanking", 0.56, "NetBanking is another independent route for an uncertain failure.");
    add("wallet", 0.52, "Wallet is an alternate route when supported by the customer.");
  }

  // Explicit method/error evidence should affect ranking.
  if (code.includes("upi") || message.includes("upi")) {
    const current = preferences.get("upi");
    if (current) {
      current.probability = Math.min(current.probability, 0.12);
      current.reason = "The failure explicitly references UPI, so UPI is not recommended for the immediate retry.";
    }
  }

  if (
    code.includes("card") ||
    message.includes("card") ||
    message.includes("cvv") ||
    message.includes("expired card")
  ) {
    const current = preferences.get("card");
    if (current) {
      current.probability = Math.min(current.probability, 0.12);
      current.reason = "The failure explicitly references the card, so card is not recommended for the immediate retry.";
    }
  }

  if (
    code.includes("netbank") ||
    message.includes("netbank") ||
    message.includes("net banking")
  ) {
    const current = preferences.get("netbanking");
    if (current) {
      current.probability = Math.min(current.probability, 0.12);
      current.reason = "The failure explicitly references NetBanking, so NetBanking is not recommended for the immediate retry.";
    }
  }

  if (code.includes("wallet") || message.includes("wallet")) {
    const current = preferences.get("wallet");
    if (current) {
      current.probability = Math.min(current.probability, 0.12);
      current.reason = "The failure explicitly references the wallet, so wallet is not recommended for the immediate retry.";
    }
  }

  // CRITICAL: if the actual failed method is known, make the next
  // intervention an alternate rail. This is stronger than merely
  // lowering the probability because we never want an immediate
  // same-method retry to win due to an AI recommendation.
  if (failedMethod) {
    const alternateBoosts: Record<string, Array<[string, number, string]>> = {
      upi: [
        ["card", 0.88, "The failed attempt used UPI; card is selected as an independent alternate rail."],
        ["netbanking", 0.84, "The failed attempt used UPI; NetBanking is an independent bank rail."],
        ["wallet", 0.72, "The failed attempt used UPI; wallet is retained as another alternate rail."]
      ],
      card: [
        ["netbanking", 0.88, "The failed attempt used card; NetBanking is selected as an independent alternate bank rail."],
        ["upi", 0.84, "The failed attempt used card; UPI is selected as an independent alternate rail."],
        ["wallet", 0.72, "The failed attempt used card; wallet is retained as another alternate rail."]
      ],
      netbanking: [
        ["upi", 0.88, "The failed attempt used NetBanking; UPI is selected as an independent alternate rail."],
        ["card", 0.84, "The failed attempt used NetBanking; card is an independent alternate rail."],
        ["wallet", 0.72, "The failed attempt used NetBanking; wallet is retained as another alternate rail."]
      ],
      wallet: [
        ["upi", 0.88, "The failed attempt used wallet; UPI is selected as an independent alternate rail."],
        ["card", 0.84, "The failed attempt used wallet; card is an independent alternate rail."],
        ["netbanking", 0.80, "The failed attempt used wallet; NetBanking is an independent bank rail."]
      ]
    };

    const alternatives = alternateBoosts[failedMethod] || [];

    // Penalize the failed method first.
    const failedEntry = preferences.get(failedMethod);
    if (failedEntry) {
      failedEntry.probability = 0;
      failedEntry.reason = "This payment method already failed for the current attempt; it is blocked from immediate retry.";
    }

    // Then apply explicit alternate-rail scores.
    for (const [method, probability, reason] of alternatives) {
      const current = preferences.get(method);
      if (current) {
        current.probability = Math.max(current.probability, probability);
        current.reason = reason;
      }
    }
  }

  // A previously successful route is useful, but it can never override
  // the current failed method block.
  if (previousSuccessfulMethod && previousSuccessfulMethod !== failedMethod) {
    const previous = preferences.get(previousSuccessfulMethod);
    if (previous) {
      previous.probability = Math.min(0.95, previous.probability + 0.06);
      previous.reason = `${previous.reason} Customer history also shows this route has succeeded before.`;
    }
  }

  return Array.from(preferences.entries())
    .map(([method, value]) => ({
      method,
      probability: value.probability,
      reason: value.reason
    }))
    .sort((a, b) => b.probability - a.probability);
}

async function diagnoseFailure(
  params: {
    rawErrorCode: string | null;
    rawErrorMessage: string | null;
    transactionAmount: number;
    userHistory: unknown;
    failedPaymentMethod: string | null;
  }
) {
  const fallbackDiagnosis = {
    diagnosis: "unknown_failure",
    confidence: 0.5,
    evidence: [
      "AI diagnosis unavailable; deterministic fallback used."
    ],
    recommended_action: null as string | null,
    recommendation_confidence: 0,
    method_ranking: [] as Array<Record<string, unknown>>
  };

  const deterministicRanking = deterministicMethodPreference(
    "unknown_failure",
    params.rawErrorCode,
    params.rawErrorMessage,
    params.failedPaymentMethod,
    params.userHistory
  );

  fallbackDiagnosis.method_ranking = deterministicRanking.map((item) => ({
    action: actionForMethod(item.method),
    method: item.method,
    probability: item.probability,
    reason: item.reason
  }));

  if (!GEMINI_API_KEY) {
    return fallbackDiagnosis;
  }

  const errorCode = params.rawErrorCode || "UNKNOWN";
  const errorMessage = params.rawErrorMessage || "No message";

  let historyText = "{}";
  try {
    historyText = JSON.stringify(params.userHistory || {}).slice(0, 6000);
  } catch {
    historyText = "{}";
  }

  const failedMethod =
    normalizePaymentMethod(params.failedPaymentMethod) ||
    "unknown";

  const geminiPrompt = `
You are the payment recovery intelligence layer for GrabTheByte.

Analyze one failed payment and recommend the BEST NEXT PAYMENT ROUTE.
The previously attempted payment method is authoritative when provided. NEVER recommend the same payment method for the immediate next retry. Choose an alternate rail.
Rank the alternate methods using the root cause, gateway error, and customer history. Do not invent facts.

Failure code: ${errorCode}
Failure message: ${errorMessage}
Transaction amount: INR ${params.transactionAmount}
Previously attempted payment method: ${failedMethod}
Customer history: ${historyText}

Diagnose exactly ONE root cause:
- temporary_payment_failure
- insufficient_funds
- checkout_abandonment
- unknown_failure

Choose exactly ONE recommended action from:
- RETRY_WITH_UPI
- RETRY_WITH_CARD
- RETRY_WITH_NETBANKING
- RETRY_WITH_WALLET

Hard rule: if Previously attempted payment method is not unknown, the recommended action MUST use a different payment method.
Reason using concrete evidence from the error, attempted method, and history. Do not invent facts.
Return JSON only.
`;

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: geminiPrompt }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                diagnosis: { type: "STRING" },
                confidence: { type: "NUMBER" },
                evidence: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                recommended_action: { type: "STRING" },
                recommendation_confidence: { type: "NUMBER" }
              },
              required: [
                "diagnosis",
                "confidence",
                "evidence",
                "recommended_action",
                "recommendation_confidence"
              ]
            }
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      return fallbackDiagnosis;
    }

    const aiData = await geminiResponse.json();
    const text = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return fallbackDiagnosis;
    }

    const parsed = JSON.parse(text);

    const diagnosis = VALID_DIAGNOSES.includes(parsed?.diagnosis)
      ? parsed.diagnosis
      : "unknown_failure";

    const parsedConfidence = Number(parsed?.confidence);
    const confidence = Number.isFinite(parsedConfidence)
      ? Math.max(0, Math.min(1, parsedConfidence))
      : 0.5;

    const evidence = Array.isArray(parsed?.evidence)
      ? parsed.evidence
          .filter((item: unknown) => typeof item === "string")
          .slice(0, 10)
      : [];

    const recommendedAction =
      VALID_ACTION_RECOMMENDATIONS.includes(parsed?.recommended_action)
        ? parsed.recommended_action
        : null;

    const recommendationConfidenceNumber = Number(
      parsed?.recommendation_confidence
    );

    const recommendationConfidence = Number.isFinite(
      recommendationConfidenceNumber
    )
      ? Math.max(0, Math.min(1, recommendationConfidenceNumber))
      : 0.5;

    const deterministicRankingForDiagnosis =
      deterministicMethodPreference(
        diagnosis,
        params.rawErrorCode,
        params.rawErrorMessage,
        params.failedPaymentMethod,
        params.userHistory
      );

    const rankedActions = deterministicRankingForDiagnosis.map((item) => ({
      action: actionForMethod(item.method),
      method: item.method,
      probability: item.probability,
      reason: item.reason
    }));

    // Put the AI recommendation first only when it is compatible with
    // the deterministic safety layer. Otherwise keep the deterministic
    // ranking as the source of truth.
    const aiActionMethod = recommendedAction
      ? methodForAction(recommendedAction)
      : null;

    const aiCompatible =
      !!recommendedAction &&
      !!aiActionMethod &&
      aiActionMethod !== failedMethod &&
      rankedActions.some(
        (item) =>
          item.action === recommendedAction &&
          Number(item.probability) >= 0.20
      );

    if (aiCompatible) {
      const aiItem = rankedActions.find(
        (item) => item.action === recommendedAction
      );

      if (aiItem) {
        aiItem.probability = Math.min(
          0.99,
          Math.max(
            Number(aiItem.probability),
            recommendationConfidence
          )
        );
        aiItem.reason = `AI recommendation: ${aiItem.reason}`;
      }

      rankedActions.sort(
        (a, b) => Number(b.probability) - Number(a.probability)
      );
    }

    return {
      diagnosis,
      confidence,
      evidence,
      recommended_action:
        aiCompatible
          ? recommendedAction
          : rankedActions[0]?.action || null,
      recommendation_confidence:
        aiCompatible
          ? recommendationConfidence
          : Number(rankedActions[0]?.probability || 0),
      method_ranking: rankedActions.slice(0, 4)
    };
  } catch (error) {
    console.warn(
      "Gemini diagnosis failed. Using deterministic fallback.",
      error
    );

    return fallbackDiagnosis;
  }
}

// =========================================================
// GENERATE CANDIDATE ACTIONS
// =========================================================

function generateCandidateActions(
  diagnosis: string,
  transactionAmount: number,
  confidence: number,
  failedPaymentMethod: string | null,
  aiRecommendation: string | null,
  methodRanking: Array<Record<string, unknown>>
) {
  const candidateActions: any[] = [];

  const ranking =
    methodRanking.length > 0
      ? methodRanking
      : deterministicMethodPreference(
          diagnosis,
          null,
          null,
          failedPaymentMethod,
          {}
        ).map((item) => ({
          action: actionForMethod(item.method),
          method: item.method,
          probability: item.probability,
          reason: item.reason
        }));

  for (const item of ranking) {
    const type = item.action;
    const probability = Number(item.probability);

    // Never queue an immediate retry using the exact method that just failed.
    if (
      failedPaymentMethod &&
      methodForAction(String(type)) === failedPaymentMethod
    ) {
      continue;
    }

    if (
      typeof type !== "string" ||
      !EXECUTABLE_ACTION_TYPES.includes(type as RecoveryActionType) ||
      !Number.isFinite(probability)
    ) {
      continue;
    }

    const adjustedProbability = Math.max(
      0,
      Math.min(0.99, probability)
    );

    const isAiPick = type === aiRecommendation;

    candidateActions.push({
      type,
      method: methodForAction(type),
      base_probability: adjustedProbability,
      diagnosis_confidence: confidence,
      expected_value:
        transactionAmount *
        adjustedProbability *
        Math.max(0.25, confidence),
      executable: true,
      ai_recommended: isAiPick,
      reason:
        isAiPick
          ? `AI selected this as the preferred recovery route. ${String(item.reason || "")}`
          : String(item.reason || "Alternate payment route.")
    });
  }

  // De-duplicate action types in case the ranking contained duplicates.
  const unique = new Map<string, any>();
  for (const action of candidateActions) {
    const existing = unique.get(action.type);
    if (!existing || action.expected_value > existing.expected_value) {
      unique.set(action.type, action);
    }
  }

  const actions = Array.from(unique.values());

  // AI recommendation is a signal, not an unconditional override.
  // The final ranking remains driven by expected recovery value, with
  // only a confidence-weighted boost for the AI's preferred route.
  for (const action of actions) {
    const aiBoost =
      action.ai_recommended
        ? 1 + (0.15 * Math.max(0, Math.min(1, confidence)))
        : 1;

    action.selection_score =
      action.expected_value * aiBoost;
  }

  actions.sort(
    (a, b) =>
      b.selection_score -
      a.selection_score
  );

  return actions;
}

// =========================================================
// NORMALIZE RAZORPAY / INTERNAL WEBHOOK PAYLOAD
// =========================================================
//
// The recovery function can be called either by the internal
// handle-webhook bridge (flat payload) or directly with a Razorpay
// payment.failed payload (nested payload.payment.entity).
//
// The most important field here is the ACTUAL failed payment method.
// Without extracting payment.entity.method, every unknown failure can
// fall back to UPI even when the customer actually failed with CARD.
// =========================================================

function extractWebhookContext(body: any) {
  const paymentEntity =
    body?.payload?.payment?.entity ||
    body?.payment?.entity ||
    body?.data?.payment?.entity ||
    {};

  const errorObject =
    paymentEntity?.error ||
    body?.payload?.payment?.entity?.error ||
    body?.error ||
    {};

  const extractedOrderId =
    body?.order_id ||
    body?.payload?.payment?.entity?.order_id ||
    body?.payment?.entity?.order_id ||
    body?.data?.payment?.entity?.order_id ||
    body?.payload?.order?.entity?.id ||
    null;

  const extractedPaymentMethod =
    body?.failed_payment_method ||
    body?.payment_method ||
    paymentEntity?.method ||
    body?.payload?.payment?.entity?.method ||
    body?.data?.payment?.entity?.method ||
    null;

  const extractedErrorCode =
    body?.raw_error_code ||
    paymentEntity?.error_code ||
    errorObject?.code ||
    body?.payload?.payment?.entity?.error_code ||
    null;

  const extractedErrorMessage =
    body?.raw_error_message ||
    paymentEntity?.error_description ||
    errorObject?.description ||
    errorObject?.reason ||
    body?.payload?.payment?.entity?.error_description ||
    null;

  return {
    order_id: extractedOrderId,
    user_id:
      body?.user_id ||
      paymentEntity?.notes?.user_id ||
      null,
    campus_id:
      body?.campus_id ||
      paymentEntity?.notes?.campus_id ||
      null,
    cart_id:
      body?.cart_id ||
      paymentEntity?.notes?.cart_id ||
      null,
    event_type:
      body?.event_type ||
      body?.event ||
      "payment.failed",
    raw_error_code: extractedErrorCode,
    raw_error_message: extractedErrorMessage,
    user_history: body?.user_history || {},
    failed_payment_method: normalizePaymentMethod(extractedPaymentMethod),
    razorpay_payment_id:
      paymentEntity?.id ||
      body?.payment_id ||
      null
  };
}

// =========================================================
// MAIN EDGE FUNCTION
// =========================================================

serve(async (req) => {
  try {

    // =======================================================
    // 1. METHOD CHECK
    // =======================================================

    if (req.method !== "POST") {
      return jsonResponse(
        {
          success: false,

          error:
            "Only POST requests are allowed."
        },
        405
      );
    }

    // =======================================================
    // 2. PARSE REQUEST BODY
    // =======================================================

    let body: any;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          success: false,

          error:
            "Request body must be valid JSON."
        },
        400
      );
    }

    const webhookContext =
      extractWebhookContext(body);

    const {
      order_id,
      user_id,
      campus_id,
      cart_id,
      event_type,
      raw_error_code,
      raw_error_message,
      user_history,
      failed_payment_method
    } = webhookContext;

    // =======================================================
    // 4. VALIDATE ORDER ID
    // =======================================================

    if (!isValidUuid(order_id)) {
      return jsonResponse(
        {
          success: false,

          error:
            "Valid order_id UUID is required."
        },
        400
      );
    }

    const validOrderId =
      order_id;

    // =======================================================
    // 5. OPTIONAL IDS
    // =======================================================

    const validUserId =
      isValidUuid(user_id)
        ? user_id
        : null;

    const validCampusId =
      isValidUuid(campus_id)
        ? campus_id
        : null;

    const validCartId =
      isValidUuid(cart_id)
        ? cart_id
        : null;

    // =======================================================
    // 6. FETCH TRUSTED ORDER
    // =======================================================

    const order =
      await fetchTrustedOrder(
        validOrderId
      );

    if (!order) {
      return jsonResponse(
        {
          success: false,

          error:
            "Original order not found."
        },
        404
      );
    }

    // =======================================================
    // 7. NEVER TRUST CLIENT IDS WHEN ORDER HAS TRUSTED DATA
    // =======================================================

    const effectiveUserId =
      isValidUuid(order.user_id)
        ? order.user_id
        : validUserId;

    const effectiveCampusId =
      isValidUuid(order.campus_id)
        ? order.campus_id
        : validCampusId;

    // =======================================================
    // 8. TRUSTED TRANSACTION AMOUNT
    // =======================================================

    const transactionAmount =
      safePositiveNumber(
        order.total
      );

    if (
      transactionAmount ===
      null
    ) {
      return jsonResponse(
        {
          success: false,

          error:
            "Original order has an invalid total."
        },
        400
      );
    }

    // =======================================================
    // 9. FETCH POLICY
    // =======================================================

    const policy =
      await fetchPolicy(
        effectiveCampusId
      );

    const recoveryEnabled =
      Boolean(
        policy.is_recovery_enabled
      );

    const minCartValue =
      Number(
        policy.min_cart_value ??
        DEFAULT_POLICY.min_cart_value
      );

    const maxRetries =
      Number(
        policy.max_retries_per_user ??
        DEFAULT_POLICY.max_retries_per_user
      );

    const dailyBudgetUsed =
      Number(
        policy.daily_budget_used ??
        DEFAULT_POLICY.daily_budget_used
      );

    const dailyBudgetLimit =
      Number(
        policy.max_daily_discount_budget ??
        DEFAULT_POLICY.max_daily_discount_budget
      );

    // =======================================================
    // 10. SAFE RETRY COUNT
    // =======================================================

    const safeRetryCount =
      Number.isFinite(
        Number(
          user_history?.retry_count
        )
      )
        ? Math.max(
            0,
            Math.floor(
              Number(
                user_history?.retry_count
              )
            )
          )
        : 0;

    // =======================================================
    // 11. DETERMINE WHETHER ORDER IS ALREADY PAID
    // =======================================================

    const orderAlreadyPaid =
      order.payment_status ===
        "completed" ||
      order.status ===
        "confirmed" ||
      order.status ===
        "collected";

    // =======================================================
    // 12. AI DIAGNOSIS
    // =======================================================

    let aiDiagnosis;

    if (orderAlreadyPaid) {

      aiDiagnosis = {
        diagnosis:
          "unknown_failure",

        confidence: 1,

        evidence: [
          "Recovery skipped because the original order is already paid."
        ],

        recommended_action: null,

        recommendation_confidence: 1,

        method_ranking: []
      };

    } else {

      aiDiagnosis =
        await diagnoseFailure({
          rawErrorCode:
            safeString(
              raw_error_code,
              200
            ),

          rawErrorMessage:
            safeString(
              raw_error_message,
              1000
            ),

          transactionAmount,

          userHistory:
            user_history || {},

          failedPaymentMethod:
            failed_payment_method
        });
    }

    console.log(
      "[Revenue Recovery] Payment failure context:",
      {
        order_id: validOrderId,
        failed_payment_method: failed_payment_method || "unknown",
        raw_error_code: raw_error_code || null,
        raw_error_message: raw_error_message || null
      }
    );

    // =======================================================
    // 13. NORMALIZE AI CONFIDENCE
    // =======================================================

    const confidence =
      Math.max(
        0,
        Math.min(
          1,
          Number(
            aiDiagnosis.confidence
          ) || 0
        )
      );

    // =======================================================
    // 14. GENERATE CANDIDATE ACTIONS
    // =======================================================

    const candidateActions =
      orderAlreadyPaid
        ? []
        : generateCandidateActions(
            aiDiagnosis.diagnosis,
            transactionAmount,
            confidence,
            failed_payment_method,
            aiDiagnosis.recommended_action || null,
            Array.isArray(aiDiagnosis.method_ranking)
              ? aiDiagnosis.method_ranking
              : []
          );

    // =======================================================
    // 15. FILTER EXECUTABLE ACTIONS
    // =======================================================

    const executableActions =
      candidateActions.filter(
        action =>
          EXECUTABLE_ACTION_TYPES.includes(
            action.type
          )
      );

    executableActions.sort(
      (a, b) =>
        b.expected_value -
        a.expected_value
    );

    const bestAction =
      executableActions.length >
      0
        ? executableActions[0]
        : null;

    // =======================================================
    // 16. CALCULATE RECOVERY SCORE
    // =======================================================

    const recoveryScore =
      bestAction
        ? Number(
            bestAction.expected_value
          )
        : 0;

    // =======================================================
    // 17. POLICY DECISION
    // =======================================================

    let decision = "PENDING";

    let stopReason:
      string | null = null;

    if (orderAlreadyPaid) {

      decision = "STOP";

      stopReason =
        "Original order is already paid.";

    } else if (!recoveryEnabled) {

      decision = "STOP";

      stopReason =
        "Recovery globally disabled by merchant.";

    } else if (
      transactionAmount <
      minCartValue
    ) {

      decision = "STOP";

      stopReason =
        "Cart value below minimum threshold.";

    } else if (
      safeRetryCount >=
      maxRetries
    ) {

      decision = "STOP";

      stopReason =
        "Maximum recovery attempts reached.";

    } else if (
      dailyBudgetUsed >=
      dailyBudgetLimit
    ) {

      decision = "STOP";

      stopReason =
        "Daily recovery discount budget exceeded.";

    } else if (!bestAction) {

      decision = "STOP";

      stopReason =
        "No currently executable recovery intervention identified.";

    } else if (
      recoveryScore <
      MIN_RECOVERY_SCORE
    ) {

      decision = "STOP";

      stopReason =
        "Expected recovery value below minimum threshold.";

    } else {

      decision =
        bestAction.type;
    }

    // =======================================================
    // 18. COMPLIANT ESCALATION
    // =======================================================
    //
    // IMPORTANT:
    //
    // Escalation happens ONLY when the decision is STOP.
    //
    // It does NOT:
    // - retry payment
    // - create recovery action
    // - call executor
    // - override STOP
    //
    // It ONLY records that human/manual review is required.
    // =======================================================

    const complianceEscalation =
      decision === "STOP"
        ? buildComplianceEscalation(
            stopReason
          )
        : null;

    // =======================================================
    // 19. POLICY EVALUATION AUDIT
    // =======================================================

    const policyEvaluation = {

      retry_count:
        safeRetryCount,

      max_retries:
        maxRetries,

      recovery_enabled:
        recoveryEnabled,

      min_cart_value:
        minCartValue,

      daily_budget_used:
        dailyBudgetUsed,

      daily_budget_limit:
        dailyBudgetLimit,

      original_order_paid:
        orderAlreadyPaid,

      failed_payment_method:
        failed_payment_method,

      selected_intervention:
        bestAction
          ? bestAction.type
          : null,

      selected_intervention_method:
        bestAction?.method || null,

      ai_recommended_intervention:
        aiDiagnosis.recommended_action || null,

      intervention_candidates:
        candidateActions.map((action) => ({
          type: action.type,
          method: action.method,
          base_probability: Number(action.base_probability),
          expected_value: Number(action.expected_value.toFixed(2)),
          selection_score: Number((action.selection_score ?? action.expected_value).toFixed(2)),
          ai_recommended: action.ai_recommended === true,
          reason: action.reason
        })),

      compliance_escalation:
        complianceEscalation
    };

    // =======================================================
    // 20. SELECTED ACTION
    // =======================================================

    const selectedAction =
      decision !== "STOP" &&
      bestAction
        ? bestAction.type
        : null;

    // =======================================================
    // 21. INITIAL AUDIT ACTION
    // =======================================================

    const initialActionExecuted =
      decision !== "STOP" &&
      bestAction
        ? {

            type:
              "INTERVENTION_QUEUED",

            strategy:
              bestAction.type,

            expected_recovery_value:
              Number(
                bestAction.expected_value
                  .toFixed(2)
              ),

            method:
              bestAction.method || null,

            ai_recommended:
              bestAction.ai_recommended === true,

            reason:
              bestAction.reason

          }
        : {

            type:
              complianceEscalation
                ? "COMPLIANT_ESCALATION"
                : "NO_INTERVENTION",

            reason:
              stopReason,

            ...(complianceEscalation
              ? {
                  escalation:
                    complianceEscalation
                }
              : {})

          };

    // =======================================================
    // 22. CREATE RECOVERY AUDIT LOG
    // =======================================================

    const logEntry =
      await insertRecoveryLog({

        campusId:
          effectiveCampusId,

        orderId:
          validOrderId,

        cartId:
          validCartId,

        userId:
          effectiveUserId,

        eventType:
          safeString(
            event_type,
            100
          ) ||
          "payment.failed",

        rawErrorCode:
          safeString(
            raw_error_code,
            200
          ),

        rawErrorMessage:
          safeString(
            raw_error_message,
            1000
          ),

        aiDiagnosis,

        recoveryScore:
          Number(
            recoveryScore.toFixed(2)
          ),

        policyEvaluation,

        decision,

        selectedAction,

        actionExecuted:
          initialActionExecuted,

        status:
          decision === "STOP"
            ? "STOPPED"
            : "PENDING",

        stopReason,

        attemptCount:
          safeRetryCount,

        originalAmount:
          transactionAmount,

        expectedRecoveryValue:
          Number(
            recoveryScore.toFixed(2)
          ),

        escalationStatus:
          decision === "STOP"
            ? "PENDING"
            : "NONE",

        escalatedAt:
          decision === "STOP"
            ? String(
                complianceEscalation?.escalated_at ||
                complianceEscalation?.created_at ||
                new Date().toISOString()
              )
            : null,

        reviewedAt: null,

        resolvedAt: null,

        resolutionReason: null

      });

    // =======================================================
    // 22A. ASSIGN RECOVERY CASE TO BOUNDED BATCH
    // =======================================================
    // The database function atomically assigns this new recovery
    // case to the newest batch with room. If the current batch is
    // full, it creates the next batch automatically.

    const {
      data: batchAssignment,
      error: batchAssignmentError
    } = await supabase.rpc(
      "assign_recovery_case_to_batch",
      {
        p_log_id: logEntry.id,
        p_max_cases: 50
      }
    );

    if (batchAssignmentError) {
      console.error(
        "Recovery batch assignment failed:",
        batchAssignmentError
      );
      throw batchAssignmentError;
    }

    console.log(
      "[Revenue Recovery] Case assigned to batch:",
      batchAssignment?.[0] || null
    );

    // =======================================================
    // 23. ACTION ID
    // =======================================================

    let actionId:
      string | null = null;

    // =======================================================
    // 24. QUEUE AUTOMATED RECOVERY ACTION
    // =======================================================
    //
    // CRITICAL:
    //
    // This block executes ONLY when decision !== STOP.
    //
    // Therefore a compliant escalation can NEVER accidentally
    // create a recovery action.
    // =======================================================

    if (
      decision !== "STOP" &&
      bestAction
    ) {

      const {
        data: queuedAction,
        error: actionError
      } = await supabase
        .from(
          "revenue_recovery_actions"
        )
        .insert({

          log_id:
            logEntry.id,

          user_id:
            effectiveUserId,

          order_id:
            validOrderId,

          campus_id:
            effectiveCampusId,

          action_type:
            bestAction.type,

          status:
            "PENDING",

          expected_recovery_value:
            Number(
              bestAction.expected_value
                .toFixed(2)
            ),

          attempt_count:
            0

        })
        .select()
        .single();

      // =====================================================
      // 25. ACTION QUEUE FAILURE
      // =====================================================

      if (actionError) {

        console.error(
          "Recovery action queue error:",
          actionError
        );

        await supabase
          .from(
            "revenue_recovery_logs"
          )
          .update({

            status:
              "FAILED",

            recovery_state:
              "QUEUE_FAILED",

            action_executed: {

              type:
                "INTERVENTION_QUEUE_FAILED",

              error:
                actionError.message

            },

            stop_reason:
              "Recovery intervention could not be queued.",

            updated_at:
              new Date().toISOString()

          })
          .eq(
            "id",
            logEntry.id
          );

        throw actionError;
      }

      // =====================================================
      // 26. ACTION ID
      // =====================================================

      actionId =
        queuedAction.id;

      // =====================================================
      // 27. UPDATE LOG
      // =====================================================

      await updateLogAfterQueue(

        logEntry.id,

        actionId,

        bestAction.type,

        Number(
          bestAction.expected_value
            .toFixed(2)
        ),

        bestAction.reason

      );
    }

    // =======================================================
    // 28. TRIGGER EXECUTOR
    // =======================================================
    //
    // CRITICAL COMPLIANCE BOUNDARY:
    //
    // Executor is called ONLY when actionId exists.
    //
    // STOP + COMPLIANT_ESCALATION
    //        ↓
    // actionId = null
    //        ↓
    // executor NOT called
    //
    // This prevents escalation cases from being automated.
    // =======================================================

    if (actionId) {

      console.log(
        `[Bridge] Pinging Executor for Action: ${actionId}`
      );

      fetch(
        `${SUPABASE_URL}/functions/v1/revenue-recovery-executor`,
        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body: JSON.stringify({

            action_id:
              actionId

          })

        }
      ).catch(
        (err) => {

          console.error(
            "Failed to trigger Executor:",
            err
          );

        }
      );
    }

    // =======================================================
    // 29. FINAL RESPONSE
    // =======================================================

    return jsonResponse({

      success:
        true,

      decision,

      log_id:
        logEntry.id,

      action_id:
        actionId,

      order_id:
        validOrderId,

      transactionAmount,

      aiDiagnosis,

      recoveryScore:
        Number(
          recoveryScore.toFixed(2)
        ),

      selectedAction,

      selectedActionMethod:
        bestAction?.method || null,

      selectedActionReason:
        bestAction?.reason || null,

      interventionCandidates:
        candidateActions.map((action) => ({
          type: action.type,
          method: action.method,
          base_probability: Number(action.base_probability),
          expected_value: Number(action.expected_value.toFixed(2)),
          selection_score: Number((action.selection_score ?? action.expected_value).toFixed(2)),
          ai_recommended: action.ai_recommended === true,
          reason: action.reason
        })),

      stopReason,

      complianceEscalation

    });

  } catch (error) {

    console.error(
      "Revenue recovery webhook error:",
      error
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error";

    return jsonResponse(
      {
        success: false,

        error:
          errorMessage
      },
      500
    );
  }
});