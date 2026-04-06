## Plan: Super Admin Critical Gaps Implementation

### 1. Staff Account Creation (Edge Function + UI)
- Create `create-staff-account` Edge Function that uses service role to create auth users with admin/kiosk roles
- Add UI dialog in User Management page to create staff accounts (email, password, role, campus)

### 2. Role Management UI
- Add role change functionality to User Management page
- Create `update-user-role` Edge Function to safely promote/demote users
- Include delete user capability

### 3. Order Management Enhancement
- Add order detail drill-down dialog in Super Admin Orders
- Add refund status tracking
- Add bulk actions (mark collected, export)

### 4. Revenue Analytics
- Build daily/weekly/monthly revenue charts per campus using Recharts
- Add campus comparison view
- Add CSV export functionality

### 5. Campus Onboarding Wizard
- Multi-step wizard: Basic Info → Payment Config → Create First Admin
- Uses existing campus creation + new staff account Edge Function

### 6. Notifications/Alerts System
- Create `platform_alerts` table for system alerts
- Add real-time alerts: payment failures, low stock, settlement due dates
- Wire up the bell icon with a dropdown showing alerts

### 7. Campus Health Monitor
- New dashboard widget showing all campuses with live stats
- Last order time, today's order count, active status
- Color-coded health indicators

### Implementation Order:
1. Edge Functions first (staff creation, role management) — these unblock other features
2. Database migration for alerts table
3. UI components for all 7 features

### Note:
- All Edge Functions will validate JWT and check super_admin role
- All UI will use existing design system tokens
- Mobile-optimized layouts throughout