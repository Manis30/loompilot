# LoomPilot Role-Permission Matrix

## 1. Roles Definition
LoomPilot defines five distinct operational roles across textile manufacturing operations:
- **`owner`**: Business executive / proprietor. Full visibility and configuration authority.
- **`manager`**: Factory / operations manager. Manages workforce, oversees production orders, and handles recovery recommendations.
- **`sales`**: Sales executive. Handles customer enquiries, quotation creation, quotation dispatch, and customer communications.
- **`store`**: Warehouse / inventory clerk. Handles stock levels, material receipts, and issues.
- **`accounts`**: Finance officer. Manages invoices, payment terms, collections, and approves reminder notifications.

---

## 2. Permission Matrix

| Resource / Action | Owner | Manager | Sales | Store | Accounts | Notes / Enforced Guards |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Auth & Users** | | | | | | |
| View Users | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Manage Users / Roles | ✅ | ❌ | ❌ | ❌ | ❌ | Owner only |
| **Enquiries & Quotations** | | | | | | |
| Create / View Enquiries | ✅ | ✅ | ✅ | ❌ | ❌ | |
| Generate Draft Quotation | ✅ | ✅ | ✅ | ❌ | ❌ | Triggers AI Quotation Agent |
| View Quotation Details | ✅ | ✅ | ✅ | ❌ | ✅ | |
| View Cost Breakdown & Margin | ✅ | ✅ | ✅ | ❌ | ✅ | **`store` strictly blocked from cost & margin** |
| Approve Quotation | ✅ | ✅ | ❌ | ❌ | ❌ | Requires management authorization |
| Send Quotation to Customer | ✅ | ✅ | ✅ | ❌ | ❌ | Generates PDF and logs dispatch |
| Confirm Order (Transactional) | ✅ | ✅ | ❌ | ❌ | ❌ | Reserves stock & creates production plan |
| **Materials & Inventory** | | | | | | |
| View Stock Levels | ✅ | ✅ | ✅ | ✅ | ✅ | All operational roles |
| View Raw Material Cost / Rates | ✅ | ✅ | ❌ | ❌ | ✅ | **`store` and `sales` blocked from purchase costs** |
| Record Stock Movement (In/Out) | ✅ | ✅ | ❌ | ✅ | ❌ | Store & plant management |
| Manage Suppliers & Lead Times | ✅ | ✅ | ❌ | ✅ | ❌ | |
| **Workforce & Production** | | | | | | |
| Manage Workers & Attendance | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Record Daily Output | ✅ | ✅ | ❌ | ❌ | ❌ | Shop-floor entry; idempotent |
| View Production Orders | ✅ | ✅ | ✅ | ✅ | ✅ | Overall progress visibility |
| View Output Variance Chart | ✅ | ✅ | ✅ | ❌ | ❌ | |
| **Alerts & Recovery** | | | | | | |
| View Production Alerts | ✅ | ✅ | ❌ | ❌ | ❌ | Alert feed & push notifications |
| Accept / Reject Recommendations| ✅ | ✅ | ❌ | ❌ | ❌ | Pure advisory proposals |
| **Deliveries & Payments** | | | | | | |
| Record Delivery | ✅ | ✅ | ❌ | ✅ | ❌ | Marks order fulfilled & triggers payment flow |
| View Payments & Deliveries | ✅ | ✅ | ❌ | ❌ | ✅ | |
| Draft Payment Reminders | ✅ | ❌ | ❌ | ❌ | ✅ | AI creates drafts |
| **Approve Payment Reminders** | ❌ | ❌ | ❌ | ❌ | ✅ | **Strictly exclusive to `accounts`** |
| **Reports & Analytics** | | | | | | |
| View Margin Report | ✅ | ❌ | ❌ | ❌ | ✅ | Sensitive financial metrics |
| View On-Time Delivery Rate | ✅ | ✅ | ✅ | ❌ | ❌ | Operational efficiency |
| View Collections Report | ✅ | ❌ | ❌ | ❌ | ✅ | Receivables status |

---

## 3. Explicit Security Rules & Tests
1. **Rule 1 (Store Cost Masking)**: Whenever a user with the `store` role queries materials, quotations, or orders, all cost fields (`unitCostPaise`, `totalCostPaise`, `marginPct`, `riskBufferPct`, `profitPaise`) must be stripped or blocked with a 403 Forbidden.
2. **Rule 2 (Accounts Exclusive Approval)**: Only users possessing the `accounts` role can call `POST /api/payments/:id/reminders/:reminderId/approve`. Attempting to call this endpoint as `owner`, `manager`, `sales`, or `store` results in a 403 Forbidden.
3. **Rule 3 (Service Token Bypass Immunity)**: The `/internal/*` routes accept exclusively valid `x-service-token` headers matching `INTERNAL_SERVICE_TOKEN`. User JWTs are rejected.

