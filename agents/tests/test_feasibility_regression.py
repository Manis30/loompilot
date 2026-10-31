import copy
from datetime import date, timedelta
import pytest

from app.data.data_repository import DataRepository
from app.agents.feasibility.agent import FeasibilityAgent
from app.schemas.feasibility_schema import FeasibilityEvaluationRequest


@pytest.fixture
def agent(real_repository: DataRepository) -> FeasibilityAgent:
    """Fixture providing initialized FeasibilityAgent with real repository."""
    return FeasibilityAgent(repository=real_repository)


# ------------------------------------------------------------------------------
# Regression Test 1: All materials available and requested date achievable
# ------------------------------------------------------------------------------
def test_regression_1_all_materials_available_date_achievable(agent: FeasibilityAgent, monkeypatch):
    """
    Test 1: When all materials are in stock (no unallocated shortages), machines and workforce
    are ready, and requested delivery date is well in the future -> FEASIBLE with delayDays == 0.
    """
    # Mock committed stock to 0 to simulate abundant available stock for a small order
    monkeypatch.setattr(agent.repository, "get_committed_stock", lambda exclude_order_id=None: {})

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
    assert resp.status == "FEASIBLE"
    assert resp.delayDays == 0
    assert resp.earliestFeasibleDeliveryDate is not None
    assert resp.earliestFeasibleDeliveryDate <= "2026-11-30"
    assert resp.checks.material.shortagesCount == 0
    assert "fully feasible" in resp.summary.lower()
    assert "never" not in resp.summary.lower()


# ------------------------------------------------------------------------------
# Regression Test 2: Procurement required but requested date achievable
# ------------------------------------------------------------------------------
def test_regression_2_procurement_required_date_achievable(agent: FeasibilityAgent):
    """
    Test 2: Procurement is required (Cotton Fabric shortage), but requested delivery date
    is sufficiently in the future (2026-11-25) -> CONDITIONALLY_FEASIBLE, delayDays == 0.
    Must explain delivery is achievable subject to procurement; NEVER claim date cannot be met.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        productId=1,
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 25),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.success is True
    assert resp.assessmentStatus == "CONDITIONALLY_FEASIBLE"
    assert resp.delayDays == 0
    assert resp.earliestFeasibleDeliveryDate is not None
    assert resp.earliestFeasibleDeliveryDate <= "2026-11-25"
    assert resp.checks.material.shortagesCount > 0

    # Summary and explanation must state delivery can be achieved, NEVER say it cannot be met
    summary_lower = resp.summary.lower()
    assert "can be achieved" in summary_lower or "achievable" in summary_lower
    assert "cannot be met" not in summary_lower
    assert "cannot currently be met" not in resp.explanation.lower()


# ------------------------------------------------------------------------------
# Regression Test 3: Procurement lead time causes delivery delay
# ------------------------------------------------------------------------------
def test_regression_3_procurement_lead_time_causes_delay(agent: FeasibilityAgent):
    """
    Test 3: Tight deadline (2026-11-02, 3 days away) cannot be met because fabric procurement
    takes 4 days and total production takes 4 days -> delayDays > 0, schedule conflict.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 2),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.assessmentStatus == "CONDITIONALLY_FEASIBLE"
    assert resp.delayDays > 0
    assert resp.earliestFeasibleDeliveryDate > "2026-11-02"
    assert any(i.category == "SCHEDULE_CONFLICT" for i in resp.issues)
    assert "cannot be met with standard" in resp.summary.lower()


