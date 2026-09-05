import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock3,
  XCircle,
  Loader2,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  TrendingUp,
  Layers3,
  Zap,
  Timer,
  CircleDollarSign,
  ChevronDown,
  ChevronUp,
  Octagon,
  Ban,
  ShieldX,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* =========================================================
   TYPES
   ========================================================= */

interface RecoveryLog {
  id: string;
  campus_id: string | null;
  order_id: string | null;
  cart_id: string | null;
  user_id: string | null;

  event_type: string | null;
  raw_error_code: string | null;
  raw_error_message: string | null;

  ai_diagnosis: any;
  recovery_score: number | null;
  policy_evaluation: any;
  decision: string | null;
  action_executed: any;

  status: string | null;
  recovered_amount: number | null;
  stop_reason: string | null;
  created_at: string;
  updated_at: string | null;

  // Escalation lifecycle fields persisted by the recovery backend.
  escalation_status: string | null;
  escalated_at: string | null;
  reviewed_at: string | null;
  resolved_at: string | null;
  resolution_reason: string | null;

  recovery_state: string | null;
  attempt_count: number | null;
  selected_action: string | null;

  action_started_at: string | null;
  action_completed_at: string | null;

  original_amount: number | null;
  intervention_cost: number | null;
  expected_recovery_value: number | null;
}

interface RecoveryAction {
  id: string;
  log_id: string | null;
  user_id: string | null;
  order_id: string | null;
  campus_id: string | null;

  action_type: string;
  status: string;

  expected_recovery_value: number | null;
  attempt_count: number | null;

  scheduled_at: string | null;
  executed_at: string | null;

  result: any;

  created_at: string;

  razorpay_payment_link_id: string | null;
  razorpay_payment_link_url: string | null;
}

interface RecoveryCase {
  log: RecoveryLog;
  action: RecoveryAction | null;
}

