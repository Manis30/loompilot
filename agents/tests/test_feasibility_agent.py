import copy
from datetime import date, timedelta
import pytest

from app.data.data_repository import (
    DataRepository,
    OrderNotFoundError,
    ProductNotFoundError,
)
from app.agents.feasibility.agent import FeasibilityAgent
from app.schemas.feasibility_schema import (
    FeasibilityEvaluationRequest,
    FeasibilityEvaluationResponse,
)


@pytest.fixture
def agent(real_repository: DataRepository) -> FeasibilityAgent:
    """Fixture providing initialized FeasibilityAgent with real repository."""
    return FeasibilityAgent(repository=real_repository)


# ------------------------------------------------------------------------------
# Test 1: Order is fully feasible
# ------------------------------------------------------------------------------
def test_order_fully_feasible(agent: FeasibilityAgent, monkeypatch):
    """Test 1: Verify order is FEASIBLE when materials are in stock, machines ready, and delivery met."""
    # Mock committed stock to 0 to simulate abundant available stock
    monkeypatch.setattr(agent.repository, "get_committed_stock", lambda exclude_order_id=None: {})

    # Evaluate small order (50 units) of Cotton T-Shirt with delivery date 30 days away
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=50,
        requiredDeliveryDate=date(2026, 11, 30),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.success is True
    assert resp.assessmentStatus == "FEASIBLE"
    assert resp.delayDays == 0
    assert resp.earliestFeasibleDeliveryDate is not None
    assert resp.earliestFeasibleDeliveryDate <= "2026-11-30"
    assert resp.checks.material.shortagesCount == 0
    assert resp.checks.material.isFeasible is True
    assert "fully feasible" in resp.summary.lower()


# ------------------------------------------------------------------------------
# Test 2: Material shortage with procurement possible
# ------------------------------------------------------------------------------
def test_material_shortage_procurement_possible(agent: FeasibilityAgent):
    """Test 2: Shortage identified, but preferred supplier lead time enables procurement."""
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        productId=1,
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.success is True
    # With active in-progress orders, cotton fabric has a shortage
    assert resp.checks.material.shortagesCount > 0
    assert resp.checks.material.maxProcurementLeadTimeDays == 4
    # Material is available after 4 days lead time (2026-11-03)
    assert resp.checks.material.materialAvailabilityDate == "2026-11-03"

    # Verify actionable recommendation exists for South Loom Supplies
    proc_recs = [r for r in resp.recommendations if r.category == "PROCUREMENT"]
    assert len(proc_recs) > 0
    assert "South Loom Supplies" in proc_recs[0].action


# ------------------------------------------------------------------------------
# Test 3: Material shortage with no reliable procurement information
# ------------------------------------------------------------------------------
def test_material_shortage_no_supplier(agent: FeasibilityAgent, monkeypatch):
    """Test 3: Shortage exists and material has no supplier info -> status FAIL."""
    orig_get_mat = agent.repository.get_material

    def mock_get_material(mat_id):
        data = copy.deepcopy(orig_get_mat(mat_id))
        if data["MaterialID"] == 1:
            data["supplier"] = None  # Strip supplier
            data["PreferredSupplierID"] = 0
            data["CurrentStock"] = 0  # Force shortage
        return data

    monkeypatch.setattr(agent.repository, "get_material", mock_get_material)

    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.checks.material.isFeasible is False
    assert resp.checks.material.status == "FAIL"
    # Find critical issue
    crit_issues = [i for i in resp.issues if i.severity == "CRITICAL" and i.category == "MATERIAL_SHORTAGE"]
    assert len(crit_issues) > 0
    assert "without verified supplier" in crit_issues[0].title.lower()