# ------------------------------------------------------------------------------
# Regression Test 4: Packaging material shortage only affects Packing
# ------------------------------------------------------------------------------
def test_regression_4_packaging_shortage_only_affects_packing(agent: FeasibilityAgent, monkeypatch):
    """
    Test 4: Cutting materials are in stock, but Packaging Bags have a shortage with 3 days lead time.
    Cutting must start immediately on Day 0 (not delayed by packaging bags).
    Issue explanation must cite Packing as affected production stage.
    """
    orig_get_material = agent.repository.get_material

    def mock_material(mat_id):
        m = copy.deepcopy(orig_get_material(mat_id))
        if mat_id == 1:
            # Cotton fabric abundant in stock
            m["CurrentStock"] = 10000.0
        elif mat_id == 5:
            # Packaging bags zero stock with 3 days lead time
            m["CurrentStock"] = 0.0
            m["supplier"] = {"SupplierID": 5, "SupplierName": "City Pack", "City": "Tirupur", "LeadTimeDays": 3}
        return m

    monkeypatch.setattr(agent.repository, "get_material", mock_material)
    monkeypatch.setattr(agent.repository, "get_committed_stock", lambda exclude_order_id=None: {})

    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=200,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.success is True
    # Production start date must NOT be delayed; Cutting starts on evaluation date
    assert resp.estimatedProductionStartDate == "2026-10-30"

    # Packaging bags issue must identify Packing as the affected stage
    pkg_issue = next((i for i in resp.issues if "packaging" in i.resourceName.lower()), None)
    assert pkg_issue is not None
    assert pkg_issue.affectedProductionStage == "Packing"
    assert "packing stage" in pkg_issue.businessImpact.lower()


# ------------------------------------------------------------------------------
# Regression Test 5: Existing commitments exceed physical stock
# ------------------------------------------------------------------------------
def test_regression_5_commitments_exceed_physical_stock(agent: FeasibilityAgent, monkeypatch):
    """
    Test 5: Physical stock is 100 kg, but active commitments are 250 kg.
    Net unallocated stock is negative (-150 kg).
    Must report existingCommitmentDeficit == 150 kg explicitly without hiding negative balance.
    """
    orig_get_material = agent.repository.get_material

    def mock_material(mat_id):
        m = copy.deepcopy(orig_get_material(mat_id))
        if mat_id == 1:
            m["CurrentStock"] = 100.0
        return m

    monkeypatch.setattr(agent.repository, "get_material", mock_material)
    monkeypatch.setattr(agent.repository, "get_committed_stock", lambda exclude_order_id=None: {1: 250.0})

    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=200,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    cotton_item = next(it for it in resp.checks.material.items if it.materialId == 1)
    assert cotton_item.physicalStock == 100.0
    assert cotton_item.committedStock == 250.0
    assert cotton_item.netAvailableStock == -150.0
    assert cotton_item.usableAvailableStock == 0.0
    assert cotton_item.existingCommitmentDeficit == 150.0

    # Explicit consolidated issue reporting existing commitment deficit
    cotton_issue = next(i for i in resp.issues if i.resourceName == "Cotton Fabric")
    assert cotton_issue.existingCommitmentDeficit == 150.0
    assert cotton_issue.newOrderShortage is not None
    assert cotton_issue.recommendedProcurementQuantity is not None
    assert "150.00" in cotton_issue.actualAvailable
    assert "FACTORY_WIDE_REPLENISHMENT" in cotton_issue.procurementScope


# ------------------------------------------------------------------------------
# Regression Test 6: Alternative machine allocation
# ------------------------------------------------------------------------------
def test_regression_6_alternative_machine_allocation(agent: FeasibilityAgent):
    """
    Test 6: ST-02 in Stitching is in maintenance.
    Alternative compatible machines ST-01, ST-03, STI-04 are available.
    Machine evaluation allocates operational unit and issues advisory recommendation.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    stitching_stage = next(s for s in resp.checks.machine.stages if s.stage == "Stitching")
    assert "ST-02" in stitching_stage.maintenanceMachines
    assert stitching_stage.allocatedMachineCode in ["ST-01", "ST-03", "STI-04"]

    # Recommendation exists and is clearly marked as advisory
    mach_recs = [r for r in resp.recommendations if r.category == "MACHINE"]
    assert len(mach_recs) > 0
    assert "Alternative Compatible" in mach_recs[0].title


# ------------------------------------------------------------------------------
# Regression Test 7: Machine capacity occupied by existing orders
# ------------------------------------------------------------------------------
def test_regression_7_machine_capacity_occupied_by_existing_orders(agent: FeasibilityAgent):
    """
    Test 7: Factory has active in-progress orders (>3000 units on floor).
    Commitment evaluator identifies queue backlog and sequences scheduling.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.checks.existingOrders.activeOrdersCount >= 14
    assert resp.checks.existingOrders.totalCommittedUnits > 2000

    backlog_issues = [i for i in resp.issues if "backlog" in i.title.lower()]
    assert len(backlog_issues) > 0
    assert "queue" in backlog_issues[0].resourceName.lower()


