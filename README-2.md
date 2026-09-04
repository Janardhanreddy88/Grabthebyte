# GrabTheByte — AI Revenue Recovery

GrabTheByte is a working campus-commerce application for campus food ordering and online payments.

For the Razorpay AI Buildathon, we implemented **Track 3 — AI Revenue Recovery** as a real end-to-end recovery system inside the application.

![AI Revenue Recovery Architecture](ai-revenue-recovery-architecture.png)

---

## What We Built

Payment failures are not handled as simple blind retries.

The system:

- Detects Razorpay payment failures through webhooks
- Analyzes failure context using AI
- Evaluates recovery constraints before acting
- Selects an appropriate recovery strategy
- Supports **UPI, Card, Netbanking and Wallet** recovery paths
- Creates a Razorpay Payment Link for the selected recovery action
- Delivers the recovery link to the customer
- Tracks **actual customer payment attempts**
- Supports sequential recovery actions after failed retries
- Reconciles successful and failed retry payments through Razorpay webhooks
- Maintains recovery status, history and stopping controls
- Provides recovery visibility through the dashboard

The result is a working recovery loop rather than an AI recommendation alone.

---

## AI Revenue Recovery Flow

```text
Customer Payment Fails
          ↓
   Razorpay Webhook
          ↓
      AI Analysis
          ↓
 Policy + Recovery Decision
          ↓
    Recovery Action
          ↓
 Razorpay Payment Link
          ↓
 Customer Retry Attempt
          ↓
   Razorpay Webhook
          ↓
Recovered / Retry / Stopped
```

A failed recovery attempt can trigger the next recovery action, while the system keeps the previous action recorded and tracks the customer's real retry history.

---

## Recovery Strategies

```text
             Recovery Decision
                    ↓
       ┌────────────┼────────────┐
       ↓            ↓            ↓
      UPI          CARD      NETBANKING
                    │
                    └──────→ WALLET
```

The recovery flow can select a different payment route when another customer retry is required.

---

## Track 3 Implementation

This repository contains the complete GrabTheByte application.

For the **AI Revenue Recovery** implementation, start with these files:

```text
supabase/functions/
│
├── handle-webhook/
│   └── Razorpay payment event handling
│
├── revenue-recovery-webhook/
│   └── AI recovery decision and orchestration
│
├── revenue-recovery-executor/
│   └── Executes the selected recovery action
│
└── revenue-recovery-email/
    └── Delivers the recovery Payment Link

src/pages/
└── RecoveryDashboard.tsx
    └── Recovery monitoring and visibility
```

### What each part does

**`handle-webhook`**  
Receives Razorpay payment events, maps recovery payments back to the order and processes retry outcomes.

**`revenue-recovery-webhook`**  
Runs the recovery workflow, evaluates the available recovery context and produces the next recovery decision.

**`revenue-recovery-executor`**  
Executes the selected recovery action and creates the Razorpay Payment Link.

**`revenue-recovery-email`**  
Delivers the recovery Payment Link to the customer.

**`RecoveryDashboard.tsx`**  
Provides visibility into recovery actions, statuses, attempts and outcomes.

---

## Recovery Tracking

The system distinguishes between **creating a recovery action** and an **actual customer payment attempt**.

Example:

```text
Original Payment
      ↓
     FAIL
      ↓
Recovery Action #1 — CARD
      ↓
Customer Attempts Payment
      ↓
     FAIL
      ↓
Recovery Action #1 → FAILED
      ↓
Recovery Action #2 — UPI
      ↓
Customer Attempts Payment
      ↓
   SUCCESS
      ↓
Recovery Action #2 → SUCCESS
      ↓
Order → RECOVERED
```

Actual customer retry attempts are tracked across the recovery flow rather than treating action creation or Payment Link generation as a payment attempt.

---

## Recovery Controls

The recovery flow also maintains:

- Recovery history and action state
- Retry and attempt tracking
- Recovery stopping conditions
- Bounded recovery decisions
- Payment reconciliation
- Idempotent webhook handling
- Recovery dashboard visibility

---

## Run Locally

```bash
git clone <repository-url>
cd GrabTheByte
npm install
npm run dev
```

Then open the local URL provided by Vite.