# ------------------------------------------------------------------------------
# Test 4: Machine unavailable (all offline in a stage)
# ------------------------------------------------------------------------------
def test_machine_unavailable_all_maintenance(agent: FeasibilityAgent, monkeypatch):
    """Test 4: All machines in Cutting are offline in Maintenance -> NOT_FEASIBLE."""
    orig_get_machines = agent.repository.get_machines_by_stage

    def mock_get_machines(stage):
        machines = copy.deepcopy(orig_get_machines(stage))
        if stage == "Cutting":
            for m in machines:
                m["CurrentStatus"] = "Maintenance"
        return machines

    monkeypatch.setattr(agent.repository, "get_machines_by_stage", mock_get_machines)

    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.assessmentStatus == "NOT_FEASIBLE"
    assert resp.checks.machine.isFeasible is False
    crit_machine_issues = [i for i in resp.issues if i.severity == "CRITICAL" and i.category == "MACHINE_CONSTRAINT"]
    assert len(crit_machine_issues) > 0


# ------------------------------------------------------------------------------
# Test 5: Alternative compatible machine available
# ------------------------------------------------------------------------------
def test_alternative_compatible_machine_available(agent: FeasibilityAgent):
    """Test 5: ST-02 is in maintenance, but ST-01, ST-03, STI-04 are available alternatives."""
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    stitching_stage = next(s for s in resp.checks.machine.stages if s.stage == "Stitching")
    assert "ST-02" in stitching_stage.maintenanceMachines
    assert len(stitching_stage.availableMachines) >= 2
    assert len(stitching_stage.alternativeCompatibleMachines) >= 1

    # Verify recommendation to use compatible machines exists
    mach_recs = [r for r in resp.recommendations if r.category == "MACHINE"]
    assert len(mach_recs) > 0
    assert "Alternative Compatible Machines" in mach_recs[0].title


# ------------------------------------------------------------------------------
# Test 6: Workforce shortage
# ------------------------------------------------------------------------------
def test_workforce_shortage(agent: FeasibilityAgent, monkeypatch):
    """Test 6: Workforce below required headcount in Stitching triggers warning and recommendation."""
    orig_get_emp = agent.repository.get_employees_by_stage
    monkeypatch.setattr(
        agent.repository,
        "get_employees_by_stage",
        lambda stage: [] if stage == "Stitching" else orig_get_emp(stage)
    )

    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.checks.workforce.status == "WARNING"
    wf_issues = [i for i in resp.issues if i.category == "WORKFORCE_CONSTRAINT"]
    assert len(wf_issues) > 0
    assert "Stitching" in wf_issues[0].title


# ------------------------------------------------------------------------------
# Test 7: Existing order capacity conflict & committed stock protection
# ------------------------------------------------------------------------------
def test_existing_order_capacity_conflict(agent: FeasibilityAgent):
    """Test 7: Dynamic commitments from 15 active orders are deducted and conflict notes generated."""
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.checks.existingOrders.activeOrdersCount >= 14
    assert resp.checks.existingOrders.totalCommittedUnits > 2000
    # Material committed stock is non-zero
    cotton_item = next(it for it in resp.checks.material.items if it.materialId == 1)
    assert cotton_item.committedStock > 2000


# ------------------------------------------------------------------------------
# Test 8: Requested delivery date cannot be met, but a later date is feasible
# ------------------------------------------------------------------------------
def test_tight_deadline_delayed_but_feasible(agent: FeasibilityAgent):
    """Test 8: Requested delivery date is only 5 days away; feasible delivery date is calculated."""
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 4),  # 5 days from Oct 30
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.assessmentStatus == "CONDITIONALLY_FEASIBLE"
    assert resp.delayDays > 0
    assert resp.earliestFeasibleDeliveryDate is not None
    assert resp.earliestFeasibleDeliveryDate > "2026-11-04"

    # Schedule issue must be present explaining the delay
    sched_issues = [i for i in resp.issues if i.category == "SCHEDULE_CONFLICT"]
    assert len(sched_issues) > 0
    assert "deficit" in sched_issues[0].shortage.lower()