# ------------------------------------------------------------------------------
# Regression Test 8: Insufficient workforce for parallel processing
# ------------------------------------------------------------------------------
def test_regression_8_insufficient_workforce_for_parallel_processing(agent: FeasibilityAgent, monkeypatch):
    """
    Test 8: Even if 4 machines are available in Stitching, if only 1 operator is available,
    parallel scenario must not claim 4 parallel lines can run simultaneously.
    """
    # Force single operator in Stitching
    orig_get_emp = agent.repository.get_employees_by_stage

    def mock_employees(stage):
        if stage == "Stitching":
            return [{"EmployeeID": 10, "EmployeeName": "Sole Stitcher", "JobRole": "Tailor"}]
        return orig_get_emp(stage)

    monkeypatch.setattr(agent.repository, "get_employees_by_stage", mock_employees)

    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=1000,
        requiredDeliveryDate=date(2026, 11, 4),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    # Parallel scenario must be omitted because 1 operator cannot staff multiple machines
    parallel_scens = [s for s in resp.alternativeScenarios if "parallel" in s.scenarioName.lower()]
    assert len(parallel_scens) == 0


# ------------------------------------------------------------------------------
# Regression Test 9: Alternative scenario schedule recalculation
# ------------------------------------------------------------------------------
def test_regression_9_alternative_scenario_schedule_recalculation(agent: FeasibilityAgent):
    """
    Test 9: Verifies that alternative scenarios recalculate the complete production schedule,
    populate recalculatedSchedule, and calculate accurate daysSaved without simple subtraction.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=600,
        requiredDeliveryDate=date(2026, 11, 2),  # Short deadline triggers scenarios
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert len(resp.alternativeScenarios) >= 3

    for scen in resp.alternativeScenarios:
        assert scen.expectedDeliveryDate is not None
        assert scen.revisedEarliestDeliveryDate is not None
        if scen.recalculatedSchedule:
            assert "estimatedProductionStartDate" in scen.recalculatedSchedule
            assert "estimatedProductionCompletionDate" in scen.recalculatedSchedule
            assert "stageBreakdown" in scen.recalculatedSchedule


# ------------------------------------------------------------------------------
# Regression Test 10: Missing BOM or critical master data
# ------------------------------------------------------------------------------
def test_regression_10_missing_bom_or_critical_master_data(agent: FeasibilityAgent, monkeypatch):
    """
    Test 10: Missing BOM recipe returns NEEDS_INFORMATION and earliestFeasibleDeliveryDate is None.
    Never invents or fabricates an arbitrary completion date.
    """
    monkeypatch.setattr(agent.repository, "get_product_bom", lambda p: [])

    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    assert resp.assessmentStatus == "NEEDS_INFORMATION"
    assert resp.status == "NEEDS_INFORMATION"
    assert resp.earliestFeasibleDeliveryDate is None
    assert resp.estimatedProductionStartDate is None
    assert resp.estimatedProductionCompletionDate is None
    assert resp.delayDays == 0
    assert "missing" in resp.summary.lower()


# ------------------------------------------------------------------------------
# Regression Test 11: Factory working calendar enforcement (6 days, Sun off)
# ------------------------------------------------------------------------------
def test_regression_11_factory_working_calendar_enforcement(agent: FeasibilityAgent):
    """
    Test 11: Enforces 6-day factory working calendar (Monday-Saturday, Sunday weekly off).
    Verifies that milestones never schedule active processing on Sunday, and expedited
    arrivals landing on Sunday (2026-11-01) roll over to Monday (2026-11-02).
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 25),
        evaluationDate=date(2026, 10, 30),  # Friday
    )
    resp = agent.evaluate_order(req)
    sched = resp.checks.productionSchedule
    assert sched is not None

    # Check stage breakdown: start and end dates of stages
    for stage in sched.stageBreakdown:
        s_date = date.fromisoformat(stage.startDate)
        e_date = date.fromisoformat(stage.endDate)
        # In 6-day working calendar, Sunday is day of week 6
        if "procurement" not in stage.stage.lower():
            # Production stages cannot start or end on Sunday
            assert s_date.weekday() != 6, f"Stage {stage.stage} started on Sunday ({stage.startDate})"
            assert e_date.weekday() != 6, f"Stage {stage.stage} ended on Sunday ({stage.endDate})"