interface RecoveryBatch {
  id: string;
  batch_number: string;
  status: string;
  total_cases: number;
  total_amount_at_risk: number;
  total_recovered_amount: number;
  recovery_rate: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface RecoveryAuditEvent {
  title: string;
  status: string;
  timestamp: string | null;
  evidence: string;
  source: string;
}

/* =========================================================
   ESCALATION TYPES
   ========================================================= */

type EscalationStatus =
  | "NONE"
  | "PENDING"
  | "ACTIVE"
  | "RESOLVED"
  | "REJECTED"
  | "FAILED"
  | "UNKNOWN";

interface EscalationInfo {
  required: boolean;
  level: string;
  status: EscalationStatus;
  reason: string;
  action: string;
  policy: string;
  escalatedAt: string | null;
  resolvedAt: string | null;
  reviewedAt: string | null;
  resolutionReason: string | null;
}

/* =========================================================
   STOPPING RULE TYPES
   ========================================================= */

type StoppingRuleCode =
  | "NONE"
  | "RECOVERY_SUCCESS"
  | "MAX_ATTEMPTS"
  | "COMPLIANCE_ESCALATION"
  | "FAILED_ACTION"
  | "CANCELLED"
  | "EXPLICIT_STOP"
  | "PAYMENT_CONFIRMED"
  | "POLICY_BLOCK"
  | "RECOVERY_DISABLED"
  | "MIN_CART_VALUE"
  | "DAILY_BUDGET"
  | "NO_INTERVENTION"
  | "LOW_RECOVERY_VALUE"
  | "UNKNOWN_STOP";

interface StoppingRuleInfo {
  stopped: boolean;
  code: StoppingRuleCode;
  title: string;
  reason: string;
  source: string;
  terminal: boolean;
  attemptCount: number;
  maxAttempts: number | null;
}

/* =========================================================
   EXECUTION / FUND ROUTING AUDIT
   ========================================================= */

interface ExecutionAuditInfo {
  mode: string;
  channel: string;
  executorBlocked: boolean | null;
  automatedActionBlocked: boolean | null;
  auditRequired: boolean | null;
  intervention: string;
  reason: string;
  financialExecution: string | null;
  error: string | null;
  source: string;
}

/*
 * Dashboard-side safety limit.
 *
 * IMPORTANT:
 * This does NOT execute or mutate the recovery process.
 * It only allows the dashboard to correctly classify a case
 * whose attempt count has reached the configured maximum.
 *
 * Keep this aligned with the backend stopping-rule policy.
 */


/* =========================================================
   HELPERS
   ========================================================= */

const money = (
  value: number | null | undefined
) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (
  value: string | null | undefined
) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatTime = (value: Date) =>
  value.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const normalize = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const shortId = (
  value: string | null | undefined,
  length = 8
) => {
  if (!value) return "—";

  return `${value.slice(0, length)}...`;
};

const getObjectValue = (
  object: any,
  keys: string[]
) => {
  if (!object || typeof object !== "object") {
    return undefined;
  }

  for (const key of keys) {
    if (
      object[key] !== undefined &&
      object[key] !== null
    ) {
      return object[key];
    }
  }

  return undefined;
};

/* =========================================================
   STATUS HELPERS
   ========================================================= */

const SUCCESS_STATUSES = [
  "SUCCESS",
  "RECOVERED",
  "COMPLETED",
];

const PENDING_STATUSES = [
  "PENDING",
  "PROCESSING",
  "ACTION_QUEUE",
  "ACTION_QUEUED",
  "AWAITING_PAYMENT",
];

const FAILED_STATUSES = [
  "FAILED",
  "STOPPED",
  "CANCELLED",
];

const isSuccessStatus = (
  status: unknown
) =>
  SUCCESS_STATUSES.includes(
    normalize(status)
  );

const isPendingStatus = (
  status: unknown
) =>
  PENDING_STATUSES.includes(
    normalize(status)
  );

const isFailedStatus = (
  status: unknown
) =>
  FAILED_STATUSES.includes(
    normalize(status)
  );

const getStatusClass = (
  status: string | null | undefined
) => {
  const value = normalize(status);

  if (isSuccessStatus(value)) {
    return "recovery-status recovery-status-success";
  }

  if (isPendingStatus(value)) {
    return "recovery-status recovery-status-pending";
  }

  if (isFailedStatus(value)) {
    return "recovery-status recovery-status-danger";
  }

  return "recovery-status recovery-status-neutral";
};

const getStatusIcon = (
  status: string | null | undefined
) => {
  const value = normalize(status);

  if (isSuccessStatus(value)) {
    return <CheckCircle2 size={13} />;
  }

  if (isPendingStatus(value)) {
    return <Clock3 size={13} />;
  }

  if (isFailedStatus(value)) {
    return <XCircle size={13} />;
  }

  return <Activity size={13} />;
};

/* =========================================================
   COMPLIANCE ESCALATION PARSER
   ========================================================= */

const getEscalationInfo = (
  log: RecoveryLog
): EscalationInfo => {
  const policy = log.policy_evaluation;

  const nestedEscalation = getObjectValue(policy, [
    "compliance_escalation",
    "complianceEscalation",
    "escalation",
    "escalation_result",
    "escalationResult",
  ]);

  const source =
    nestedEscalation &&
    typeof nestedEscalation === "object"
      ? nestedEscalation
      : policy;

  const requiredValue = getObjectValue(source, [
    "required",
    "escalation_required",
    "escalationRequired",
    "requires_escalation",
    "requiresEscalation",
  ]);

  const levelValue = getObjectValue(source, [
    "level",
    "escalation_level",
    "escalationLevel",
  ]);

  // New lifecycle columns are the source of truth.
  // Nested JSON remains a backward-compatible fallback for older logs.
  const lifecycleStatusValue =
    log.escalation_status ??
    getObjectValue(source, [
      "status",
      "escalation_status",
      "escalationStatus",
    ]);

  const statusValue = lifecycleStatusValue;

  const reasonValue = getObjectValue(source, [
    "reason",
    "escalation_reason",
    "escalationReason",
    "trigger_reason",
    "triggerReason",
  ]);

  const actionValue = getObjectValue(source, [
    "action",
    "escalation_action",
    "escalationAction",
    "required_action",
    "requiredAction",
  ]);

  const policyValue = getObjectValue(source, [
    "policy",
    "policy_name",
    "policyName",
    "policy_rule",
    "policyRule",
    "type",
    "escalation_type",
    "escalationType",
  ]);

  const escalatedAtValue =
    log.escalated_at ??
    getObjectValue(source, [
      "escalated_at",
      "escalatedAt",
      "created_at",
      "createdAt",
    ]);

  const reviewedAtValue =
    log.reviewed_at ??
    getObjectValue(source, [
      "reviewed_at",
      "reviewedAt",
    ]);

  const resolvedAtValue =
    log.resolved_at ??
    getObjectValue(source, [
      "resolved_at",
      "resolvedAt",
    ]);

  const resolutionReasonValue =
    log.resolution_reason ??
    getObjectValue(source, [
      "resolution_reason",
      "resolutionReason",
    ]);

  const required =
    requiredValue === true ||
    normalize(requiredValue) === "TRUE" ||
    normalize(requiredValue) === "YES";

  const normalizedStatus = normalize(statusValue);

  let status: EscalationStatus = "NONE";

  if (required) {
    if (normalizedStatus === "PENDING") {
      status = "PENDING";
    } else if (normalizedStatus === "ACTIVE") {
      status = "ACTIVE";
    } else if (normalizedStatus === "RESOLVED") {
      status = "RESOLVED";
    } else if (normalizedStatus === "REJECTED") {
      status = "REJECTED";
    } else if (normalizedStatus === "FAILED") {
      status = "FAILED";
    } else {
      status = "PENDING";
    }
  }

  return {
    required,
    level: levelValue
      ? normalize(levelValue)
      : required
      ? "ESCALATED"
      : "NONE",

    status,

    reason: reasonValue
      ? String(reasonValue)
      : required
      ? "Compliance escalation required"
      : "No compliance escalation",

    action: actionValue
      ? String(actionValue)
      : required
      ? "Review required"
      : "—",

    policy: policyValue
      ? String(policyValue)
      : "—",

    escalatedAt: escalatedAtValue
      ? String(escalatedAtValue)
      : required
      ? String(
          getObjectValue(source, ["created_at", "createdAt"]) || ""
        ) || null
      : null,

    resolvedAt: resolvedAtValue
      ? String(resolvedAtValue)
      : null,

    reviewedAt: reviewedAtValue
      ? String(reviewedAtValue)
      : null,

    resolutionReason: resolutionReasonValue
      ? String(resolutionReasonValue)
      : "—",
  };
};

/* =========================================================
   STOPPING RULE ENGINE
   ========================================================= */

const getStoppingRuleInfo = (
  log: RecoveryLog,
  action: RecoveryAction | null
): StoppingRuleInfo => {
  const policy = log.policy_evaluation;
  const state = normalize(log.recovery_state);
  const logStatus = normalize(log.status);
  const actionStatus = normalize(action?.status);
  const decision = normalize(log.decision);

  const attemptCount = Math.max(
    Number(log.attempt_count ?? action?.attempt_count ?? 0),
    0
  );

  // IMPORTANT: the webhook's real policy field is max_retries_per_user,
  // and the persisted policy_evaluation stores it as max_retries.
  const configuredMaxRetries = Number(
    getObjectValue(policy, [
      "max_retries",
      "max_retries_per_user",
      "maxRetries",
      "maxRetriesPerUser",
      "max_attempts",
      "maxAttempts",
    ])
  );

  const maxAttempts =
    Number.isFinite(configuredMaxRetries) && configuredMaxRetries > 0
      ? configuredMaxRetries
      : null;

  const stopReasonValue =
    log.stop_reason ||
    getObjectValue(policy, [
      "stop_reason",
      "stopReason",
      "stopping_reason",
      "stoppingReason",
    ]);

  const stopReason = stopReasonValue
    ? String(stopReasonValue)
    : null;

  const escalation = getEscalationInfo(log);

  const reasonText = normalize(stopReason);
  const rawActionError = action?.result?.error;

  // The webhook writes decision=STOP and a specific stop_reason for every
  // deterministic stopping decision. Classify from that persisted audit data
  // instead of inventing a dashboard-only rule.
  if (
    reasonText.includes("ALREADY PAID") ||
    reasonText.includes("ALREADY") && reasonText.includes("PAID")
  ) {
    return {
      stopped: true,
      code: "PAYMENT_CONFIRMED",
      title: "Original Order Already Paid",
      reason: stopReason!,
      source: "Webhook policy evaluation",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  if (reasonText.includes("GLOBALLY DISABLED")) {
    return {
      stopped: true,
      code: "RECOVERY_DISABLED",
      title: "Recovery Disabled",
      reason: stopReason!,
      source: "Merchant recovery policy",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  if (reasonText.includes("BELOW MINIMUM THRESHOLD") ||
      reasonText.includes("MINIMUM THRESHOLD")) {
    return {
      stopped: true,
      code: "MIN_CART_VALUE",
      title: "Below Minimum Cart Value",
      reason: stopReason!,
      source: "Merchant recovery policy",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  if (reasonText.includes("MAXIMUM RECOVERY ATTEMPTS") ||
      reasonText.includes("MAXIMUM") && reasonText.includes("ATTEMPT")) {
    return {
      stopped: true,
      code: "MAX_ATTEMPTS",
      title: "Maximum Recovery Attempts Reached",
      reason: stopReason!,
      source: "Merchant recovery policy",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  if (reasonText.includes("DAILY RECOVERY DISCOUNT BUDGET")) {
    return {
      stopped: true,
      code: "DAILY_BUDGET",
      title: "Daily Recovery Budget Exceeded",
      reason: stopReason!,
      source: "Merchant recovery policy",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  if (reasonText.includes("NO CURRENTLY EXECUTABLE")) {
    return {
      stopped: true,
      code: "NO_INTERVENTION",
      title: "No Executable Recovery Intervention",
      reason: stopReason!,
      source: "Recovery action policy",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  if (reasonText.includes("EXPECTED RECOVERY VALUE BELOW")) {
    return {
      stopped: true,
      code: "LOW_RECOVERY_VALUE",
      title: "Expected Recovery Value Below Threshold",
      reason: stopReason!,
      source: "Recovery scoring policy",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  if (
    escalation.required &&
    (escalation.status === "PENDING" || escalation.status === "ACTIVE")
  ) {
    return {
      stopped: true,
      code: "COMPLIANCE_ESCALATION",
      title: "Compliance Escalation",
      reason: escalation.reason,
      source: "Compliance policy",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  if (
    state === "RECOVERED" ||
    logStatus === "RECOVERED" ||
    logStatus === "SUCCESS" ||
    logStatus === "COMPLETED" ||
    actionStatus === "SUCCESS" ||
    actionStatus === "RECOVERED" ||
    actionStatus === "COMPLETED" ||
    Number(log.recovered_amount || 0) > 0
  ) {
    return {
      stopped: true,
      code: "RECOVERY_SUCCESS",
      title: "Recovery Successful",
      reason: "Payment recovery completed successfully.",
      source: "Recovery result",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  if (logStatus === "CANCELLED" || actionStatus === "CANCELLED") {
    return {
      stopped: true,
      code: "CANCELLED",
      title: "Recovery Cancelled",
      reason: stopReason || "Recovery processing was cancelled.",
      source: "Recovery status",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  if (
    state === "STOPPED" ||
    logStatus === "STOPPED" ||
    actionStatus === "STOPPED" ||
    decision === "STOP"
  ) {
    return {
      stopped: true,
      code: "EXPLICIT_STOP",
      title: "Recovery Stopped",
      reason:
        stopReason ||
        String(rawActionError || log.raw_error_message || "Recovery was stopped by the backend."),
      source: stopReason ? "Webhook stop reason" : "Recovery state",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  if (logStatus === "FAILED" || actionStatus === "FAILED") {
    return {
      stopped: true,
      code: "FAILED_ACTION",
      title: "Recovery Failed",
      reason:
        stopReason ||
        String(rawActionError || log.raw_error_message || "Recovery action failed."),
      source: stopReason ? "Webhook stop reason" : "Recovery status",
      terminal: true,
      attemptCount,
      maxAttempts,
    };
  }

  return {
    stopped: false,
    code: "NONE",
    title: "Recovery Active",
    reason: "No terminal stopping rule has been recorded by the recovery backend.",
    source: "Webhook policy evaluation",
    terminal: false,
    attemptCount,
    maxAttempts,
  };
};

/* =========================================================
   EXECUTION / FUND ROUTING AUDIT PARSER
   ========================================================= */

const getExecutionAuditInfo = (
  log: RecoveryLog,
  action: RecoveryAction | null
): ExecutionAuditInfo => {
  const policy =
    log.policy_evaluation &&
    typeof log.policy_evaluation === "object"
      ? log.policy_evaluation
      : {};

  const audit =
    log.action_executed &&
    typeof log.action_executed === "object"
      ? log.action_executed
      : {};

  const actionResult =
    action?.result &&
    typeof action.result === "object"
      ? action.result
      : {};

  const compliance =
    getObjectValue(policy, [
      "compliance_escalation",
      "complianceEscalation",
    ]) ||
    getObjectValue(audit, [
      "escalation",
      "compliance_escalation",
      "complianceEscalation",
    ]);

  const escalation =
    compliance &&
    typeof compliance === "object"
      ? compliance
      : null;

  const boolValue = (value: unknown): boolean | null => {
    if (value === true) return true;
    if (value === false) return false;

    const normalized = normalize(value);

    if (normalized === "YES" || normalized === "TRUE") {
      return true;
    }

    if (normalized === "NO" || normalized === "FALSE") {
      return false;
    }

    return null;
  };

  const escalationRequired =
    boolValue(
      getObjectValue(escalation, ["required"])
    ) === true;

  const executorBlocked =
    boolValue(
      getObjectValue(escalation, [
        "executor_blocked",
        "executorBlocked",
      ])
    );

  const automatedActionBlocked =
    boolValue(
      getObjectValue(escalation, [
        "automated_action_blocked",
        "automatedActionBlocked",
      ])
    );

  const auditRequired =
    boolValue(
      getObjectValue(escalation, [
        "audit_required",
        "auditRequired",
      ])
    );

  const channelValue = getObjectValue(
    escalation,
    ["channel"]
  );

  const interventionValue =
    getObjectValue(escalation, [
      "selected_intervention",
      "selectedIntervention",
      "intervention",
    ]) ||
    getObjectValue(policy, [
      "selected_intervention",
      "selectedIntervention",
    ]) ||
    log.selected_action ||
    action?.action_type;

  const financialExecutionValue =
    getObjectValue(audit, [
      "financial_execution",
      "financialExecution",
    ]) ||
    getObjectValue(actionResult, [
      "financial_execution",
      "financialExecution",
    ]);

  const errorValue =
    getObjectValue(audit, ["error"]) ||
    getObjectValue(actionResult, ["error"]);

  const auditType = normalize(
    getObjectValue(audit, ["type"])
  );

  const actionStatus = normalize(action?.status);
  const logStatus = normalize(log.status);
  const decision = normalize(log.decision);
  const recoveryState = normalize(log.recovery_state);

  const complianceBlocked =
    escalationRequired ||
    executorBlocked === true ||
    automatedActionBlocked === true ||
    auditType === "COMPLIANT_ESCALATION";

  let mode = "NOT EXECUTED";

  if (complianceBlocked) {
    mode = "COMPLIANCE BLOCKED — NO AUTOMATED EXECUTION";
  } else if (financialExecutionValue) {
    mode = "EXECUTED";
  } else if (
    auditType === "INTERVENTION_QUEUE_FAILED" ||
    errorValue
  ) {
    mode = "EXECUTION FAILED";
  } else if (
    auditType === "INTERVENTION_QUEUED" ||
    [
      "PENDING",
      "PROCESSING",
      "ACTION_QUEUE",
      "ACTION_QUEUED",
      "AWAITING_PAYMENT",
    ].includes(actionStatus)
  ) {
    mode = "QUEUED — AWAITING EXECUTOR";
  } else if (
    ["SUCCESS", "RECOVERED", "COMPLETED"].includes(
      actionStatus
    ) ||
    ["SUCCESS", "RECOVERED", "COMPLETED"].includes(
      logStatus
    )
  ) {
    mode = "EXECUTED";
  } else if (
    decision === "STOP" ||
    recoveryState === "STOPPED" ||
    logStatus === "STOPPED"
  ) {
    mode = "NOT EXECUTED";
  }

  const reasonValue =
    getObjectValue(audit, ["reason"]) ||
    getObjectValue(escalation, ["reason"]) ||
    log.stop_reason ||
    getObjectValue(actionResult, ["reason"]);

  let source = "revenue_recovery_logs.action_executed";

  if (escalationRequired) {
    source =
      "revenue_recovery_logs.policy_evaluation.compliance_escalation";
  } else if (financialExecutionValue) {
    source =
      "revenue_recovery_logs.action_executed.financial_execution";
  } else if (actionResult && Object.keys(actionResult).length > 0) {
    source = "revenue_recovery_actions.result";
  }

  return {
    mode,
    channel: channelValue
      ? String(channelValue)
      : complianceBlocked
      ? "MANUAL_REVIEW"
      : "—",
    executorBlocked,
    automatedActionBlocked,
    auditRequired,
    intervention: interventionValue
      ? String(interventionValue)
      : "—",
    reason: reasonValue
      ? String(reasonValue)
      : "No execution decision recorded.",
    financialExecution: financialExecutionValue
      ? String(financialExecutionValue)
      : null,
    error: errorValue
      ? String(errorValue)
      : null,
    source,
  };
};

/* =========================================================
   ESCALATION UI HELPERS
   ========================================================= */

const getEscalationClass = (
  escalation: EscalationInfo
) => {
  if (!escalation.required) {
    return "escalation-badge escalation-none";
  }

  if (
    escalation.status === "RESOLVED" ||
    escalation.status === "REJECTED"
  ) {
    return "escalation-badge escalation-resolved";
  }

  if (escalation.status === "FAILED") {
    return "escalation-badge escalation-danger";
  }

  return "escalation-badge escalation-active";
};

const getEscalationIcon = (
  escalation: EscalationInfo
) => {
  if (!escalation.required) {
    return <ShieldCheck size={13} />;
  }

  if (
    escalation.status === "RESOLVED" ||
    escalation.status === "REJECTED"
  ) {
    return <CheckCircle2 size={13} />;
  }

  if (escalation.status === "FAILED") {
    return <XCircle size={13} />;
  }

  return <ShieldAlert size={13} />;
};

/* =========================================================
   STOPPING RULE UI HELPERS
   ========================================================= */

const getStoppingRuleClass = (
  stoppingRule: StoppingRuleInfo
) => {
  if (!stoppingRule.stopped) {
    return "stopping-badge stopping-none";
  }

  if (
    stoppingRule.code === "RECOVERY_SUCCESS" ||
    stoppingRule.code === "PAYMENT_CONFIRMED"
  ) {
    return "stopping-badge stopping-success";
  }

  if (
    stoppingRule.code === "COMPLIANCE_ESCALATION" ||
    stoppingRule.code === "POLICY_BLOCK" ||
    stoppingRule.code === "RECOVERY_DISABLED" ||
    stoppingRule.code === "MIN_CART_VALUE" ||
    stoppingRule.code === "DAILY_BUDGET" ||
    stoppingRule.code === "NO_INTERVENTION" ||
    stoppingRule.code === "LOW_RECOVERY_VALUE"
  ) {
    return "stopping-badge stopping-policy";
  }

  return "stopping-badge stopping-danger";
};

const getStoppingRuleIcon = (
  stoppingRule: StoppingRuleInfo
) => {
  if (!stoppingRule.stopped) {
    return <Activity size={13} />;
  }

  if (
    stoppingRule.code === "RECOVERY_SUCCESS" ||
    stoppingRule.code === "PAYMENT_CONFIRMED"
  ) {
    return <CheckCircle2 size={13} />;
  }

  if (
    stoppingRule.code === "COMPLIANCE_ESCALATION" ||
    stoppingRule.code === "POLICY_BLOCK" ||
    stoppingRule.code === "RECOVERY_DISABLED" ||
    stoppingRule.code === "MIN_CART_VALUE" ||
    stoppingRule.code === "DAILY_BUDGET" ||
    stoppingRule.code === "NO_INTERVENTION" ||
    stoppingRule.code === "LOW_RECOVERY_VALUE"
  ) {
    return <ShieldX size={13} />;
  }

  if (stoppingRule.code === "CANCELLED") {
    return <Ban size={13} />;
  }

  return <Octagon size={13} />;
};

/* =========================================================
   COMPONENT
   ========================================================= */


const getAiDiagnosisSummary = (diagnosis: any) => {
  const object =
    diagnosis && typeof diagnosis === "object"
      ? diagnosis
      : {};

  const diagnosisText =
    getObjectValue(object, [
      "diagnosis",
      "failure_diagnosis",
      "failureDiagnosis",
      "summary",
    ]);

  const recommendedAction =
    getObjectValue(object, [
      "recommended_action",
      "recommendedAction",
    ]);

  const confidence =
    getObjectValue(object, [
      "confidence",
      "recommendation_confidence",
      "recommendationConfidence",
    ]);

  const evidenceValue = getObjectValue(object, [
    "evidence",
  ]);

  const evidence = Array.isArray(evidenceValue)
    ? evidenceValue.filter(Boolean).map(String)
    : evidenceValue
    ? [String(evidenceValue)]
    : [];

  const methodRanking = getObjectValue(object, [
    "method_ranking",
    "methodRanking",
  ]);

  const topMethod =
    Array.isArray(methodRanking) &&
    methodRanking.length > 0 &&
    methodRanking[0] &&
    typeof methodRanking[0] === "object"
      ? methodRanking[0]
      : null;

  const topMethodName = topMethod
    ? getObjectValue(topMethod, ["action", "method"])
    : null;

  const topMethodProbability = topMethod
    ? getObjectValue(topMethod, [
        "probability",
        "score",
      ])
    : null;

  return {
    diagnosis:
      diagnosisText
        ? String(diagnosisText)
        : "AI diagnosis recorded.",
    recommendedAction:
      recommendedAction
        ? String(recommendedAction)
        : null,
    confidence:
      confidence !== undefined &&
      confidence !== null &&
      Number.isFinite(Number(confidence))
        ? Number(confidence)
        : null,
    evidence,
    topMethod:
      topMethodName
        ? String(topMethodName)
        : null,
    topMethodProbability:
      topMethodProbability !== undefined &&
      topMethodProbability !== null &&
      Number.isFinite(Number(topMethodProbability))
        ? Number(topMethodProbability)
        : null,
  };
};

const getPolicySummary = (policy: any, action: RecoveryAction | null) => {
  const object =
    policy && typeof policy === "object"
      ? policy
      : {};

  const compliance =
    getObjectValue(object, [
      "compliance_escalation",
      "complianceEscalation",
    ]) || {};

  const maxRetriesValue = getObjectValue(object, [
    "max_retries",
    "max_retries_per_user",
    "maxRetries",
    "maxRetriesPerUser",
  ]);

  const retryCountValue = getObjectValue(object, [
    "retry_count",
    "retryCount",
    "attempt_count",
    "attemptCount",
  ]);

  const minimumValue = getObjectValue(object, [
    "min_cart_value",
    "minimum_cart_value",
    "minCartValue",
    "minimumCartValue",
  ]);

  const expectedRecoveryValue =
    getObjectValue(object, [
      "intervention_value",
      "expected_recovery_value",
      "expectedRecoveryValue",
    ]) ??
    action?.expected_recovery_value;

  const selectedIntervention =
    getObjectValue(object, [
      "selected_intervention",
      "selectedIntervention",
      "selected_action",
      "selectedAction",
    ]) ||
    action?.action_type;

  const failedPaymentMethod =
    getObjectValue(object, [
      "failed_payment_method",
      "failedPaymentMethod",
      "failed_method",
      "failedMethod",
    ]);

  const recoveryEnabled =
    getObjectValue(object, [
      "recovery_enabled",
      "recoveryEnabled",
    ]);

  const dailyBudgetUsed = getObjectValue(object, [
    "daily_budget_used",
    "dailyBudgetUsed",
  ]);

  const dailyBudgetLimit = getObjectValue(object, [
    "daily_budget_limit",
    "dailyBudgetLimit",
    "daily_budget",
    "dailyBudget",
  ]);

  const boolLabel = (value: unknown) => {
    if (value === true) return "Enabled";
    if (value === false) return "Disabled";
    return "Not recorded";
  };

  return {
    maxRetries:
      maxRetriesValue !== undefined &&
      maxRetriesValue !== null
        ? Number(maxRetriesValue)
        : null,
    retryCount:
      retryCountValue !== undefined &&
      retryCountValue !== null
        ? Number(retryCountValue)
        : action?.attempt_count ?? null,
    minimumValue:
      minimumValue !== undefined &&
      minimumValue !== null
        ? Number(minimumValue)
        : null,
    expectedRecovery:
      expectedRecoveryValue !== undefined &&
      expectedRecoveryValue !== null
        ? Number(expectedRecoveryValue)
        : null,
    selectedIntervention: selectedIntervention
      ? String(selectedIntervention)
      : null,
    failedPaymentMethod: failedPaymentMethod
      ? String(failedPaymentMethod)
      : null,
    recoveryEnabled: boolLabel(recoveryEnabled),
    dailyBudgetUsed:
      dailyBudgetUsed !== undefined &&
      dailyBudgetUsed !== null
        ? Number(dailyBudgetUsed)
        : null,
    dailyBudgetLimit:
      dailyBudgetLimit !== undefined &&
      dailyBudgetLimit !== null
        ? Number(dailyBudgetLimit)
        : null,
    originalOrderPaid:
      getObjectValue(object, [
        "original_order_paid",
        "originalOrderPaid",
      ]) === true,
    complianceRequired:
      getObjectValue(compliance, ["required"]) === true ||
      normalize(
        getObjectValue(compliance, ["required"])
      ) === "YES",
  };
};

const getHumanAuditSource = (source: string) => {
  const sourceMap: Record<string, string> = {
    "revenue_recovery_logs":
      "Recovery record",
    "revenue_recovery_logs.ai_diagnosis":
      "AI diagnosis",
    "revenue_recovery_logs.policy_evaluation":
      "Recovery policy",
    "revenue_recovery_actions":
      "Recovery action",
    "revenue_recovery_actions.result.email_delivery":
      "Email delivery",
    "revenue_recovery_actions.executed_at":
      "Action execution",
    "revenue_recovery_logs.escalation_status":
      "Compliance workflow",
    "revenue_recovery_logs.reviewed_at":
      "Manual review",
    "revenue_recovery_logs.resolved_at":
      "Compliance resolution",
    "revenue_recovery_logs.recovered_amount":
      "Recovery result",
  };

  return sourceMap[source] || source;
};

const getRecoveryAuditTrail = (
  log: RecoveryLog,
  action: RecoveryAction | null,
  escalation: EscalationInfo,
  stoppingRule: StoppingRuleInfo
): RecoveryAuditEvent[] => {
  const events: RecoveryAuditEvent[] = [];

  events.push({
    title: "Recovery case recorded",
    status: "RECORDED",
    timestamp: log.created_at,
    evidence: [
      log.event_type ? `Event: ${log.event_type}` : null,
      log.raw_error_code ? `Error code: ${log.raw_error_code}` : null,
      log.original_amount !== null
        ? `Amount at risk: ${money(log.original_amount)}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Recovery case persisted in the recovery log.",
    source: getHumanAuditSource("revenue_recovery_logs"),
  });

  if (log.ai_diagnosis) {
    events.push({
      title: "AI diagnosis recorded",
      status: "RECORDED",
      timestamp: log.created_at,
      evidence: (() => {
        const summary = getAiDiagnosisSummary(
          log.ai_diagnosis
        );

        return [
          `Diagnosis: ${summary.diagnosis}`,
          summary.recommendedAction
            ? `Recommended action: ${summary.recommendedAction}`
            : null,
          summary.confidence !== null
            ? `Confidence: ${(summary.confidence * 100).toFixed(0)}%`
            : null,
          summary.topMethod
            ? `Top alternate route: ${summary.topMethod}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
      })(),
      source: getHumanAuditSource(
        "revenue_recovery_logs.ai_diagnosis"
      ),
    });
  }

  if (log.policy_evaluation) {
    events.push({
      title: "Policy evaluation recorded",
      status: normalize(log.decision) || "RECORDED",
      timestamp: log.updated_at || log.created_at,
      evidence: log.decision
        ? `Decision: ${log.decision}`
        : "Policy evaluation persisted for this recovery case.",
      source: getHumanAuditSource("revenue_recovery_logs.policy_evaluation"),
    });
  }

  if (action) {
    events.push({
      title: "Recovery action created",
      status: normalize(action.status) || "RECORDED",
      timestamp: action.created_at,
      evidence: [
        `Action: ${action.action_type}`,
        action.attempt_count !== null
          ? `Attempt: ${action.attempt_count}`
          : null,
        action.expected_recovery_value !== null
          ? `Expected recovery: ${money(action.expected_recovery_value)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      source: getHumanAuditSource("revenue_recovery_actions"),
    });

    if (action.razorpay_payment_link_id || action.razorpay_payment_link_url) {
      events.push({
        title: "Recovery Payment Link recorded",
        status: "READY",
        timestamp: action.created_at,
        evidence: action.razorpay_payment_link_id
          ? `Payment Link ID: ${action.razorpay_payment_link_id}`
          : "Payment Link URL is available for the recovery action.",
        source: "revenue_recovery_actions",
      });
    }

    const emailDelivery = getObjectValue(action.result, [
      "email_delivery",
      "emailDelivery",
    ]);

    if (emailDelivery && typeof emailDelivery === "object") {
      const emailSuccess =
        getObjectValue(emailDelivery, ["success"]) === true;

      events.push({
        title: "Recovery email delivery recorded",
        status: emailSuccess ? "SENT" : "FAILED",
        timestamp: action.executed_at || action.created_at,
        evidence:
          String(
            getObjectValue(emailDelivery, [
              "message",
              "error",
              "recipient",
            ]) || "Email delivery result recorded in the action result."
          ),
        source: "revenue_recovery_actions.result.email_delivery",
      });
    }

    if (action.executed_at) {
      events.push({
        title: "Recovery action executed",
        status: normalize(action.status) || "EXECUTED",
        timestamp: action.executed_at,
        evidence: action.result
          ? "Execution result persisted with the recovery action."
          : "Execution timestamp persisted for the recovery action.",
        source: "revenue_recovery_actions.executed_at",
      });
    }
  }

  if (escalation.required && escalation.escalatedAt) {
    events.push({
      title: "Compliance escalation recorded",
      status: escalation.status,
      timestamp: escalation.escalatedAt,
      evidence: [
        escalation.level,
        escalation.reason !== "—" ? escalation.reason : null,
      ]
        .filter(Boolean)
        .join(" · "),
      source: "revenue_recovery_logs.escalation_status",
    });
  }

  if (escalation.reviewedAt) {
    events.push({
      title: "Compliance review recorded",
      status: escalation.status,
      timestamp: escalation.reviewedAt,
      evidence:
        escalation.resolutionReason ||
        "Backend review timestamp persisted.",
      source: "revenue_recovery_logs.reviewed_at",
    });
  }

  if (escalation.resolvedAt) {
    events.push({
      title: "Compliance escalation resolved",
      status: escalation.status,
      timestamp: escalation.resolvedAt,
      evidence:
        escalation.resolutionReason ||
        "Resolution timestamp persisted by the recovery backend.",
      source: "revenue_recovery_logs.resolved_at",
    });
  }

  if (Number(log.recovered_amount || 0) > 0) {
    events.push({
      title: "Revenue recovery recorded",
      status: "RECOVERED",
      timestamp: log.action_completed_at || log.updated_at,
      evidence: `Actual recovered amount: ${money(log.recovered_amount)}`,
      source: "revenue_recovery_logs.recovered_amount",
    });
  }

  if (stoppingRule.stopped) {
    events.push({
      title: "Workflow stopping decision recorded",
      status: stoppingRule.code,
      timestamp: log.action_completed_at || log.updated_at,
      evidence: stoppingRule.reason,
      source: stoppingRule.source,
    });
  }

  return events.sort((a, b) => {
    const aTime = a.timestamp
      ? new Date(a.timestamp).getTime()
      : Number.MAX_SAFE_INTEGER;
    const bTime = b.timestamp
      ? new Date(b.timestamp).getTime()
      : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
};

const RecoveryDashboard = () => {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [batches, setBatches] = useState<RecoveryBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [escalationFilter, setEscalationFilter] =
    useState("ALL");

  const [stoppingRuleFilter, setStoppingRuleFilter] =
    useState("ALL");

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const [expandedCaseId, setExpandedCaseId] =
    useState<string | null>(null);

  // Manual compliance-review action state.
  // All lifecycle mutations go through the protected
  // manual-review-escalation Edge Function; the dashboard
  // never writes escalation_status directly.
  const [reviewingCaseId, setReviewingCaseId] =
    useState<string | null>(null);

  /* =======================================================
     AUTH / REQUEST HELPERS
     ======================================================= */

  // The recovery dashboard is intentionally read-only for data loading.
  // When the user is authenticated, make sure Supabase has the current
  // session before querying the protected recovery data. This prevents the
  // dashboard from racing the AuthContext INITIAL_SESSION event.
const withTimeout = useCallback(
    async <T,>(promise: Promise<T>, timeoutMs = 15000) => {
      let timeoutId: number | undefined;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(
            new Error(
              "Recovery backend request timed out. Check the Supabase session, RLS policies, and Edge Function authentication."
            )
          );
        }, timeoutMs);
      });

      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
      }
    },
    []
  );

  /* =======================================================
     FETCH DATA
     ======================================================= */

  const fetchRecoveryData = useCallback(
    async (manual = false) => {
      try {
        setErrorMessage(null);

        if (manual) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        // IMPORTANT: do this before every protected recovery read.
        // Supabase JS automatically attaches this session to PostgREST
        // requests and Edge Function invocations.
        

        const {
          data: logs,
          error: logsError,
        } = await withTimeout(
          supabase
            .from("revenue_recovery_logs")
            .select(`*`)
            .order("created_at", {
              ascending: false,
            })
            .limit(100)
        );

        if (logsError) {
          throw new Error(
            `Recovery logs query failed: ${logsError.message}`
          );
        }

        const {
          data: actions,
          error: actionsError,
        } = await withTimeout(
          supabase
            .from("revenue_recovery_actions")
            .select(`*`)
            .order("created_at", {
              ascending: false,
            })
            .limit(200)
        );

        if (actionsError) {
          console.error(
            "Recovery actions fetch failed:",
            actionsError
          );

          toast.warning(
            "Recovery actions could not be loaded",
            {
              description:
                actionsError.message,
            }
          );
        }

        const {
          data: batchRows,
          error: batchesError,
        } = await withTimeout(
          supabase
            .from("revenue_recovery_batches")
            .select(`
              id,
              batch_number,
              status,
              total_cases,
              total_amount_at_risk,
              total_recovered_amount,
              recovery_rate,
              created_at,
              started_at,
              completed_at
            `)
            .order("created_at", {
              ascending: false,
            })
        );

        if (batchesError) {
          console.error(
            "Recovery batches fetch failed:",
            batchesError
          );

          toast.warning(
            "Recovery batch data could not be loaded",
            {
              description: batchesError.message,
            }
          );

          setBatches([]);
        } else {
          setBatches(
            (batchRows || []) as RecoveryBatch[]
          );
        }

        const actionMap =
          new Map<string, RecoveryAction>();

        (actions || []).forEach(
          (action: RecoveryAction) => {
            if (!action.log_id) return;

            if (!actionMap.has(action.log_id)) {
              actionMap.set(
                action.log_id,
                action
              );
            }
          }
        );

        const combinedCases =
          (logs || []).map(
            (log: RecoveryLog) => ({
              log,
              action:
                actionMap.get(log.id) ||
                null,
            })
          );

        setCases(combinedCases);
        setLastUpdated(new Date());
      } catch (error: any) {
        console.error(
          "Recovery dashboard fetch failed:",
          error
        );

        const rawMessage =
          error?.message ||
          "Unable to load recovery data from Supabase.";

        const message =
          rawMessage.includes("No authenticated Supabase session")
            ? "Your GrabTheByte session is not available to the recovery dashboard. Please sign in again and reopen this page."
            : rawMessage;

        setErrorMessage(message);

        toast.error(
          "Recovery dashboard failed",
          {
            description: message,
          }
        );
      } finally {
        // Never leave the dashboard stuck on the loading screen.
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
[withTimeout]  );

  /* =======================================================
     MANUAL COMPLIANCE REVIEW
     ======================================================= */

  const handleManualReview = useCallback(
    async (
      log: RecoveryLog,
      operation: "START_REVIEW" | "RESOLVE" | "REJECT"
    ) => {
      if (reviewingCaseId) return;

      let resolutionReason: string | undefined;

      if (operation === "RESOLVE" || operation === "REJECT") {
        const enteredReason = window.prompt(
          operation === "RESOLVE"
            ? "Enter the resolution reason:"
            : "Enter the rejection reason:",
          operation === "RESOLVE"
            ? "Manual review completed successfully."
            : "Recovery escalation rejected after manual review."
        );

        if (enteredReason === null) {
          return;
        }

        resolutionReason = enteredReason.trim();

        if (!resolutionReason) {
          toast.error("A resolution reason is required.");
          return;
        }
      }

      setReviewingCaseId(log.id);

      try {
const { data, error } =
          await withTimeout(
            supabase.functions.invoke(
              "manual-review-escalation",
              {
                body: {
                  log_id: log.id,
                  operation,
                  ...(resolutionReason
                    ? {
                        resolution_reason: resolutionReason,
                      }
                    : {}),
                },
              }
            ),
            15000
          );

        if (error) {
          const functionStatus =
            (error as any)?.context?.status ??
            (error as any)?.status;

          if (functionStatus === 401) {
            throw new Error(
              "Manual review request was rejected by the manual-review-escalation function."
            );
          }

          throw error;
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
              "Manual review operation failed."
          );
        }

        const successMessage =
          operation === "START_REVIEW"
            ? "Review started."
            : operation === "RESOLVE"
            ? "Escalation resolved."
            : "Escalation rejected.";

        toast.success(successMessage, {
          description: `Case ${shortId(log.id)} updated by the manual-review workflow.`,
        });

        setExpandedCaseId(log.id);

        // Re-read the backend state so the UI reflects the
        // authoritative lifecycle transition immediately.
        await fetchRecoveryData(true);
      } catch (error: any) {
        console.error(
          "Manual review operation failed:",
          error
        );

        toast.error("Manual review failed", {
          description:
            error?.message ||
            "Unable to complete the compliance review operation.",
        });
      } finally {
        setReviewingCaseId(null);
      }
    },
    [
      fetchRecoveryData,
withTimeout,
      reviewingCaseId,
    ]
  );

  useEffect(() => {
    fetchRecoveryData();
  }, [fetchRecoveryData]);

  useEffect(() => {
    const interval =
      window.setInterval(() => {
        fetchRecoveryData(true);
      }, 30000);

    return () =>
      window.clearInterval(interval);
  }, [fetchRecoveryData]);

  /* =======================================================
     METRICS
     ======================================================= */

  const metrics = useMemo(() => {
    // Batch summary is the single source of truth for the top-level
    // financial metrics. The detailed case data below remains sourced
    // from recovery logs/actions for queues, escalation, stopping rules,
    // and audit visibility.
    const totalCases = batches.reduce(
      (sum, batch) =>
        sum + Number(batch.total_cases || 0),
      0
    );

    const amountAtRisk = batches.reduce(
      (sum, batch) =>
        sum + Number(batch.total_amount_at_risk || 0),
      0
    );

    const recoveredAmount = batches.reduce(
      (sum, batch) =>
        sum + Number(batch.total_recovered_amount || 0),
      0
    );

    const remainingAmount =
      Math.max(
        amountAtRisk -
          recoveredAmount,
        0
      );

    const recoveryRate =
      amountAtRisk > 0
        ? Math.min(
            (recoveredAmount /
              amountAtRisk) *
              100,
            100
          )
        : 0;

    const stoppedCases =
      cases.filter((item) =>
        getStoppingRuleInfo(
          item.log,
          item.action
        ).stopped
      );

    /*
     * IMPORTANT:
     * Stopped cases are intentionally excluded
     * from the active action queue.
     */
    const actionQueueCases =
      cases.filter((item) => {
        const stoppingRule =
          getStoppingRuleInfo(
            item.log,
            item.action
          );

        if (stoppingRule.stopped) {
          return false;
        }

        const state =
          normalize(
            item.log.recovery_state
          );

        const logStatus =
          normalize(item.log.status);

        const actionStatus =
          normalize(item.action?.status);

        return (
          state === "ACTION_QUEUE" ||
          state === "ACTION_QUEUED" ||
          logStatus === "PENDING" ||
          actionStatus === "PENDING" ||
          actionStatus === "PROCESSING"
        );
      });

    const awaitingPaymentCases =
      cases.filter((item) => {
        const stoppingRule =
          getStoppingRuleInfo(
            item.log,
            item.action
          );

        if (stoppingRule.stopped) {
          return false;
        }

        return (
          normalize(
            item.action?.status
          ) ===
            "AWAITING_PAYMENT" ||
          normalize(
            item.log.status
          ) ===
            "AWAITING_PAYMENT"
        );
      });

    const recoveredCases =
      cases.filter((item) => {
        const state =
          normalize(
            item.log.recovery_state
          );

        const logStatus =
          normalize(item.log.status);

        const actionStatus =
          normalize(item.action?.status);

        return (
          state === "RECOVERED" ||
          logStatus === "RECOVERED" ||
          logStatus === "SUCCESS" ||
          logStatus === "COMPLETED" ||
          actionStatus === "SUCCESS" ||
          actionStatus === "RECOVERED" ||
          actionStatus === "COMPLETED"
        );
      });

    const escalatedCases =
      cases.filter(
        (item) =>
          getEscalationInfo(
            item.log
          ).required
      );

    const pendingEscalationCases =
      escalatedCases.filter(
        (item) => {
          const escalation =
            getEscalationInfo(
              item.log
            );

          return (
            escalation.status ===
              "PENDING" ||
            escalation.status ===
              "ACTIVE"
          );
        }
      );

    const resolvedEscalationCases =
      escalatedCases.filter(
        (item) =>
          getEscalationInfo(
            item.log
          ).status === "RESOLVED"
      );

    return {
      totalCases,
      amountAtRisk,
      recoveredAmount,
      remainingAmount,
      recoveryRate,

      actionQueueCases,
      awaitingPaymentCases,
      recoveredCases,

      escalatedCases,
      pendingEscalationCases,
      resolvedEscalationCases,

      stoppedCases,
    };
  }, [batches, cases]);

  /* =======================================================
     FILTERING
     ======================================================= */

  const filteredCases = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return cases.filter((item) => {
      const log = item.log;
      const action = item.action;

      const escalation =
        getEscalationInfo(log);

      const stoppingRule =
        getStoppingRuleInfo(
          log,
          action
        );

      const searchableValues = [
        log.id,
        log.order_id,
        log.user_id,
        log.campus_id,
        log.event_type,
        log.selected_action,
        log.recovery_state,
        log.status,
        log.raw_error_code,
        log.raw_error_message,
        log.stop_reason,

        action?.status,
        action?.action_type,
        action?.razorpay_payment_link_id,

        escalation.level,
        escalation.status,
        escalation.reason,
        escalation.action,
        escalation.policy,

        stoppingRule.code,
        stoppingRule.title,
        stoppingRule.reason,
        stoppingRule.source,
      ];

      const matchesSearch =
        !query ||
        searchableValues.some(
          (value) =>
            String(value || "")
              .toLowerCase()
              .includes(query)
        );

      const possibleStatuses = [
        normalize(
          log.recovery_state
        ),
        normalize(log.status),
        normalize(
          action?.status
        ),
      ];

      const matchesStatus =
        statusFilter === "ALL" ||
        possibleStatuses.includes(
          statusFilter
        );

      let matchesEscalation = true;

      if (
        escalationFilter ===
        "ESCALATED"
      ) {
        matchesEscalation =
          escalation.required;
      }

      if (
        escalationFilter ===
        "PENDING"
      ) {
        matchesEscalation =
          escalation.required &&
          (
            escalation.status ===
              "PENDING" ||
            escalation.status ===
              "ACTIVE"
          );
      }

      if (
        escalationFilter ===
        "RESOLVED"
      ) {
        matchesEscalation =
          escalation.required &&
          escalation.status ===
            "RESOLVED";
      }

      if (
        escalationFilter === "NONE"
      ) {
        matchesEscalation =
          !escalation.required;
      }

      let matchesStoppingRule =
        true;

      if (
        stoppingRuleFilter ===
        "STOPPED"
      ) {
        matchesStoppingRule =
          stoppingRule.stopped;
      }

      if (
        stoppingRuleFilter ===
        "ACTIVE"
      ) {
        matchesStoppingRule =
          !stoppingRule.stopped;
      }

      if (
        stoppingRuleFilter ===
        "RECOVERY_SUCCESS"
      ) {
        matchesStoppingRule =
          stoppingRule.code ===
          "RECOVERY_SUCCESS";
      }

      if (
        stoppingRuleFilter ===
        "MAX_ATTEMPTS"
      ) {
        matchesStoppingRule =
          stoppingRule.code ===
          "MAX_ATTEMPTS";
      }

      if (
        stoppingRuleFilter ===
        "COMPLIANCE_ESCALATION"
      ) {
        matchesStoppingRule =
          stoppingRule.code ===
          "COMPLIANCE_ESCALATION";
      }

      if (stoppingRuleFilter === "RECOVERY_DISABLED") {
        matchesStoppingRule = stoppingRule.code === "RECOVERY_DISABLED";
      }

      if (stoppingRuleFilter === "MIN_CART_VALUE") {
        matchesStoppingRule = stoppingRule.code === "MIN_CART_VALUE";
      }

      if (stoppingRuleFilter === "DAILY_BUDGET") {
        matchesStoppingRule = stoppingRule.code === "DAILY_BUDGET";
      }

      if (stoppingRuleFilter === "NO_INTERVENTION") {
        matchesStoppingRule = stoppingRule.code === "NO_INTERVENTION";
      }

      if (stoppingRuleFilter === "LOW_RECOVERY_VALUE") {
        matchesStoppingRule = stoppingRule.code === "LOW_RECOVERY_VALUE";
      }

      if (
        stoppingRuleFilter ===
        "FAILED_ACTION"
      ) {
        matchesStoppingRule =
          stoppingRule.code ===
          "FAILED_ACTION";
      }

      if (
        stoppingRuleFilter ===
        "CANCELLED"
      ) {
        matchesStoppingRule =
          stoppingRule.code ===
          "CANCELLED";
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesEscalation &&
        matchesStoppingRule
      );
    });
  }, [
    cases,
    search,
    statusFilter,
    escalationFilter,
    stoppingRuleFilter,
  ]);

  /* =======================================================
     LOADING UI
     ======================================================= */

  if (isLoading) {
    return (
      <div className="recovery-dashboard">
        <div className="recovery-loading">
          <div className="loading-orb">
            <Loader2
              className="recovery-spinner"
              size={28}
            />
          </div>

          <h2>
            Loading Revenue Recovery
          </h2>

          <p>
            Connecting to recovery
            intelligence...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="recovery-dashboard">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .recovery-dashboard {
          min-height: 100vh;
          color: #f8fafc;
          padding: 34px;
          font-family: Inter, ui-sans-serif, system-ui,
            -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;

          background:
            radial-gradient(
              circle at 8% 0%,
              rgba(59,130,246,0.10),
              transparent 26%
            ),
            radial-gradient(
              circle at 92% 8%,
              rgba(34,197,94,0.055),
              transparent 24%
            ),
            #080a0f;
        }

        .recovery-container {
          width: 100%;
          max-width: 1540px;
          margin: 0 auto;
        }

        .recovery-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 25px;
          margin-bottom: 28px;
        }

        .recovery-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .recovery-live-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow:
            0 0 0 4px rgba(34,197,94,0.08),
            0 0 18px rgba(34,197,94,0.65);
          animation: live-pulse 2s infinite;
        }

        @keyframes live-pulse {
          0%, 100% {
            opacity: 1;
          }

          50% {
            opacity: .45;
          }
        }

        .recovery-header h1 {
          margin: 0;
          font-size: 31px;
          line-height: 1.1;
          letter-spacing: -1px;
          font-weight: 760;
        }

        .recovery-header p {
          margin: 10px 0 0 21px;
          color: #7f8da3;
          font-size: 14px;
          line-height: 1.5;
        }

        .recovery-header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .recovery-live-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          padding-right: 4px;
        }

        .recovery-live-label {
          color: #86efac;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .recovery-last-updated {
          color: #64748b;
          font-size: 11px;
        }

        .recovery-button {
          border: 1px solid #2a3240;
          background: linear-gradient(
            180deg,
            #171c25,
            #11151c
          );
          color: #e5e7eb;
          border-radius: 10px;
          padding: 10px 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 12px;
        }

        .recovery-button:hover {
          background: #1a202b;
          border-color: #3c4657;
          transform: translateY(-1px);
        }

        .recovery-button:disabled {
          opacity: .55;
          cursor: not-allowed;
          transform: none;
        }

        .recovery-kpis {
          display: grid;
          grid-template-columns:
            repeat(6, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 16px;
        }

        .recovery-kpi {
          position: relative;
          overflow: hidden;

          background:
            linear-gradient(
              145deg,
              rgba(20,24,32,.96),
              rgba(13,16,22,.96)
            );

          border: 1px solid #232a35;
          border-radius: 15px;
          padding: 20px;
          min-height: 142px;
        }

        .recovery-kpi:hover {
          transform: translateY(-2px);
          border-color: #303948;
        }

        .recovery-kpi-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .recovery-kpi-label {
          color: #7d8ba0;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .85px;
        }

        .recovery-kpi-icon {
          width: 31px;
          height: 31px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          color: #94a3b8;
          background: #191e27;
          border: 1px solid #272e3a;
        }

        .recovery-kpi-value {
          margin-top: 16px;
          font-size: 28px;
          line-height: 1;
          font-weight: 780;
          letter-spacing: -.8px;
        }

        .recovery-kpi-sub {
          color: #59677b;
          margin-top: 10px;
          font-size: 11px;
        }

        .stopping-kpi {
          border-color:
            rgba(239,68,68,.20);
        }

        .stopping-kpi .recovery-kpi-icon {
          color: #fca5a5;
          border-color:
            rgba(239,68,68,.18);
          background:
            rgba(239,68,68,.055);
        }

        .stopping-kpi-value {
          color: #fca5a5;
        }

        .recovery-batch-section {
          margin-bottom: 16px;
        }

        .recovery-batch-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
        }

        .recovery-batch-title {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .recovery-batch-title h2 {
          margin: 0;
          font-size: 15px;
          letter-spacing: -.2px;
        }

        .recovery-batch-subtitle {
          margin-top: 5px;
          color: #59677b;
          font-size: 10px;
        }

        .recovery-batch-capacity {
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .recovery-batch-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .recovery-batch-card {
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(
              145deg,
              rgba(18,22,29,.97),
              rgba(12,15,21,.97)
            );
          border: 1px solid #232a35;
          border-radius: 15px;
          padding: 17px;
        }

        .recovery-batch-card:hover {
          border-color: #303948;
          transform: translateY(-1px);
        }

        .recovery-batch-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 15px;
        }

        .recovery-batch-number {
          color: #e7ebf0;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -.2px;
        }

        .recovery-batch-status {
          display: inline-flex;
          align-items: center;
          border-radius: 99px;
          padding: 5px 8px;
          border: 1px solid #2a3240;
          background: #171c25;
          color: #94a3b8;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .55px;
        }

        .recovery-batch-status-running {
          color: #86efac;
          background: rgba(34,197,94,.065);
          border-color: rgba(34,197,94,.17);
        }

        .recovery-batch-status-full {
          color: #93c5fd;
          background: rgba(59,130,246,.065);
          border-color: rgba(59,130,246,.17);
        }

        .recovery-batch-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .recovery-batch-metric {
          min-width: 0;
          padding: 10px;
          border-radius: 9px;
          background: #0d1117;
          border: 1px solid #202733;
        }

        .recovery-batch-metric-label {
          color: #536075;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .65px;
        }

        .recovery-batch-metric-value {
          margin-top: 6px;
          color: #e7ebf0;
          font-size: 15px;
          line-height: 1.15;
          font-weight: 780;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .recovery-batch-recovered {
          color: #86efac;
        }

        .recovery-batch-rate {
          color: #93c5fd;
        }

        .recovery-batch-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
          color: #59677b;
          font-size: 9px;
        }

        .recovery-batch-progress {
          height: 4px;
          margin-top: 9px;
          border-radius: 99px;
          background: #242b36;
          overflow: hidden;
        }

        .recovery-batch-progress-bar {
          height: 100%;
          border-radius: inherit;
          background: #22c55e;
        }

        .recovery-batch-empty {
          padding: 22px;
          text-align: center;
          color: #536075;
          font-size: 10px;
          border: 1px dashed #29313e;
          border-radius: 12px;
        }

        .recovery-overview {
          display: grid;
          grid-template-columns:
            1.45fr 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 16px;
        }

        .recovery-panel {
          background:
            linear-gradient(
              145deg,
              rgba(18,22,29,.97),
              rgba(12,15,21,.97)
            );

          border: 1px solid #232a35;
          border-radius: 15px;
          padding: 20px;
          box-shadow:
            0 10px 30px rgba(0,0,0,.10);
        }

        .recovery-panel h2 {
          margin: 0;
          font-size: 15px;
          letter-spacing: -.2px;
        }

        .recovery-performance-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .recovery-performance-label {
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .7px;
        }

        .recovery-overview-main {
          display: flex;
          align-items: center;
          gap: 22px;
        }

        .recovery-ring {
          width: 108px;
          height: 108px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          flex-shrink: 0;

          background:
            conic-gradient(
              #22c55e
              ${Math.min(
                metrics.recoveryRate,
                100
              )}%,
              #252c38 0
            );

          box-shadow:
            0 0 28px
            rgba(34,197,94,.08);
        }

        .recovery-ring-inner {
          width: 84px;
          height: 84px;
          border-radius: 50%;
          background: #10141b;
          border: 1px solid #202733;
          display: grid;
          place-items: center;
          font-size: 17px;
          font-weight: 780;
        }

        .recovery-overview-label {
          color: #718096;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .recovery-overview-number {
          font-size: 25px;
          line-height: 1;
          font-weight: 780;
          letter-spacing: -.5px;
        }

        .recovery-small {
          color: #59677b;
          font-size: 10px;
          margin-top: 6px;
        }

        .recovery-performance-progress {
          margin-top: 19px;
          height: 4px;
          border-radius: 99px;
          background: #242b36;
          overflow: hidden;
        }

        .recovery-performance-progress-bar {
          height: 100%;
          border-radius: inherit;
          background: #22c55e;
          width:
            ${Math.min(
              metrics.recoveryRate,
              100
            )}%;
        }

        .recovery-stat {
          min-height: 175px;
          position: relative;
          overflow: hidden;
        }

        .recovery-stat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .recovery-stat-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: #181d26;
          border: 1px solid #272e3a;
          color: #94a3b8;
        }

        .recovery-stat-value {
          font-size: 30px;
          line-height: 1;
          font-weight: 780;
          margin-top: 24px;
          letter-spacing: -.8px;
        }

        .recovery-stat-description {
          color: #59677b;
          font-size: 11px;
          line-height: 1.45;
          margin-top: 8px;
          max-width: 180px;
        }

        .recovery-escalation-stat {
          border-color:
            rgba(245,158,11,.20);
        }

        .recovery-escalation-stat
          .recovery-stat-icon {
          color: #fbbf24;
          border-color:
            rgba(245,158,11,.18);
          background:
            rgba(245,158,11,.055);
        }

        .recovery-escalation-value {
          color: #fbbf24;
        }

        .recovery-escalation-sub {
          margin-top: 9px;
          display: flex;
          gap: 6px;
          align-items: center;
          color: #64748b;
          font-size: 10px;
        }

        .recovery-escalation-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f59e0b;
        }

        .recovery-stopping-stat {
          border-color:
            rgba(239,68,68,.20);
        }

        .recovery-stopping-stat
          .recovery-stat-icon {
          color: #fca5a5;
          border-color:
            rgba(239,68,68,.18);
          background:
            rgba(239,68,68,.055);
        }

        .recovery-stopping-value {
          color: #fca5a5;
        }

        .recovery-cases-panel {
          padding: 0;
          overflow: hidden;
        }

        .recovery-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 19px 20px;
          border-bottom: 1px solid #202631;
        }

        .recovery-toolbar-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .recovery-toolbar-title h2 {
          margin: 0;
          font-size: 15px;
        }

        .recovery-count {
          min-width: 24px;
          height: 22px;
          padding: 0 7px;
          border-radius: 99px;
          display: grid;
          place-items: center;
          background: #1a2029;
          border: 1px solid #29313e;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
        }

        .recovery-filters {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .recovery-search-wrapper {
          position: relative;
        }

        .recovery-search-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #526074;
          pointer-events: none;
        }

        .recovery-input,
        .recovery-select {
          height: 37px;
          background: #0b0e13;
          color: #dbe2ea;
          border: 1px solid #2a3240;
          border-radius: 8px;
          padding: 0 11px;
          outline: none;
          font-size: 11px;
        }

        .recovery-input {
          width: 235px;
          padding-left: 33px;
        }

        .recovery-select {
          max-width: 190px;
        }

        .recovery-input::placeholder {
          color: #4f5c70;
        }

        .recovery-input:focus,
        .recovery-select:focus {
          border-color: #485568;
          background: #0e1218;
        }

        .recovery-table-wrapper {
          overflow-x: auto;
        }

        .recovery-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1540px;
        }

        .recovery-table th {
          color: #536075;
          background: #0d1015;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .85px;
          text-align: left;
          padding: 12px 15px;
          border-bottom: 1px solid #202631;
          white-space: nowrap;
        }

        .recovery-table td {
          padding: 14px 15px;
          border-bottom: 1px solid #191f28;
          vertical-align: middle;
          font-size: 12px;
        }

        .recovery-table tbody tr {
          transition: background .15s ease;
        }

        .recovery-table tbody tr:hover {
          background:
            rgba(255,255,255,.018);
        }

        .recovery-case {
          min-width: 160px;
        }

        .recovery-case-top {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .recovery-case-badge {
          width: 25px;
          height: 25px;
          border-radius: 7px;
          display: grid;
          place-items: center;
          background: #171d26;
          border: 1px solid #28303d;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 800;
        }

        .recovery-case-id {
          font-weight: 750;
          color: #e7ebf0;
        }

        .recovery-case-reference {
          color: #657286;
          font-size: 9px;
          margin-top: 3px;
        }

        .recovery-amount {
          color: #f1f5f9;
          font-weight: 750;
          white-space: nowrap;
        }

        .recovery-action {
          color: #dce3ec;
          font-size: 11px;
          font-weight: 700;
        }

        .recovery-action-score {
          color: #59677b;
          font-size: 9px;
          margin-top: 4px;
        }

        .recovery-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 99px;
          padding: 5px 8px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .45px;
          white-space: nowrap;
        }

        .recovery-status-success {
          color: #86efac;
          background:
            rgba(34,197,94,.085);
          border:
            1px solid rgba(34,197,94,.18);
        }

        .recovery-status-pending {
          color: #fcd34d;
          background:
            rgba(234,179,8,.075);
          border:
            1px solid rgba(234,179,8,.17);
        }

        .recovery-status-danger {
          color: #fca5a5;
          background:
            rgba(239,68,68,.075);
          border:
            1px solid rgba(239,68,68,.17);
        }

        .recovery-status-neutral {
          color: #aab5c5;
          background:
            rgba(148,163,184,.065);
          border:
            1px solid rgba(148,163,184,.13);
        }

        .escalation-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .4px;
          white-space: nowrap;
        }

        .escalation-none {
          color: #64748b;
          background:
            rgba(148,163,184,.045);
          border:
            1px solid rgba(148,163,184,.10);
        }

        .escalation-active {
          color: #fcd34d;
          background:
            rgba(245,158,11,.085);
          border:
            1px solid rgba(245,158,11,.20);
        }

        .escalation-resolved {
          color: #86efac;
          background:
            rgba(34,197,94,.075);
          border:
            1px solid rgba(34,197,94,.17);
        }

        .escalation-danger {
          color: #fca5a5;
          background:
            rgba(239,68,68,.075);
          border:
            1px solid rgba(239,68,68,.18);
        }

        .escalation-detail {
          margin-top: 5px;
          color: #59677b;
          font-size: 9px;
          max-width: 180px;
          white-space: normal;
          line-height: 1.4;
        }

        .stopping-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .35px;
          white-space: nowrap;
        }

        .stopping-none {
          color: #86efac;
          background:
            rgba(34,197,94,.055);
          border:
            1px solid rgba(34,197,94,.12);
        }

        .stopping-success {
          color: #86efac;
          background:
            rgba(34,197,94,.085);
          border:
            1px solid rgba(34,197,94,.18);
        }

        .stopping-policy {
          color: #fcd34d;
          background:
            rgba(245,158,11,.085);
          border:
            1px solid rgba(245,158,11,.20);
        }

        .stopping-danger {
          color: #fca5a5;
          background:
            rgba(239,68,68,.075);
          border:
            1px solid rgba(239,68,68,.18);
        }

        .stopping-detail {
          color: #657286;
          font-size: 9px;
          margin-top: 5px;
          max-width: 190px;
          line-height: 1.4;
        }

        .recovery-expanded-row td {
          background:
            rgba(245,158,11,.018);
          border-bottom:
            1px solid #232a35;
        }

        .recovery-expanded-content {
          padding: 5px 5px 10px;
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .recovery-detail-card {
          background: #0d1117;
          border: 1px solid #222a35;
          border-radius: 9px;
          padding: 12px;
        }

        .recovery-detail-card-wide {
          grid-column: span 2;
        }

        .recovery-readable-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 10px;
        }

        .recovery-readable-item {
          background: #111722;
          border: 1px solid #202938;
          border-radius: 7px;
          padding: 8px 9px;
          min-width: 0;
        }

        .recovery-readable-item span {
          display: block;
          color: #66758a;
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .45px;
          margin-bottom: 4px;
        }

        .recovery-readable-item strong {
          display: block;
          color: #dbe2ea;
          font-size: 10px;
          font-weight: 750;
          line-height: 1.35;
          word-break: break-word;
        }

        .recovery-readable-reason {
          margin-top: 9px;
          padding: 8px 9px;
          border-left: 2px solid #3b82f6;
          background: rgba(59,130,246,.045);
          border-radius: 0 7px 7px 0;
        }

        .recovery-readable-reason span,
        .recovery-readable-footer {
          color: #748196;
          font-size: 8px;
          line-height: 1.4;
        }

        .recovery-readable-reason div {
          margin-top: 4px;
          color: #aeb9c8;
          font-size: 9px;
          line-height: 1.45;
          word-break: break-word;
        }

        .recovery-readable-footer {
          margin-top: 9px;
          padding-top: 8px;
          border-top: 1px solid #202938;
        }

        .recovery-audit-trail {
          grid-column: 1 / -1;
          background: #0d1117;
          border: 1px solid #2b3442;
          border-radius: 10px;
          padding: 13px;
        }

        .recovery-audit-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 11px;
        }

        .recovery-audit-title {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #dbe2ea;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .75px;
        }

        .recovery-audit-subtitle {
          color: #657286;
          font-size: 9px;
        }

        .recovery-audit-count {
          color: #93c5fd;
          background: rgba(59,130,246,.08);
          border: 1px solid rgba(59,130,246,.20);
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 8px;
          font-weight: 800;
          white-space: nowrap;
        }

        .recovery-audit-list {
          display: grid;
          gap: 0;
        }

        .recovery-audit-event {
          display: grid;
          grid-template-columns: 12px minmax(150px, .75fr) minmax(0, 1.8fr) minmax(110px, .55fr);
          gap: 10px;
          align-items: start;
          padding: 9px 0;
          border-top: 1px solid #1f2732;
        }

        .recovery-audit-event:first-child {
          border-top: 0;
        }

        .recovery-audit-dot {
          width: 8px;
          height: 8px;
          margin-top: 3px;
          border-radius: 50%;
          background: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96,165,250,.08);
        }

        .recovery-audit-event-title {
          color: #dbe2ea;
          font-size: 10px;
          font-weight: 750;
          line-height: 1.35;
        }

        .recovery-audit-status {
          color: #86efac;
          font-size: 8px;
          font-weight: 800;
          margin-top: 3px;
          letter-spacing: .4px;
        }

        .recovery-audit-evidence {
          color: #aab5c5;
          font-size: 9px;
          line-height: 1.45;
          word-break: break-word;
        }

        .recovery-audit-source {
          color: #657286;
          font-size: 8px;
          line-height: 1.4;
          word-break: break-word;
        }

        .recovery-audit-time {
          color: #7d899b;
          font-size: 8px;
          text-align: right;
          line-height: 1.4;
        }

        .recovery-audit-ids {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }

        .recovery-audit-id {
          color: #8fa0b5;
          background: #111722;
          border: 1px solid #222a35;
          border-radius: 6px;
          padding: 4px 7px;
          font-size: 8px;
          line-height: 1.3;
          word-break: break-all;
        }

        .recovery-detail-label {
          color: #536075;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .75px;
        }

        .recovery-detail-value {
          color: #dbe2ea;
          font-size: 11px;
          font-weight: 700;
          margin-top: 6px;
          line-height: 1.45;
          word-break: break-word;
        }

        .recovery-detail-muted {
          color: #657286;
          font-size: 9px;
          margin-top: 4px;
        }

        .recovery-expand-button {
          border: 1px solid #303b4b;
          background: #171c25;
          color: #aeb9c8;
          border-radius: 7px;
          width: 28px;
          height: 28px;
          cursor: pointer;
          display: inline-grid;
          place-items: center;
        }

        .recovery-created {
          color: #d4dbe5;
          font-size: 10px;
          white-space: nowrap;
        }

        .recovery-attempt {
          color: #536075;
          font-size: 9px;
          margin-top: 4px;
        }

        .recovery-recovered {
          color: #86efac;
          font-weight: 750;
          white-space: nowrap;
        }

        .recovery-not-recovered {
          color: #526074;
          font-weight: 600;
          white-space: nowrap;
        }

        .recovery-action-button {
          border: 1px solid #303b4b;
          background: #171c25;
          color: #dce3ec;
          border-radius: 7px;
          padding: 7px 9px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 9px;
          font-weight: 750;
        }

        .recovery-review-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 7px;
        }

        .recovery-review-button {
          border: 1px solid #3a4352;
          background: #171c25;
          color: #dce3ec;
          border-radius: 7px;
          padding: 6px 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .recovery-review-button:hover:not(:disabled) {
          background: #202733;
          border-color: #536075;
        }

        .recovery-review-button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .recovery-review-start {
          color: #fcd34d;
          border-color: rgba(245,158,11,.28);
        }

        .recovery-review-resolve {
          color: #86efac;
          border-color: rgba(34,197,94,.25);
        }

        .recovery-review-reject {
          color: #fca5a5;
          border-color: rgba(239,68,68,.25);
        }

        .recovery-review-processing {
          color: #93c5fd;
          font-size: 9px;
          font-weight: 700;
          margin-top: 7px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .recovery-empty {
          padding: 55px 20px;
          text-align: center;
          color: #536075;
        }

        .recovery-empty-icon {
          width: 48px;
          height: 48px;
          margin: 0 auto 12px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #151a22;
          border: 1px solid #252d39;
          color: #64748b;
        }

        .recovery-empty-title {
          color: #a7b2c1;
          font-size: 12px;
          font-weight: 700;
        }

        .recovery-empty-description {
          margin-top: 5px;
          font-size: 10px;
        }

        .recovery-error {
          margin-bottom: 16px;
          padding: 13px 15px;
          border-radius: 10px;
          border:
            1px solid rgba(239,68,68,.22);
          background:
            rgba(239,68,68,.055);
          color: #fca5a5;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 11px;
        }

        .recovery-error strong {
          display: block;
          color: #fecaca;
          margin-bottom: 3px;
        }

        .recovery-loading {
          min-height: 100vh;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 7px;
          color: #718096;
        }

        .loading-orb {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border-radius: 16px;
          background: #141922;
          border: 1px solid #29313e;
          margin-bottom: 8px;
        }

        .recovery-loading h2 {
          color: #e8edf4;
          margin: 0;
          font-size: 17px;
        }

        .recovery-loading p {
          margin: 0;
          font-size: 11px;
        }

        .recovery-spinner {
          animation:
            recovery-spin 1s linear infinite;
        }

        @keyframes recovery-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1450px) {
          .recovery-kpis {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 1300px) {
          .recovery-batch-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .recovery-overview {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1150px) {
          .recovery-kpis {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .recovery-expanded-content {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
 
          .recovery-detail-card-wide {
            grid-column: span 2;
          }
        }

        @media (max-width: 760px) {
          .recovery-audit-event {
            grid-template-columns: 12px minmax(0, 1fr);
          }

          .recovery-audit-evidence,
          .recovery-audit-source,
          .recovery-audit-time {
            grid-column: 2;
            text-align: left;
          }

          .recovery-audit-head {
            align-items: flex-start;
          }

          .recovery-batch-grid {
            grid-template-columns: 1fr;
          }

          .recovery-batch-head {
            flex-direction: column;
          }

          .recovery-dashboard {
            padding: 18px;
          }

          .recovery-header {
            flex-direction: column;
          }

          .recovery-header-actions {
            width: 100%;
            justify-content: space-between;
          }

          .recovery-live-meta {
            align-items: flex-start;
          }

          .recovery-kpis,
          .recovery-overview {
            grid-template-columns: 1fr;
          }

          .recovery-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .recovery-filters {
            width: 100%;
            flex-direction: column;
          }

          .recovery-search-wrapper,
          .recovery-input,
          .recovery-select {
            width: 100%;
            max-width: none;
          }

          .recovery-overview-main {
            justify-content: center;
          }

          .recovery-expanded-content {
            grid-template-columns: 1fr;
          }
 
          .recovery-detail-card-wide {
            grid-column: auto;
          }
        }
      `}</style>

      <div className="recovery-container">

        {/* ===================================================
            HEADER
        =================================================== */}

        <header className="recovery-header">
          <div>
            <div className="recovery-title-row">
              <span className="recovery-live-dot" />

              <h1>
                Revenue Recovery
              </h1>
            </div>

            <p>
              Payment recovery intelligence,
              compliant escalation,
              stopping rules and recovered
              revenue.
            </p>
          </div>

          <div className="recovery-header-actions">
            <div className="recovery-live-meta">
              <div className="recovery-live-label">
                ● LIVE
              </div>

              <div className="recovery-last-updated">
                {lastUpdated
                  ? `Updated ${formatTime(
                      lastUpdated
                    )}`
                  : "Connecting..."}
              </div>
            </div>

            <button
              className="recovery-button"
              onClick={() =>
                fetchRecoveryData(true)
              }
              disabled={isRefreshing}
            >
              <RefreshCw
                size={14}
                className={
                  isRefreshing
                    ? "recovery-spinner"
                    : ""
                }
              />

              Refresh
            </button>
          </div>
        </header>

        {/* ===================================================
            ERROR
        =================================================== */}

        {errorMessage && (
          <div className="recovery-error">
            <AlertCircle size={17} />

            <div>
              <strong>
                Backend connection error
              </strong>

              <div>
                {errorMessage}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            KPI SECTION
        =================================================== */}

        <section className="recovery-kpis">

          <div className="recovery-kpi">
            <div className="recovery-kpi-top">
              <div className="recovery-kpi-label">
                Total Cases
              </div>

              <div className="recovery-kpi-icon">
                <Layers3 size={15} />
              </div>
            </div>

            <div className="recovery-kpi-value">
              {metrics.totalCases}
            </div>

            <div className="recovery-kpi-sub">
              Recovery events recorded
            </div>
          </div>

          <div className="recovery-kpi">
            <div className="recovery-kpi-top">
              <div className="recovery-kpi-label">
                Amount at Risk
              </div>

              <div className="recovery-kpi-icon">
                <CircleDollarSign
                  size={15}
                />
              </div>
            </div>

            <div className="recovery-kpi-value">
              {money(
                metrics.amountAtRisk
              )}
            </div>

            <div className="recovery-kpi-sub">
              Original failed-payment value
            </div>
          </div>

          <div className="recovery-kpi">
            <div className="recovery-kpi-top">
              <div className="recovery-kpi-label">
                Recovered
              </div>

              <div className="recovery-kpi-icon">
                <Wallet size={15} />
              </div>
            </div>

            <div className="recovery-kpi-value">
              {money(
                metrics.recoveredAmount
              )}
            </div>

            <div className="recovery-kpi-sub">
              Actual recovered revenue
            </div>
          </div>

          <div className="recovery-kpi">
            <div className="recovery-kpi-top">
              <div className="recovery-kpi-label">
                Recovery Rate
              </div>

              <div className="recovery-kpi-icon">
                <TrendingUp
                  size={15}
                />
              </div>
            </div>

            <div className="recovery-kpi-value">
              {metrics.recoveryRate.toFixed(
                2
              )}
              %
            </div>

            <div className="recovery-kpi-sub">
              Recovered / amount at risk
            </div>
          </div>

          <div
            className="recovery-kpi"
            style={{
              borderColor:
                metrics.pendingEscalationCases
                  .length > 0
                  ? "rgba(245,158,11,.25)"
                  : "#232a35",
            }}
          >
            <div className="recovery-kpi-top">
              <div className="recovery-kpi-label">
                Compliance Escalations
              </div>

              <div className="recovery-kpi-icon">
                <ShieldAlert
                  size={15}
                />
              </div>
            </div>

            <div
              className="recovery-kpi-value"
              style={{
                color:
                  metrics.pendingEscalationCases
                    .length > 0
                    ? "#fbbf24"
                    : "#f1f5f9",
              }}
            >
              {metrics.escalatedCases.length}
            </div>

            <div className="recovery-kpi-sub">
              {
                metrics
                  .pendingEscalationCases
                  .length
              }{" "}
              currently require attention
            </div>
          </div>

          {/* NEW STOPPING RULE KPI */}

          <div className="recovery-kpi stopping-kpi">
            <div className="recovery-kpi-top">
              <div className="recovery-kpi-label">
                Stopped Cases
              </div>

              <div className="recovery-kpi-icon">
                <Octagon size={15} />
              </div>
            </div>

            <div className="recovery-kpi-value stopping-kpi-value">
              {metrics.stoppedCases.length}
            </div>

            <div className="recovery-kpi-sub">
              Cases prevented from further recovery
            </div>
          </div>

        </section>

        {/* ===================================================
            OVERVIEW
        =================================================== */}

        <section className="recovery-batch-section">
          <div className="recovery-batch-head">
            <div>
              <div className="recovery-batch-title">
                <Layers3 size={16} />
                <h2>Batch Recovery Performance</h2>
              </div>
              <div className="recovery-batch-subtitle">
                Measured recovered revenue across bounded recovery batches.
              </div>
            </div>

            <div className="recovery-batch-capacity">
              Max 50 new recovery cases per batch
            </div>
          </div>

          {batches.length > 0 ? (
            <div className="recovery-batch-grid">
              {batches.map((batch) => {
                const batchRate = Math.min(
                  Math.max(Number(batch.recovery_rate || 0), 0),
                  100
                );

                const batchCases = Math.max(
                  Number(batch.total_cases || 0),
                  0
                );

                const remainingCapacity = Math.max(
                  50 - batchCases,
                  0
                );

                const normalizedBatchStatus =
                  normalize(batch.status);

                const statusClass =
                  normalizedBatchStatus === "FULL"
                    ? "recovery-batch-status recovery-batch-status-full"
                    : normalizedBatchStatus === "RUNNING" ||
                      normalizedBatchStatus === "ACTIVE"
                    ? "recovery-batch-status recovery-batch-status-running"
                    : "recovery-batch-status";

                return (
                  <div
                    className="recovery-batch-card"
                    key={batch.id}
                  >
                    <div className="recovery-batch-card-top">
                      <div className="recovery-batch-number">
                        {batch.batch_number}
                      </div>

                      <span className={statusClass}>
                        {normalizedBatchStatus || "UNKNOWN"}
                      </span>
                    </div>

                    <div className="recovery-batch-metrics">
                      <div className="recovery-batch-metric">
                        <div className="recovery-batch-metric-label">
                          Cases
                        </div>
                        <div className="recovery-batch-metric-value">
                          {batchCases}
                        </div>
                      </div>

                      <div className="recovery-batch-metric">
                        <div className="recovery-batch-metric-label">
                          Amount at Risk
                        </div>
                        <div className="recovery-batch-metric-value">
                          {money(batch.total_amount_at_risk)}
                        </div>
                      </div>

                      <div className="recovery-batch-metric">
                        <div className="recovery-batch-metric-label">
                          Money Recovered
                        </div>
                        <div className="recovery-batch-metric-value recovery-batch-recovered">
                          {money(batch.total_recovered_amount)}
                        </div>
                      </div>

                      <div className="recovery-batch-metric">
                        <div className="recovery-batch-metric-label">
                          Recovery Rate
                        </div>
                        <div className="recovery-batch-metric-value recovery-batch-rate">
                          {batchRate.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="recovery-batch-progress">
                      <div
                        className="recovery-batch-progress-bar"
                        style={{
                          width: `${batchRate}%`,
                        }}
                      />
                    </div>

                    <div className="recovery-batch-footer">
                      <span>
                        {normalizedBatchStatus === "FULL"
                          ? "Batch capacity reached"
                          : `${remainingCapacity} case${
                              remainingCapacity === 1 ? "" : "s"
                            } remaining`}
                      </span>

                      <span>
                        {batch.completed_at
                          ? `Completed ${formatDate(batch.completed_at)}`
                          : `Created ${formatDate(batch.created_at)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="recovery-batch-empty">
              No recovery batches have been recorded yet.
            </div>
          )}
        </section>

        <section className="recovery-overview">

          <div className="recovery-panel">

            <div className="recovery-performance-head">
              <h2>
                Recovery Performance
              </h2>

              <span className="recovery-performance-label">
                Revenue efficiency
              </span>
            </div>

            <div className="recovery-overview-main">

              <div className="recovery-ring">
                <div className="recovery-ring-inner">
                  {metrics.recoveryRate.toFixed(
                    1
                  )}
                  %
                </div>
              </div>

              <div>
                <div className="recovery-overview-label">
                  Revenue recovered
                </div>

                <div className="recovery-overview-number">
                  {money(
                    metrics.recoveredAmount
                  )}
                </div>

                <div className="recovery-small">
                  {money(
                    metrics.remainingAmount
                  )}{" "}
                  remaining
                </div>
              </div>

            </div>

            <div className="recovery-performance-progress">
              <div className="recovery-performance-progress-bar" />
            </div>

          </div>

          <div className="recovery-panel recovery-stat">
            <div className="recovery-stat-header">
              <div className="recovery-overview-label">
                Action Queue
              </div>

              <div className="recovery-stat-icon">
                <Zap size={15} />
              </div>
            </div>

            <div className="recovery-stat-value">
              {metrics.actionQueueCases.length}
            </div>

            <div className="recovery-stat-description">
              Cases requiring recovery
              processing
            </div>
          </div>

          <div className="recovery-panel recovery-stat recovery-escalation-stat">

            <div className="recovery-stat-header">
              <div className="recovery-overview-label">
                Compliance Escalation
              </div>

              <div className="recovery-stat-icon">
                <ShieldAlert
                  size={15}
                />
              </div>
            </div>

            <div className="recovery-stat-value recovery-escalation-value">
              {metrics.escalatedCases.length}
            </div>

            <div className="recovery-stat-description">
              Cases escalated by compliance
              policy
            </div>

            <div className="recovery-escalation-sub">
              <span className="recovery-escalation-dot" />
              {
                metrics
                  .pendingEscalationCases
                  .length
              }{" "}
              pending
            </div>

          </div>

          <div className="recovery-panel recovery-stat">

            <div className="recovery-stat-header">
              <div className="recovery-overview-label">
                Awaiting Payment
              </div>

              <div className="recovery-stat-icon">
                <Timer size={15} />
              </div>
            </div>

            <div className="recovery-stat-value">
              {
                metrics
                  .awaitingPaymentCases
                  .length
              }
            </div>

            <div className="recovery-stat-description">
              Recovery cases awaiting
              payment
            </div>

          </div>

          <div className="recovery-panel recovery-stat">

            <div className="recovery-stat-header">
              <div className="recovery-overview-label">
                Recovered Cases
              </div>

              <div className="recovery-stat-icon">
                <CheckCircle2
                  size={15}
                />
              </div>
            </div>

            <div className="recovery-stat-value">
              {metrics.recoveredCases.length}
            </div>

            <div className="recovery-stat-description">
              Recovery actions completed
            </div>

          </div>

          {/* STOPPING RULE OVERVIEW */}

          <div className="recovery-panel recovery-stat recovery-stopping-stat">

            <div className="recovery-stat-header">
              <div className="recovery-overview-label">
                Stopping Rules
              </div>

              <div className="recovery-stat-icon">
                <Octagon size={15} />
              </div>
            </div>

            <div className="recovery-stat-value recovery-stopping-value">
              {metrics.stoppedCases.length}
            </div>

            <div className="recovery-stat-description">
              Automated recovery termination
              decisions
            </div>

          </div>

        </section>

        {/* ===================================================
            CASE TABLE
        =================================================== */}

        <section className="recovery-panel recovery-cases-panel">

          <div className="recovery-toolbar">

            <div className="recovery-toolbar-title">
              <h2>
                Recovery Cases
              </h2>

              <span className="recovery-count">
                {filteredCases.length}
              </span>
            </div>

            <div className="recovery-filters">

              <div className="recovery-search-wrapper">
                <Activity
                  size={13}
                  className="recovery-search-icon"
                />

                <input
                  className="recovery-input"
                  placeholder="Search case, order, user..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                />
              </div>

              <select
                className="recovery-select"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value
                  )
                }
              >
                <option value="ALL">
                  All statuses
                </option>

                <option value="PENDING">
                  Pending
                </option>

                <option value="PROCESSING">
                  Processing
                </option>

                <option value="ACTION_QUEUE">
                  Action Queue
                </option>

                <option value="ACTION_QUEUED">
                  Action Queued
                </option>

                <option value="AWAITING_PAYMENT">
                  Awaiting Payment
                </option>

                <option value="SUCCESS">
                  Success
                </option>

                <option value="RECOVERED">
                  Recovered
                </option>

                <option value="COMPLETED">
                  Completed
                </option>

                <option value="FAILED">
                  Failed
                </option>

                <option value="STOPPED">
                  Stopped
                </option>

                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>

              <select
                className="recovery-select"
                value={escalationFilter}
                onChange={(e) =>
                  setEscalationFilter(
                    e.target.value
                  )
                }
              >
                <option value="ALL">
                  All escalation
                </option>

                <option value="ESCALATED">
                  Escalated
                </option>

                <option value="PENDING">
                  Pending escalation
                </option>

                <option value="RESOLVED">
                  Resolved escalation
                </option>

                <option value="NONE">
                  No escalation
                </option>
              </select>

              {/* NEW STOPPING RULE FILTER */}

              <select
                className="recovery-select"
                value={stoppingRuleFilter}
                onChange={(e) =>
                  setStoppingRuleFilter(
                    e.target.value
                  )
                }
              >
                <option value="ALL">
                  All stopping rules
                </option>

                <option value="STOPPED">
                  Stopped
                </option>

                <option value="ACTIVE">
                  Not stopped
                </option>

                <option value="RECOVERY_SUCCESS">
                  Recovery success
                </option>

                <option value="MAX_ATTEMPTS">
                  Max attempts
                </option>

                <option value="COMPLIANCE_ESCALATION">
                  Compliance escalation
                </option>

                <option value="RECOVERY_DISABLED">
                  Recovery disabled
                </option>

                <option value="MIN_CART_VALUE">
                  Minimum cart value
                </option>

                <option value="DAILY_BUDGET">
                  Daily budget exceeded
                </option>

                <option value="NO_INTERVENTION">
                  No executable intervention
                </option>

                <option value="LOW_RECOVERY_VALUE">
                  Low recovery value
                </option>

                <option value="FAILED_ACTION">
                  Failed action
                </option>

                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>

            </div>
          </div>

          <div className="recovery-table-wrapper">

            <table className="recovery-table">

              <thead>
                <tr>
                  <th>
                    Case
                  </th>

                  <th>
                    Amount
                  </th>

                  <th>
                    Recovery State
                  </th>

                  <th>
                    Stopping Rule
                  </th>

                  <th>
                    Escalation
                  </th>

                  <th>
                    Selected Action
                  </th>

                  <th>
                    Action Status
                  </th>

                  <th>
                    Recovered
                  </th>

                  <th>
                    Created
                  </th>

                  <th>
                    Payment
                  </th>

                  <th>
                    Details
                  </th>
                </tr>
              </thead>

              <tbody>

                {filteredCases.map(
                  (item) => {
                    const log =
                      item.log;

                    const action =
                      item.action;

                    const escalation =
                      getEscalationInfo(
                        log
                      );

                    const stoppingRule =
                      getStoppingRuleInfo(
                        log,
                        action
                      );

                    const actionStatus =
                      action?.status ||
                      log.status ||
                      "UNKNOWN";

                    const recoveryState =
                      log.recovery_state ||
                      log.status ||
                      "UNKNOWN";

                    const paymentUrl =
                      action?.razorpay_payment_link_url;

                    const originalAmount =
                      Number(
                        log.original_amount ||
                          0
                      );

                    const recoveredAmount =
                      Number(
                        log.recovered_amount ||
                          0
                      );

                    const isExpanded =
                      expandedCaseId ===
                      log.id;

                    return (
                      <React.Fragment
                        key={log.id}
                      >

                        <tr>

                          {/* CASE */}

                          <td>
                            <div className="recovery-case">

                              <div className="recovery-case-top">

                                <div className="recovery-case-badge">
                                  #
                                </div>

                                <div>
                                  <div className="recovery-case-id">
                                    Case
                                  </div>

                                  <div className="recovery-case-reference">
                                    {shortId(
                                      log.id
                                    )}
                                  </div>
                                </div>

                              </div>

                              {log.order_id && (
                                <div className="recovery-case-reference">
                                  Order:{" "}
                                  {shortId(
                                    log.order_id
                                  )}
                                </div>
                              )}

                              {log.event_type && (
                                <div className="recovery-case-reference">
                                  {
                                    log.event_type
                                  }
                                </div>
                              )}

                            </div>
                          </td>

                          {/* AMOUNT */}

                          <td>
                            <div className="recovery-amount">
                              {money(
                                originalAmount
                              )}
                            </div>
                          </td>

                          {/* RECOVERY STATE */}

                          <td>
                            <span
                              className={getStatusClass(
                                recoveryState
                              )}
                            >
                              {getStatusIcon(
                                recoveryState
                              )}

                              {normalize(
                                recoveryState
                              )}
                            </span>
                          </td>

                          {/* STOPPING RULE */}

                          <td>

                            <span
                              className={getStoppingRuleClass(
                                stoppingRule
                              )}
                            >
                              {getStoppingRuleIcon(
                                stoppingRule
                              )}

                              {stoppingRule.stopped
                                ? stoppingRule.code
                                : "ACTIVE"}
                            </span>

                            <div className="stopping-detail">
                              {stoppingRule.title}
                            </div>

                          </td>

                          {/* ESCALATION */}

                          <td>

                            <span
                              className={getEscalationClass(
                                escalation
                              )}
                            >
                              {getEscalationIcon(
                                escalation
                              )}

                              {escalation.required
                                ? escalation.level
                                : "NONE"}
                            </span>

                            {escalation.required && (
                              <div className="escalation-detail">
                                {normalize(
                                  escalation.status
                                )}{" "}
                                ·{" "}
                                {
                                  escalation.reason
                                }
                              </div>
                            )}

                            {escalation.required &&
                              escalation.status === "PENDING" && (
                                <div className="recovery-review-actions">
                                  <button
                                    type="button"
                                    className="recovery-review-button recovery-review-start"
                                    disabled={reviewingCaseId !== null}
                                    onClick={() =>
                                      handleManualReview(
                                        log,
                                        "START_REVIEW"
                                      )
                                    }
                                  >
                                    {reviewingCaseId === log.id ? (
                                      <Loader2
                                        size={11}
                                        className="recovery-spinner"
                                      />
                                    ) : (
                                      <Clock3 size={11} />
                                    )}
                                    Start Review
                                  </button>
                                </div>
                              )}

                            {escalation.required &&
                              escalation.status === "ACTIVE" && (
                                <div className="recovery-review-actions">
                                  <button
                                    type="button"
                                    className="recovery-review-button recovery-review-resolve"
                                    disabled={reviewingCaseId !== null}
                                    onClick={() =>
                                      handleManualReview(
                                        log,
                                        "RESOLVE"
                                      )
                                    }
                                  >
                                    {reviewingCaseId === log.id ? (
                                      <Loader2
                                        size={11}
                                        className="recovery-spinner"
                                      />
                                    ) : (
                                      <CheckCircle2 size={11} />
                                    )}
                                    Resolve
                                  </button>

                                  <button
                                    type="button"
                                    className="recovery-review-button recovery-review-reject"
                                    disabled={reviewingCaseId !== null}
                                    onClick={() =>
                                      handleManualReview(
                                        log,
                                        "REJECT"
                                      )
                                    }
                                  >
                                    <XCircle size={11} />
                                    Reject
                                  </button>
                                </div>
                              )}

                            {reviewingCaseId === log.id && (
                              <div className="recovery-review-processing">
                                <Loader2
                                  size={11}
                                  className="recovery-spinner"
                                />
                                Updating review...
                              </div>
                            )}

                          </td>

                          {/* ACTION */}

                          <td>

                            <div className="recovery-action">
                              {log.selected_action ||
                                action?.action_type ||
                                "NO ACTION"}
                            </div>

                            {log.recovery_score !==
                              null && (
                              <div className="recovery-action-score">
                                AI score{" "}
                                {Number(
                                  log.recovery_score
                                ).toFixed(2)}
                              </div>
                            )}

                          </td>

                          {/* ACTION STATUS */}

                          <td>

                            <span
                              className={getStatusClass(
                                actionStatus
                              )}
                            >
                              {getStatusIcon(
                                actionStatus
                              )}

                              {normalize(
                                actionStatus
                              )}
                            </span>

                          </td>

                          {/* RECOVERED */}

                          <td>

                            {recoveredAmount >
                            0 ? (
                              <div className="recovery-recovered">
                                {money(
                                  recoveredAmount
                                )}
                              </div>
                            ) : (
                              <div className="recovery-not-recovered">
                                —
                              </div>
                            )}

                          </td>

                          {/* CREATED */}

                          <td>

                            <div className="recovery-created">
                              {formatDate(
                                log.created_at
                              )}
                            </div>

                            <div className="recovery-attempt">
                              Attempt{" "}
                              {stoppingRule.attemptCount}
                              {stoppingRule.maxAttempts
                                ? ` / ${stoppingRule.maxAttempts}`
                                : ""}
                            </div>

                          </td>

                          {/* PAYMENT */}

                          <td>

                            {paymentUrl ? (
                              <button
                                className="recovery-action-button"
                                onClick={() => {
                                  window.open(
                                    paymentUrl,
                                    "_blank",
                                    "noopener,noreferrer"
                                  );
                                }}
                              >
                                <ExternalLink
                                  size={12}
                                />

                                Open UPI
                              </button>
                            ) : normalize(
                                action?.status
                              ) ===
                              "AWAITING_PAYMENT" ? (
                              <span className="recovery-small">
                                Link unavailable
                              </span>
                            ) : (
                              <span className="recovery-small">
                                —
                              </span>
                            )}

                          </td>

                          {/* DETAILS */}

                          <td>

                            <button
                              className="recovery-expand-button"
                              onClick={() =>
                                setExpandedCaseId(
                                  isExpanded
                                    ? null
                                    : log.id
                                )
                              }
                              title={
                                isExpanded
                                  ? "Hide details"
                                  : "Show details"
                              }
                            >
                              {isExpanded ? (
                                <ChevronUp
                                  size={14}
                                />
                              ) : (
                                <ChevronDown
                                  size={14}
                                />
                              )}
                            </button>

                          </td>

                        </tr>

                        {/* =================================================
                            EXPANDED DETAILS
                        ================================================= */}

                        {isExpanded && (
                          <tr className="recovery-expanded-row">

                            <td colSpan={11}>

                              <div className="recovery-expanded-content">

                                {/* VISIBLE RECOVERY AUDIT TRAIL */}
                                {(() => {
                                  const auditTrail =
                                    getRecoveryAuditTrail(
                                      log,
                                      action,
                                      escalation,
                                      stoppingRule
                                    );

                                  return (
                                    <div className="recovery-audit-trail">
                                      <div className="recovery-audit-head">
                                        <div>
                                          <div className="recovery-audit-title">
                                            <Activity size={13} />
                                            Recovery Audit Trail
                                          </div>
                                          <div className="recovery-audit-subtitle">
                                            Chronological evidence from persisted recovery records.
                                          </div>
                                        </div>

                                        <div className="recovery-audit-count">
                                          {auditTrail.length} recorded events
                                        </div>
                                      </div>

                                      <div className="recovery-audit-ids">
                                        <span className="recovery-audit-id">
                                          Case: {log.id}
                                        </span>

                                        {log.order_id && (
                                          <span className="recovery-audit-id">
                                            Order: {log.order_id}
                                          </span>
                                        )}

                                        {action?.id && (
                                          <span className="recovery-audit-id">
                                            Action: {action.id}
                                          </span>
                                        )}
                                      </div>

                                      <div className="recovery-audit-list">
                                        {auditTrail.map(
                                          (event, index) => (
                                            <div
                                              className="recovery-audit-event"
                                              key={`${event.title}-${event.timestamp || "na"}-${index}`}
                                            >
                                              <div className="recovery-audit-dot" />

                                              <div>
                                                <div className="recovery-audit-event-title">
                                                  {event.title}
                                                </div>
                                                <div className="recovery-audit-status">
                                                  {event.status}
                                                </div>
                                              </div>

                                              <div className="recovery-audit-evidence">
                                                {event.evidence}
                                              </div>

                                              <div>
                                                <div className="recovery-audit-time">
                                                  {event.timestamp
                                                    ? formatDate(event.timestamp)
                                                    : "Timestamp not persisted"}
                                                </div>
                                                <div className="recovery-audit-source">
                                                  {event.source}
                                                </div>
                                              </div>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* STOPPING RULE AUDIT */}

                                <div
                                  className="recovery-detail-card"
                                  style={{
                                    borderColor:
                                      stoppingRule.stopped
                                        ? "rgba(239,68,68,.30)"
                                        : "rgba(34,197,94,.30)",
                                  }}
                                >

                                  <div className="recovery-detail-label">
                                    Stopping Rule Audit
                                  </div>

                                  <div className="recovery-detail-value">

                                    <span
                                      style={{
                                        color:
                                          stoppingRule.stopped
                                            ? "#fca5a5"
                                            : "#86efac",
                                      }}
                                    >
                                      {stoppingRule.stopped
                                        ? stoppingRule.title
                                        : "NO STOPPING RULE TRIGGERED"}
                                    </span>

                                  </div>

                                  <div className="recovery-detail-muted">
                                    Code:{" "}
                                    {
                                      stoppingRule.code
                                    }
                                  </div>

                                  <div className="recovery-detail-muted">
                                    Source:{" "}
                                    {
                                      stoppingRule.source
                                    }
                                  </div>

                                </div>

                                {/* STOPPING REASON */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Stop Reason
                                  </div>

                                  <div className="recovery-detail-value">

                                    {stoppingRule.stopped
                                      ? stoppingRule.reason
                                      : log.stop_reason ||
                                        "Recovery remains eligible for continuation."}

                                  </div>

                                </div>

                                {/* ATTEMPT POLICY */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Attempt Policy
                                  </div>

                                  <div className="recovery-detail-value">

                                    {stoppingRule.attemptCount}
                                    {" / "}
                                    {stoppingRule.maxAttempts ??
                                      "—"}

                                  </div>

                                  <div className="recovery-detail-muted">

                                    {stoppingRule.maxAttempts
                                      ? stoppingRule.attemptCount >=
                                        stoppingRule.maxAttempts
                                        ? "Attempt limit reached"
                                        : "Attempt limit not reached"
                                      : "No attempt limit available"}

                                  </div>

                                </div>

                                {/* TERMINAL STATE */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Terminal State
                                  </div>

                                  <div className="recovery-detail-value">

                                    {stoppingRule.terminal
                                      ? "YES — NO FURTHER AUTOMATED RECOVERY"
                                      : "NO — RECOVERY MAY CONTINUE"}

                                  </div>

                                  <div className="recovery-detail-muted">
                                    Dashboard classification
                                  </div>

                                </div>

                                {/* FUND ROUTING & EXECUTION AUDIT */}

                                {(() => {
                                  const executionAudit =
                                    getExecutionAuditInfo(
                                      log,
                                      action
                                    );

                                  const executionBlocked =
                                    executionAudit.mode.includes(
                                      "COMPLIANCE BLOCKED"
                                    );

                                  const executionFailed =
                                    executionAudit.mode ===
                                    "EXECUTION FAILED";

                                  const executionCompleted =
                                    executionAudit.mode ===
                                    "EXECUTED";

                                  return (
                                    <div
                                      className="recovery-detail-card"
                                      style={{
                                        borderColor:
                                          executionBlocked
                                            ? "rgba(245,158,11,.35)"
                                            : executionFailed
                                            ? "rgba(239,68,68,.30)"
                                            : executionCompleted
                                            ? "rgba(34,197,94,.30)"
                                            : "rgba(59,130,246,.25)",
                                      }}
                                    >

                                      <div className="recovery-detail-label">
                                        Fund Routing & Exec Audit
                                      </div>

                                      <div
                                        className="recovery-detail-value"
                                        style={{
                                          color:
                                            executionBlocked
                                              ? "#fbbf24"
                                              : executionFailed
                                              ? "#fca5a5"
                                              : executionCompleted
                                              ? "#86efac"
                                              : "#93c5fd",
                                        }}
                                      >
                                        {executionAudit.mode}
                                      </div>

                                      <div className="recovery-detail-muted">
                                        Channel: {executionAudit.channel}
                                      </div>

                                      <div className="recovery-detail-muted">
                                        Executor blocked: {
                                          executionAudit.executorBlocked ===
                                          null
                                            ? "—"
                                            : executionAudit.executorBlocked
                                            ? "YES"
                                            : "NO"
                                        }
                                      </div>

                                      <div className="recovery-detail-muted">
                                        Automated action blocked: {
                                          executionAudit.automatedActionBlocked ===
                                          null
                                            ? "—"
                                            : executionAudit.automatedActionBlocked
                                            ? "YES"
                                            : "NO"
                                        }
                                      </div>

                                      <div className="recovery-detail-muted">
                                        Audit required: {
                                          executionAudit.auditRequired ===
                                          null
                                            ? "—"
                                            : executionAudit.auditRequired
                                            ? "YES"
                                            : "NO"
                                        }
                                      </div>

                                      <div className="recovery-detail-muted">
                                        Intervention: {executionAudit.intervention}
                                      </div>

                                      {executionAudit.financialExecution && (
                                        <div className="recovery-detail-muted">
                                          Financial execution: {executionAudit.financialExecution}
                                        </div>
                                      )}

                                      {executionAudit.error && (
                                        <div
                                          className="recovery-detail-muted"
                                          style={{ color: "#fca5a5" }}
                                        >
                                          Error: {executionAudit.error}
                                        </div>
                                      )}

                                      <div className="recovery-detail-muted">
                                        Reason: {executionAudit.reason}
                                      </div>

                                      <div className="recovery-detail-muted">
                                        Source: {executionAudit.source}
                                      </div>

                                    </div>
                                  );
                                })()}

                                {/* COMPLIANCE */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Compliance Level
                                  </div>

                                  <div className="recovery-detail-value">
                                    {escalation.required
                                      ? escalation.level
                                      : "NO ESCALATION"}
                                  </div>

                                  <div className="recovery-detail-muted">
                                    Status:{" "}
                                    {normalize(
                                      escalation.status
                                    )}
                                  </div>

                                </div>

                                {/* ESCALATION REASON */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Escalation Reason
                                  </div>

                                  <div className="recovery-detail-value">
                                    {
                                      escalation.reason
                                    }
                                  </div>

                                </div>

                                {/* REQUIRED ACTION */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Required Action
                                  </div>

                                  <div className="recovery-detail-value">
                                    {
                                      escalation.action
                                    }
                                  </div>

                                </div>

                                {/* COMPLIANCE POLICY */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Compliance Policy
                                  </div>

                                  <div className="recovery-detail-value">
                                    {escalation.policy !== "—"
                                      ? escalation.policy
                                      : escalation.required
                                      ? "COMPLIANT_ESCALATION"
                                      : "—"}
                                  </div>

                                  {escalation.required && (
                                    <div className="recovery-detail-muted" style={{ marginTop: 8 }}>
                                      <div>
                                        Channel: {
                                          getObjectValue(
                                            log.policy_evaluation,
                                            ["compliance_escalation", "complianceEscalation"]
                                          )?.channel || "MANUAL_REVIEW"
                                        }
                                      </div>
                                      <div>
                                        Audit required: {
                                          getObjectValue(
                                            getObjectValue(
                                              log.policy_evaluation,
                                              ["compliance_escalation", "complianceEscalation"]
                                            ),
                                            ["audit_required", "auditRequired"]
                                          ) === true
                                            ? "YES"
                                            : normalize(
                                                getObjectValue(
                                                  getObjectValue(
                                                    log.policy_evaluation,
                                                    ["compliance_escalation", "complianceEscalation"]
                                                  ),
                                                  ["audit_required", "auditRequired"]
                                                )
                                              ) === "YES"
                                            ? "YES"
                                            : "NO"
                                        }
                                      </div>
                                      <div>
                                        Executor blocked: {
                                          getObjectValue(
                                            getObjectValue(
                                              log.policy_evaluation,
                                              ["compliance_escalation", "complianceEscalation"]
                                            ),
                                            ["executor_blocked", "executorBlocked"]
                                          ) === true
                                            ? "YES"
                                            : normalize(
                                                getObjectValue(
                                                  getObjectValue(
                                                    log.policy_evaluation,
                                                    ["compliance_escalation", "complianceEscalation"]
                                                  ),
                                                  ["executor_blocked", "executorBlocked"]
                                                )
                                              ) === "YES"
                                            ? "YES"
                                            : "NO"
                                        }
                                      </div>
                                      <div>
                                        Automated action blocked: {
                                          getObjectValue(
                                            getObjectValue(
                                              log.policy_evaluation,
                                              ["compliance_escalation", "complianceEscalation"]
                                            ),
                                            ["automated_action_blocked", "automatedActionBlocked"]
                                          ) === true
                                            ? "YES"
                                            : normalize(
                                                getObjectValue(
                                                  getObjectValue(
                                                    log.policy_evaluation,
                                                    ["compliance_escalation", "complianceEscalation"]
                                                  ),
                                                  ["automated_action_blocked", "automatedActionBlocked"]
                                                )
                                              ) === "YES"
                                            ? "YES"
                                            : "NO"
                                        }
                                      </div>
                                    </div>
                                  )}

                                </div>

                                {/* ESCALATED AT */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Escalated At
                                  </div>

                                  <div className="recovery-detail-value">
                                    {formatDate(
                                      escalation.escalatedAt
                                    )}
                                  </div>

                                </div>

                                {/* RESOLVED AT */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Resolved At
                                  </div>

                                  <div className="recovery-detail-value">
                                    {formatDate(
                                      escalation.resolvedAt
                                    )}
                                  </div>

                                </div>

                                {/* REVIEWED AT */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Reviewed At
                                  </div>

                                  <div className="recovery-detail-value">
                                    {formatDate(
                                      escalation.reviewedAt
                                    )}
                                  </div>

                                  <div className="recovery-detail-muted">
                                    Backend review timestamp
                                  </div>

                                </div>

                                {/* RESOLUTION REASON */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Resolution Reason
                                  </div>

                                  <div className="recovery-detail-value">
                                    {escalation.resolutionReason}
                                  </div>

                                </div>

                                {/* AI DECISION SUMMARY */}

                                {(() => {
                                  const aiSummary =
                                    getAiDiagnosisSummary(
                                      log.ai_diagnosis
                                    );

                                  return (
                                    <div className="recovery-detail-card recovery-detail-card-wide">
                                      <div className="recovery-detail-label">
                                        AI Decision Summary
                                      </div>

                                      <div className="recovery-detail-value">
                                        {aiSummary.diagnosis}
                                      </div>

                                      <div className="recovery-readable-grid">
                                        {aiSummary.recommendedAction && (
                                          <div className="recovery-readable-item">
                                            <span>Recommended action</span>
                                            <strong>
                                              {aiSummary.recommendedAction}
                                            </strong>
                                          </div>
                                        )}

                                        {aiSummary.confidence !== null && (
                                          <div className="recovery-readable-item">
                                            <span>AI confidence</span>
                                            <strong>
                                              {(aiSummary.confidence * 100).toFixed(0)}%
                                            </strong>
                                          </div>
                                        )}

                                        {aiSummary.topMethod && (
                                          <div className="recovery-readable-item">
                                            <span>Best alternate route</span>
                                            <strong>
                                              {aiSummary.topMethod}
                                            </strong>
                                          </div>
                                        )}

                                        {aiSummary.topMethodProbability !== null && (
                                          <div className="recovery-readable-item">
                                            <span>Route probability</span>
                                            <strong>
                                              {(aiSummary.topMethodProbability * 100).toFixed(0)}%
                                            </strong>
                                          </div>
                                        )}
                                      </div>

                                      {aiSummary.evidence.length > 0 && (
                                        <div className="recovery-readable-reason">
                                          <span>Why the system chose this route</span>
                                          <div>
                                            {aiSummary.evidence[0]}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* POLICY GUARDRAILS */}

                                {(() => {
                                  const policySummary =
                                    getPolicySummary(
                                      log.policy_evaluation,
                                      action
                                    );

                                  return (
                                    <div className="recovery-detail-card recovery-detail-card-wide">
                                      <div className="recovery-detail-label">
                                        Recovery Policy Guardrails
                                      </div>

                                      <div className="recovery-readable-grid">
                                        <div className="recovery-readable-item">
                                          <span>Recovery</span>
                                          <strong>
                                            {policySummary.recoveryEnabled}
                                          </strong>
                                        </div>

                                        <div className="recovery-readable-item">
                                          <span>Attempts</span>
                                          <strong>
                                            {policySummary.retryCount !== null
                                              ? policySummary.retryCount
                                              : "—"}
                                            {" / "}
                                            {policySummary.maxRetries !== null
                                              ? policySummary.maxRetries
                                              : "—"}
                                          </strong>
                                        </div>

                                        <div className="recovery-readable-item">
                                          <span>Minimum order value</span>
                                          <strong>
                                            {policySummary.minimumValue !== null
                                              ? money(policySummary.minimumValue)
                                              : "—"}
                                          </strong>
                                        </div>

                                        <div className="recovery-readable-item">
                                          <span>Expected recovery</span>
                                          <strong>
                                            {policySummary.expectedRecovery !== null
                                              ? money(policySummary.expectedRecovery)
                                              : "—"}
                                          </strong>
                                        </div>

                                        <div className="recovery-readable-item">
                                          <span>Selected intervention</span>
                                          <strong>
                                            {policySummary.selectedIntervention || "—"}
                                          </strong>
                                        </div>

                                        <div className="recovery-readable-item">
                                          <span>Failed payment method</span>
                                          <strong>
                                            {policySummary.failedPaymentMethod || "—"}
                                          </strong>
                                        </div>

                                        <div className="recovery-readable-item">
                                          <span>Daily recovery budget</span>
                                          <strong>
                                            {policySummary.dailyBudgetUsed !== null ||
                                            policySummary.dailyBudgetLimit !== null
                                              ? `${money(
                                                  policySummary.dailyBudgetUsed || 0
                                                )} / ${money(
                                                  policySummary.dailyBudgetLimit || 0
                                                )}`
                                              : "—"}
                                          </strong>
                                        </div>

                                        <div className="recovery-readable-item">
                                          <span>Original order paid</span>
                                          <strong>
                                            {policySummary.originalOrderPaid
                                              ? "Yes"
                                              : "No"}
                                          </strong>
                                        </div>
                                      </div>

                                      <div className="recovery-readable-footer">
                                        {policySummary.complianceRequired
                                          ? "Compliance review is required before automated recovery."
                                          : "No compliance escalation is required for this case."}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* RAW STOP REASON */}

                                <div className="recovery-detail-card">

                                  <div className="recovery-detail-label">
                                    Stopping Decision
                                  </div>

                                  <div className="recovery-detail-value">
                                    {log.stop_reason ||
                                      "Not explicitly recorded"}
                                  </div>

                                  <div className="recovery-detail-muted">
                                    Recorded reason used by the recovery workflow
                                  </div>

                                </div>

                              </div>

                            </td>

                          </tr>
                        )}

                      </React.Fragment>
                    );
                  }
                )}

              </tbody>

            </table>

            {filteredCases.length === 0 && (
              <div className="recovery-empty">

                <div className="recovery-empty-icon">
                  <ShieldCheck
                    size={23}
                  />
                </div>

                <div className="recovery-empty-title">
                  No recovery cases found
                </div>

                <div className="recovery-empty-description">
                  Try changing the search,
                  recovery status,
                  escalation filter or
                  stopping-rule filter.
                </div>

              </div>
            )}

          </div>

        </section>

      </div>
    </div>
  );
};

export default RecoveryDashboard;