# ------------------------------------------------------------------------------
# Test 9: Hard manufacturing constraint
# ------------------------------------------------------------------------------
def test_hard_manufacturing_constraint(agent: FeasibilityAgent):
    """Test 9: Extreme order quantity (10,000,000 units) results in NOT_FEASIBLE."""
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=10_000_000,
        requiredDeliveryDate=date(2026, 11, 10),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.assessmentStatus == "NOT_FEASIBLE"
    assert resp.delayDays > 90
    assert "not feasible" in resp.summary.lower()


# ------------------------------------------------------------------------------
# Test 10: Missing product BOM
# ------------------------------------------------------------------------------
def test_missing_product_bom(agent: FeasibilityAgent, monkeypatch):
    """Test 10: Product has no BOM recipe -> status NEEDS_INFORMATION, earliest date is None."""
    monkeypatch.setattr(agent.repository, "get_product_bom", lambda prod_id: [])

    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.assessmentStatus == "NEEDS_INFORMATION"
    assert resp.earliestFeasibleDeliveryDate is None
    assert resp.confidence == "LOW"
    bom_issues = [i for i in resp.issues if "BOM" in i.title]
    assert len(bom_issues) > 0


# ------------------------------------------------------------------------------
# Test 11: Missing or insufficient historical production data
# ------------------------------------------------------------------------------
def test_missing_production_reports_data(agent: FeasibilityAgent, monkeypatch):
    """Test 11: Production reports empty -> uses validated default defect buffer without crashing."""
    monkeypatch.setattr(agent.repository, "get_production_quality_metrics", lambda: {
        "overallDefectRate": 0.0157,
        "stageDefectRates": {},
    })

    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.success is True
    assert resp.checks.productionSchedule is not None
    assert resp.checks.productionSchedule.qualityBufferDays == 1


# ------------------------------------------------------------------------------
# Test 12: Multiple constraints at the same time
# ------------------------------------------------------------------------------
def test_multiple_simultaneous_constraints(agent: FeasibilityAgent):
    """Test 12: Material shortage, machine maintenance, and tight deadline evaluated together."""
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=600,
        requiredDeliveryDate=date(2026, 11, 2),  # 3 days deadline
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    categories = {i.category for i in resp.issues}
    assert "MATERIAL_SHORTAGE" in categories
    assert "MACHINE_CONSTRAINT" in categories
    assert "SCHEDULE_CONFLICT" in categories
    assert len(resp.alternativeScenarios) >= 3


# ------------------------------------------------------------------------------
# Test 13: Tenant data isolation
# ------------------------------------------------------------------------------
def test_tenant_isolation(agent: FeasibilityAgent):
    """Test 13: Empty or invalid tenantId is rejected with ValueError."""
    with pytest.raises(ValueError):
        agent.evaluate_order(
            FeasibilityEvaluationRequest(
                tenantId="",  # Empty tenantId
                orderId="ORD-001",
            )
        )


# ------------------------------------------------------------------------------
# Test 14: Invalid order ID
# ------------------------------------------------------------------------------
def test_invalid_order_id(agent: FeasibilityAgent):
    """Test 14: Non-existent order without simulation params raises OrderNotFoundError."""
    with pytest.raises(OrderNotFoundError):
        agent.evaluate_order(
            FeasibilityEvaluationRequest(
                tenantId="tenant_default",
                orderId="NON_EXISTENT_ORDER_99999",
            )
        )


# ------------------------------------------------------------------------------
# Test 15: Insufficient information to calculate earliest delivery date
# ------------------------------------------------------------------------------
def test_insufficient_information_null_earliest_date(agent: FeasibilityAgent, monkeypatch):
    """Test 15: Earliest date returns None when information is insufficient to calculate schedule."""
    monkeypatch.setattr(agent.repository, "get_product_bom", lambda p: [])

    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.assessmentStatus == "NEEDS_INFORMATION"
    assert resp.earliestFeasibleDeliveryDate is None
    assert "missing" in resp.summary.lower()