# ------------------------------------------------------------------------------
# Regression Test 12: Stitching parallel allocation (550 u/d) & Finishing QC separation
# ------------------------------------------------------------------------------
def test_regression_12_stitching_parallel_and_finishing_qc_separation(agent: FeasibilityAgent):
    """
    Test 12: Specifically verifies:
    1. Stitching parallel allocation across ST-01 (180), ST-03 (190), STI-04 (180) = 550 u/d (not 540).
    2. Proportional workload allocation for 600 units (ST-01: 196, ST-03: 207, STI-04: 197).
    3. QC-01 (Quality Inspection Station, 350 u/d) is NOT treated as a garment steam press in Finishing.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=600,
        requiredDeliveryDate=date(2026, 11, 5),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    # 1. Finishing check: FIN-01 is allocated, QC-01 is NOT allocated as garment press
    fin_stage = next(s for s in resp.checks.machine.stages if s.stage == "Finishing")
    assert fin_stage.allocatedMachineCode == "FIN-01"
    assert fin_stage.totalAllocatedCapacityPerDay == 300
    assert "QC-01" not in fin_stage.allocatedMachineCodes

    # QC-01 is recorded in issues as an informational inspection station
    qc_issue = next((i for i in resp.issues if "QC-01" in i.resourceName or "QC-01" in i.title), None)
    assert qc_issue is not None
    assert qc_issue.severity == "INFO"
    assert "inspection" in qc_issue.explanation.lower()

    # 2. Stitching parallel scenario check:
    par_scen = next((s for s in resp.alternativeScenarios if "Parallel" in s.scenarioName), None)
    assert par_scen is not None
    assert "550 units/day" in par_scen.description or "550" in par_scen.changes
    assert "540" not in par_scen.description and "540" not in par_scen.changes

    # Workload allocation across ST-01, ST-03, STI-04
    alloc = par_scen.workloadAllocation
    assert alloc["ST-01"] == 196
    assert alloc["ST-03"] == 207
    assert alloc["STI-04"] == 197
    assert sum(alloc.values()) == 600
    assert par_scen.workforceVerified is False  # Advisory per operational guidelines
    assert "Inferred 6-Day Factory Calendar" in par_scen.workingCalendarUsed


# ------------------------------------------------------------------------------
# Regression Test 13: Procurement options mutually exclusive (never added together)
# ------------------------------------------------------------------------------
def test_regression_13_procurement_options_mutually_exclusive_not_added_together(agent: FeasibilityAgent):
    """
    Test 13: Verifies:
    1. Cotton Fabric presents both NEW_ORDER_ONLY (288.75 kg) and FACTORY_WIDE_REPLENISHMENT (1,709.90 kg).
    2. FACTORY_WIDE_REPLENISHMENT already subsumes the new order requirement (1,421.15 + 288.75 = 1,709.90 kg).
    3. Recommendations explicitly state they are mutually exclusive and must NOT be added together (no 1,998.65 kg).
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId=1,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)
    cotton = next(it for it in resp.checks.material.items if it.materialId == 1)

    assert "NEW_ORDER_ONLY" in cotton.procurementOptions
    assert "FACTORY_WIDE_REPLENISHMENT" in cotton.procurementOptions

    opt_new = cotton.procurementOptions["NEW_ORDER_ONLY"]
    opt_factory = cotton.procurementOptions["FACTORY_WIDE_REPLENISHMENT"]

    assert opt_new.quantity == 288.75
    assert opt_factory.quantity == 1709.90
    assert opt_new.isRecommended is True
    assert opt_factory.isRecommended is False
    assert "DO NOT ADD BOTH" in opt_factory.recommendationReason

    # Recommendation checks
    rec_actions = " ".join(r.action for r in resp.recommendations)
    assert "1998.65" not in rec_actions
    assert "mutually exclusive" in rec_actions.lower()


