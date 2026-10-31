# LoomPilot Orders Write Paths & Atomic Invariants

## 1. Overview & Architectural Principles

The `orders` collection in LoomPilot is a high-concurrency "hot" document. In accordance with Schema v4 design and system architecture rules:
- **No Full Document Overwrites (`doc.save()` Forbidden):** Never issue `save()` on fetched documents. All mutations must use path-scoped atomic updates (`findOneAndUpdate` / `updateOne`) targeting only the sub-document or array being modified.
- **Optimistic Concurrency & Versioning:** Every write increments the document `version` counter (`$inc: { version: 1 }`).
- **Array Caps Enforced (`CAP_EXCEEDED`):** Bounded arrays (e.g. `quotation.revisions` max 5, `financials.milestones` max 10, `deliveries` max 20) are guarded prior to push operations.
- **Session & Transaction Binding:** Multi-entity operations (e.g. advance payment receipt, stock reservation, stock receipt, cancellation release) execute inside `MongoUnitOfWork.withTransaction(async (tx) => { ... })` sharing the MongoDB client session.

---

## 2. Supervisor Acknowledgment & Start Semantics

### 2.1 Multi-Supervisor Industrial Model
In textile and garment manufacturing, multiple supervisors manage different production stages for the same order (e.g., Yarn Stock, Knitting, Dyeing/Processing, Cutting, Stitching, Finishing).
Each supervisor entry is tracked in `production.assignedSupervisors`:
```json
{
  "supervisorId": "654321...",
  "processes": ["knitting"],
  "acknowledgedAt": null
}
```

### 2.2 Atomic Write Path with `arrayFilters`
When a supervisor calls `POST /api/v1/orders/:id/start`:
1. **Scoping & Authorization:** The server confirms the caller's role is `supervisor` and verifies `supervisorId` is present in `production.assignedSupervisors`.
2. **Atomic Targeted Mutation:** Instead of modifying the entire array or relying on positional `$` matches that could race across multiple concurrent supervisors, MongoDB `arrayFilters` targets only the calling supervisor's specific entry:
```typescript
const filter = {
  tenantId,
  _id: orderId,
  "production.assignedSupervisors.supervisorId": sId,
};

const update = {
  $set: {
    "production.assignmentStatus": "started",
    "production.assignedSupervisors.$[elem].acknowledgedAt": new Date(),
  },
  $inc: { version: 1 },
};

const options = {
  arrayFilters: [{ "elem.supervisorId": sId }],
  new: true,
  session: session ?? null,
};

await OrderModel.findOneAndUpdate(filter, update, options);
```

### 2.3 Status Transition Rules
- **First Acknowledgment:** When the first supervisor acknowledges and the order status is `assigned`, the order transitions atomically from `assigned` to `in_production`.
- **Subsequent Acknowledgments:** When additional assigned supervisors acknowledge while the order is already `in_production`, their individual `acknowledgedAt` timestamp is recorded via `arrayFilters` without failing or re-transitioning the overall order state.
- **Supervisor Response DTO:** The endpoint returns strictly `{ id, status, assignmentStatus }` to supervisors, omitting all financial, costing, and quotation data.

---

## 3. Stock Goods Receipt Transactional Path

When receiving materials against an order's purchase decision (`POST /api/v1/stock/receipt` with `orderId` and `purchaseDecisionId`), three operations execute inside a single MongoDB transaction:
1. **Material Inventory Increment:**
   `materials.stockQty += qty`
2. **Immutable Ledger Entry:**
   `stockMovements` receives a record of type `receipt` with:
   ```json
   {
     "materialId": "...",
     "type": "receipt",
     "qty": 500,
     "qtyAfter": 1500,
     "purchaseDecisionRef": {
       "orderId": "...",
       "decisionId": "PD-KNIT-01"
     }
   }
   ```
3. **Order Purchase Decision Update:**
   Updates the nested subdocument:
   ```typescript
   {
     $set: {
       "purchaseDecisions.$.supplierOrder.recvQty": newRecvQty,
       "purchaseDecisions.$.supplierOrder.status": newRecvQty >= targetQty ? "received" : "partially_received",
       "purchaseDecisions.$.supplierOrder.recvAt": new Date(),
     },
     $inc: { version: 1 }
   }
   ```

---

## 4. Quotation Revision Conditional Decision Path

When a price surge or scope change triggers a revision (`quotation.revisions[n]`), the client makes a decision (`POST /api/v1/client/orders/:id/quotation/accept` or `decline` with `revisionNo`):

### 4.1 Conditional Array Update
The update matches only the revision in actionable status (`sent`, `proposed`, `approved`):
```typescript
const filter = {
  tenantId,
  _id: orderId,
  "quotation.revisions": {
    $elemMatch: { revisionNo, status: { $in: ["sent", "proposed", "approved"] } },
  },
};
```

### 4.2 Revision Accepted
- `quotation.revisions.$[elem].status = "accepted"`
- `quotation.totalPaise = revision.newPricePaise`
- `quotation.unitPricePaise = round(newPricePaise / order.quantity)`
- `financials.milestones` recomputed via `splitPaise` using the schedule percentages
- Order status moves to `client_accepted` if previously `quotation_sent`.

### 4.3 Revision Declined
- `quotation.revisions.$[elem].status = "declined"`
- `quotation.revisions.$[elem].clientDecision = { decision: "declined", reason, at: now }`
- **Original Quotation Price Stands:** No changes to `quotation.totalPaise`, `quotation.unitPricePaise`, or milestones.
- **Admin Alert Dispatched:** An in-app alert notification of `kind: "alert"` and `type: "quotation_revision_declined"` is sent to the tenant administrator.