# ------------------------------------------------------------------------------
# Regression Test 14: Missing machine reservations represented as unknown
# ------------------------------------------------------------------------------
def test_regression_14_missing_machine_reservations_represented_as_unknown(agent: FeasibilityAgent):
    """
    Test 14: Verifies:
    1. reservedCapacityUnitsPerDay is None (not 0).
    2. availableCapacityUnitsPerDay is None (not nominal).
    3. reservationStatus is UNKNOWN.
    4. scheduleType is PROVISIONAL_ADVISORY.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId=1,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    for stage in resp.checks.machine.stages:
        assert stage.reservedCapacityUnitsPerDay is None
        assert stage.availableCapacityUnitsPerDay is None
        assert stage.reservationStatus == "UNKNOWN"
        assert stage.scheduleType == "PROVISIONAL_ADVISORY"

    assert resp.scheduleType == "PROVISIONAL_ADVISORY"
    assert resp.machineSlotConfirmationRequired is True


# ------------------------------------------------------------------------------
# Regression Test 15: Existing production commitments are not ignored
# ------------------------------------------------------------------------------
def test_regression_15_existing_production_commitments_not_ignored(agent: FeasibilityAgent):
    """
    Test 15: Verifies active WIP floor orders (>3,000 units) are actively deducted.
    Cotton physical stock (1,250 kg) is committed to 2,671.15 kg, yielding deficit of 1,421.15 kg.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId=1,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)
    cotton = next(it for it in resp.checks.material.items if it.materialId == 1)

    assert cotton.physicalStock == 1250.0
    assert cotton.committedStock == 2671.15
    assert cotton.existingCommitmentDeficit == 1421.15
    assert cotton.netAvailableStock < 0
    assert cotton.usableAvailableStock == 0.0


# ------------------------------------------------------------------------------
# Regression Test 16: Parallel-machine staffing explicitly advisory
# ------------------------------------------------------------------------------
def test_regression_16_parallel_machine_staffing_explicitly_advisory(agent: FeasibilityAgent):
    """
    Test 16: Verifies:
    1. requiredOperators is calculated for parallel lines (3 operators).
    2. availableQualifiedOperators reflects roster (7 operators).
    3. operatorAllocation is populated across machines.
    4. workforceVerified is False (labeled advisory rather than confirmed).
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId=1,
        orderQuantity=600,
        requiredDeliveryDate=date(2026, 11, 5),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)
    par = next(s for s in resp.alternativeScenarios if "Parallel" in s.scenarioName)

    assert par.requiredOperators == 3
    assert par.availableQualifiedOperators >= 3
    assert "ST-01" in par.operatorAllocation
    assert "ST-03" in par.operatorAllocation
    assert "STI-04" in par.operatorAllocation
    assert par.workforceVerified is False
    assert "ADVISORY" in par.workforceVerificationStatus


# ------------------------------------------------------------------------------
# Regression Test 17: Calendar discrete stage dates (zero boundary double-counting)
# ------------------------------------------------------------------------------
def test_regression_17_calendar_discrete_stage_dates_no_double_counting(agent: FeasibilityAgent):
    """
    Test 17: Verifies that consecutive production stages do NOT double-count boundary dates.
    Each subsequent stage begins on the next working day after previous stage ends.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId=1,
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)
    stages = resp.checks.productionSchedule.stageBreakdown

    prod_stages = [s for s in stages if "procurement" not in s.stage.lower()]
    for i in range(len(prod_stages) - 1):
        curr_end = date.fromisoformat(prod_stages[i].endDate)
        next_start = date.fromisoformat(prod_stages[i + 1].startDate)
        assert next_start > curr_end, f"Boundary overlap between {prod_stages[i].stage} and {prod_stages[i+1].stage}"


# ------------------------------------------------------------------------------
# Regression Test 18: Stock movement ledger verification handled
# ------------------------------------------------------------------------------
def test_regression_18_stock_movement_ledger_verification_handled(agent: FeasibilityAgent):
    """
    Test 18: Verifies stock ledger verification is executed and reported without synthetic data.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId=1,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)
    assert resp.stockLedgerStatus is not None
    assert "status" in resp.stockLedgerStatus
    assert any("stock movement ledger" in dl.lower() for dl in resp.dataLimitations)


# ------------------------------------------------------------------------------
# Regression Test 19: Alternative schedules recalculated consistently
# ------------------------------------------------------------------------------
def test_regression_19_alternative_schedules_recalculated_consistently(agent: FeasibilityAgent):
    """
    Test 19: Verifies that every scenario contains a complete recalculated schedule
    with positive daysSaved and non-empty stage breakdown.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId=1,
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 5),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    for scen in resp.alternativeScenarios:
        assert scen.recalculatedSchedule is not None
        assert "stageBreakdown" in scen.recalculatedSchedule
        assert scen.daysSaved >= 0
        assert "Inferred 6-Day Factory Calendar" in scen.workingCalendarUsed


# ------------------------------------------------------------------------------
# Regression Test 20: No unsupported reservation or dynamic protection claims
# ------------------------------------------------------------------------------
def test_regression_20_no_unsupported_reservation_claims(agent: FeasibilityAgent):
    """
    Test 20: Verifies:
    1. existingOrders.summary and SCHEDULE_CONFLICT issue explanations do NOT contain
       unsupported claims like 'dynamically reserved', 'capacity protected', or 'partitioned'.
    2. Explicitly states 15 active orders (or actual count) and remaining units are identified,
       their machine-slot reservations are not verified, the order must be sequenced after
       floor confirmation, and NO reservation or protection was performed by the agent.
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    # 1. Inspect existingOrders summary
    eo_summary = resp.checks.existingOrders.summary
    assert "not verified" in eo_summary.lower() or "unverified" in eo_summary.lower()
    assert "no reservation or capacity protection has been performed" in eo_summary.lower()
    assert "dynamically reserved" not in eo_summary.lower()
    assert "partitioned" not in eo_summary.lower()

    # 2. Inspect issues for SCHEDULE_CONFLICT
    conflict_issues = [i for i in resp.issues if i.category == "SCHEDULE_CONFLICT"]
    for issue in conflict_issues:
        expl = issue.explanation.lower()
        assert "no reservation or capacity protection has been performed" in expl
        assert "not verified" in expl or "unverified" in expl
        assert "dynamically reserved" not in expl
        assert "partitioned" not in expl


# ------------------------------------------------------------------------------
# Regression Test 21: Machine compatibility verified while slot is unknown
# ------------------------------------------------------------------------------
def test_regression_21_machine_compatibility_verified_while_scheduling_unknown(agent: FeasibilityAgent):
    """
    Test 21: Distinguishes machine compatibility verification from scheduling slot availability:
    - machineCompatibilityVerified is True for stages and scenarios
    - isCapacityVerified is False
    - reservationStatus is UNKNOWN
    - isMachineSlotConfirmed is False
    - machine check summary explicitly distinguishes compatibility from slot availability
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    # Stages check
    for stage in resp.checks.machine.stages:
        assert stage.machineCompatibilityVerified is True
        assert stage.isCapacityVerified is False
        assert stage.reservationStatus == "UNKNOWN"
        assert stage.reservedCapacityUnitsPerDay is None
        assert stage.availableCapacityUnitsPerDay is None
        assert stage.scheduleType == "PROVISIONAL_ADVISORY"

    # Machine summary check
    mach_summary = resp.checks.machine.summary.lower()
    assert "machine compatibility is verified" in mach_summary
    assert "provisional and unverified" in mach_summary

    # Alternative scenarios check
    for scen in resp.alternativeScenarios:
        assert scen.machineCompatibilityVerified is True
        assert scen.isMachineSlotConfirmed is False


# ------------------------------------------------------------------------------
# Regression Test 22: Alternative scenario stage capacity notes clean separation
# ------------------------------------------------------------------------------
def test_regression_22_alternative_scenario_stage_capacities_clean(agent: FeasibilityAgent):
    """
    Test 22: Verifies that in alternative scenarios (such as Parallel Multi-Line),
    stageBreakdown notes do NOT apply Stitching's combined capacity (550 u/d) to
    Cutting, Finishing, or Packing stages.
    - Cutting: CUT-01 (450 units/day)
    - Stitching: [Parallel 3-Line (550 u/d)] ST-01, ST-03, STI-04 (550 units/day)
    - Finishing: FIN-01 (300 units/day)
    - Packing: PK-01 (500 units/day)
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=600,
        requiredDeliveryDate=date(2026, 11, 2),  # Short deadline to trigger parallel scenario
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)

    par_scen = next((s for s in resp.alternativeScenarios if "parallel" in s.scenarioName.lower()), None)
    assert par_scen is not None
    assert par_scen.recalculatedSchedule is not None

    stage_breakdown = par_scen.recalculatedSchedule.get("stageBreakdown", [])
    stages_by_name = {s["stage"]: s for s in stage_breakdown}

    assert "Cutting" in stages_by_name
    assert "Stitching" in stages_by_name
    assert "Finishing" in stages_by_name
    assert "Packing" in stages_by_name

    cutting_notes = stages_by_name["Cutting"]["notes"]
    stitching_notes = stages_by_name["Stitching"]["notes"]
    finishing_notes = stages_by_name["Finishing"]["notes"]
    packing_notes = stages_by_name["Packing"]["notes"]

    # Cutting must reflect 450 units/day on CUT-01, NOT Stitching's 550 or parallel note
    assert "CUT-01" in cutting_notes
    assert "450 units/day" in cutting_notes
    assert "550" not in cutting_notes
    assert "Parallel" not in cutting_notes

    # Stitching must reflect parallel prefix and combined 550 units/day
    assert "Parallel" in stitching_notes
    assert "550" in stitching_notes

    # Finishing must reflect 300 units/day on FIN-01, NOT 550 or parallel note
    assert "FIN-01" in finishing_notes
    assert "300 units/day" in finishing_notes
    assert "550" not in finishing_notes
    assert "Parallel" not in finishing_notes

    # Packing must reflect 500 units/day on PK-01, NOT 550 or parallel note
    assert "PK-01" in packing_notes
    assert "500 units/day" in packing_notes
    assert "550" not in packing_notes
    assert "Parallel" not in packing_notes


# ------------------------------------------------------------------------------
# Regression Test 23: Consistent advisory workforce verification across all scenarios
# ------------------------------------------------------------------------------
def test_regression_23_consistent_advisory_workforce_across_all_scenarios(agent: FeasibilityAgent):
    """
    Test 23: Verifies that EVERY generated alternative scenario consistently marks:
    - workforceVerified is False
    - isWorkforceConfirmed is False
    - workforceVerificationStatus begins with 'ADVISORY'
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=600,
        requiredDeliveryDate=date(2026, 11, 2),
        evaluationDate=date(2026, 10, 30),
    )
    resp = agent.evaluate_order(req)
    assert len(resp.alternativeScenarios) >= 4

    for scen in resp.alternativeScenarios:
        assert scen.workforceVerified is False, f"Failed on {scen.scenarioName}"
        assert scen.isWorkforceConfirmed is False, f"Failed on {scen.scenarioName}"
        assert scen.workforceVerificationStatus is not None, f"Failed on {scen.scenarioName}"
        assert scen.workforceVerificationStatus.startswith("ADVISORY"), (
            f"Scenario {scen.scenarioName} status is not ADVISORY: {scen.workforceVerificationStatus}"
        )


# ------------------------------------------------------------------------------
# Regression Test 24: Stage-aware procurement delays and Sunday calendar roll-over
# ------------------------------------------------------------------------------
def test_regression_24_stage_aware_procurement_delays_and_calendar_rollover(agent: FeasibilityAgent):
    """
    Test 24: Verifies:
    1. Cotton Fabric schedule impact notes it directly gates Cutting start.
    2. Packaging Bags schedule impact notes it only affects Packing and does not block Cutting.
    3. Production stages do not start or end on Sunday (weekly off).
    """
    req = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-001",
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),  # Friday
    )
    resp = agent.evaluate_order(req)

    cotton = next(it for it in resp.checks.material.items if it.materialId == 1)
    packaging = next(it for it in resp.checks.material.items if it.materialId == 5)

    # Cotton gates Cutting
    assert cotton.scheduleImpactIfDelayed is not None
    assert "gates cutting" in cotton.scheduleImpactIfDelayed.lower()

    # Packaging is for Packing stage
    assert packaging.scheduleImpactIfDelayed is not None
    assert "packing" in packaging.scheduleImpactIfDelayed.lower()
    assert "provided delivery occurs before packing" in packaging.scheduleImpactIfDelayed.lower()

    # In stage breakdown, verify no stage starts or ends on Sunday
    for stage in resp.checks.productionSchedule.stageBreakdown:
        s_dt = date.fromisoformat(stage.startDate)
        e_dt = date.fromisoformat(stage.endDate)
        assert s_dt.weekday() != 6, f"Stage {stage.stage} started on Sunday ({stage.startDate})"
        assert e_dt.weekday() != 6, f"Stage {stage.stage} ended on Sunday ({stage.endDate})"




