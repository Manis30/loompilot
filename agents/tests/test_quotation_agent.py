import pytest
from datetime import date
from unittest.mock import MagicMock, patch

from app.data.data_repository import DataRepository, get_data_repository
from app.agents.quotation.agent import QuotationAgent
from app.agents.quotation.validator import QuotationValidationError, TenantAccessError
from app.agents.quotation.pricing_service import PricingService
from app.agents.quotation.tax_service import TaxService
from app.agents.quotation.quotation_repository import (
    QuotationRepository,
    QuotationNotFoundError,
    QuotationStateTransitionError,
)
from app.schemas.quotation_schema import (
    CostComponentStatus,
    OverheadAllocationMethod,
    OverheadConfigRequest,
    PricingMethod,
    QuotationApprovalRequest,
    QuotationDetail,
    QuotationGenerationRequest,
    QuotationRejectionRequest,
    QuotationStatus,
)


@pytest.fixture(scope="module")
def repo() -> DataRepository:
    """Initialized DataRepository fixture."""
    r = get_data_repository()
    r._ensure_loaded()
    return r


@pytest.fixture
def agent(repo: DataRepository) -> QuotationAgent:
    """QuotationAgent fixture with clean in-memory quotation repo."""
    clean_q_repo = QuotationRepository(data_repository=repo)
    return QuotationAgent(repository=repo, quotation_repository=clean_q_repo)


# ==============================================================================
# Test Case 1: Complete quotation (All required data exists)
# ==============================================================================
def test_complete_quotation(agent: QuotationAgent):
    """
    Test Case 1: All required data exists.
    Expected:
      - All costing components calculated (status = COMPLETE).
      - Total production cost calculated.
      - Selling price calculated using configured margin method.
      - Applicable taxes calculated.
      - Quotation marked READY_FOR_APPROVAL.
    """
    req = QuotationGenerationRequest(
        tenantId="tenant_default",
        clientId="CLIENT-001",
        productName="Cotton T-Shirt",
        quantity=500,
        pricingMethod=PricingMethod.MARKUP,
        marginPercentage=25.0,
        taxRatePercentage=5.0,
    )
    res = agent.generate_quotation(req)

    assert res.success is True
    q = res.quotation
    assert q.status == QuotationStatus.READY_FOR_APPROVAL
    assert q.costBreakdown.materials.status == CostComponentStatus.COMPLETE
    assert q.costBreakdown.labour.status == CostComponentStatus.COMPLETE
    assert q.costBreakdown.machine.status == CostComponentStatus.COMPLETE
    assert q.costBreakdown.overhead.status == CostComponentStatus.COMPLETE

    fin = q.financialSummary
    assert fin.totalMaterialCost is not None and fin.totalMaterialCost > 0
    assert fin.totalLabourCost is not None and fin.totalLabourCost > 0
    assert fin.totalMachineCost is not None and fin.totalMachineCost > 0
    assert fin.totalOverheadCost is not None and fin.totalOverheadCost > 0
    assert fin.totalProductionCost is not None and fin.totalProductionCost > 0
    assert fin.productionCostPerUnit is not None and fin.productionCostPerUnit > 0
    assert fin.sellingPriceBeforeTax is not None and fin.sellingPriceBeforeTax > fin.totalProductionCost
    assert fin.totalTax is not None and fin.totalTax > 0
    assert fin.finalQuotationAmount is not None and fin.finalQuotationAmount > fin.sellingPriceBeforeTax
    assert len(fin.taxBreakdown) == 2  # CGST & SGST


# ==============================================================================
# Test Case 2: Missing BOM
# ==============================================================================
def test_missing_bom(agent: QuotationAgent):
    """
    Test Case 2: Product has no BOM recipe in catalog.
    Expected:
      - Quotation is not presented as complete.
      - Missing BOM information is reported.
      - No fabricated material cost.
    """
    # Mock repository to return empty BOM for product 1
    with patch.object(agent.repository, "get_product_bom", return_value=[]):
        req = QuotationGenerationRequest(
            tenantId="tenant_default",
            clientId=1,
            productId=1,
            quantity=500,
        )
        res = agent.generate_quotation(req)
        q = res.quotation

        assert q.status == QuotationStatus.PENDING_INFORMATION
        assert q.costBreakdown.materials.status == CostComponentStatus.UNAVAILABLE
        assert q.costBreakdown.materials.totalCost is None
        assert q.financialSummary.totalProductionCost is None
        assert q.financialSummary.sellingPriceBeforeTax is None
        assert any("BOM" in info for info in q.missingInformation)


# ==============================================================================
# Test Case 3: Missing material price
# ==============================================================================
def test_missing_material_price(agent: QuotationAgent):
    """
    Test Case 3: Market Price Agent raises error / price missing for a material.
    Expected:
      - Material costing marked incomplete.
      - Missing price identified.
      - No arbitrary fallback price.
    """
    with patch("app.agents.market_price.agent.get_market_price_agent") as mock_mp:
        mock_agent_instance = MagicMock()
        # Simulate price unavailable exception
        mock_agent_instance.analyze_single_material.side_effect = ValueError("Material spot price unquoted")
        mock_mp.return_value = mock_agent_instance

        req = QuotationGenerationRequest(
            tenantId="tenant_default",
            clientId="Apex Apparel",
            productName="Cotton T-Shirt",
            quantity=500,
        )
        res = agent.generate_quotation(req)
        q = res.quotation

        assert q.status == QuotationStatus.PENDING_INFORMATION
        assert q.costBreakdown.materials.status == CostComponentStatus.INCOMPLETE
        assert q.costBreakdown.materials.totalCost is None
        assert len(q.costBreakdown.materials.missingMaterials) > 0
        assert q.financialSummary.totalProductionCost is None
        assert any("Raw material price" in info for info in q.missingInformation)


# ==============================================================================
# Test Case 4: Missing labour rate
# ==============================================================================
def test_missing_labour_rate(agent: QuotationAgent):
    """
    Test Case 4: Missing labour rate for a manufacturing stage.
    Expected:
      - Labour costing marked incomplete.
      - Missing rate identified.
    """
    req = QuotationGenerationRequest(
        tenantId="tenant_default",
        clientId=1,
        productId=1,
        quantity=500,
        # Only configure Cutting, leaving Stitching, Finishing, Packing missing
        labourRates={"Cutting": 120.0},
    )
    res = agent.generate_quotation(req)
    q = res.quotation

    assert q.status == QuotationStatus.PENDING_INFORMATION
    assert q.costBreakdown.labour.status == CostComponentStatus.INCOMPLETE
    assert q.costBreakdown.labour.totalCost is None
    assert "Stitching" in q.costBreakdown.labour.missingOperations
    assert any("Labour rate for stage" in info for info in q.missingInformation)


# ==============================================================================
# Test Case 5: Missing machine operating rate
# ==============================================================================
def test_missing_machine_operating_rate(agent: QuotationAgent):
    """
    Test Case 5: Missing machine operating rate for a stage.
    Expected:
      - Machine costing marked incomplete.
      - Missing rate identified.
    """
    req = QuotationGenerationRequest(
        tenantId="tenant_default",
        clientId=1,
        productId=1,
        quantity=500,
        # Only configure Cutting machine rate, leaving others missing
        machineRates={"Cutting": 85.0},
    )
    res = agent.generate_quotation(req)
    q = res.quotation

    assert q.status == QuotationStatus.PENDING_INFORMATION
    assert q.costBreakdown.machine.status == CostComponentStatus.INCOMPLETE
    assert q.costBreakdown.machine.totalCost is None
    assert "Stitching" in q.costBreakdown.machine.missingMachines
    assert any("Machine operating rate" in info for info in q.missingInformation)


# ==============================================================================
# Test Case 6: Missing overhead configuration
# ==============================================================================
def test_missing_overhead_configuration(agent: QuotationAgent):
    """
    Test Case 6: When direct cost is missing, percentage overhead cannot be computed.
    Expected:
      - Overhead costing marked unavailable or incomplete.
      - No arbitrary overhead percentage.
    """
    # Direct material cost is missing, so percentage overhead must become INCOMPLETE
    with patch.object(agent.bom_service, "calculate_material_costs") as mock_mat:
        from app.schemas.quotation_schema import MaterialsCostBreakdown
        mock_mat.return_value = MaterialsCostBreakdown(
            status=CostComponentStatus.INCOMPLETE,
            items=[],
            totalCost=None,
        )
        req = QuotationGenerationRequest(
            tenantId="tenant_default",
            clientId=1,
            productId=1,
            quantity=500,
        )
        res = agent.generate_quotation(req)
        q = res.quotation

        assert q.costBreakdown.overhead.status == CostComponentStatus.INCOMPLETE
        assert q.costBreakdown.overhead.totalCost is None


# ==============================================================================
# Test Case 7: Invalid quantity
# ==============================================================================
def test_invalid_quantity():
    """
    Test Case 7: Order quantity must be > 0.
    Expected:
      - Validation error.
      - No quotation generated.
    """
    with pytest.raises(ValueError):
        QuotationGenerationRequest(
            tenantId="tenant_default",
            clientId=1,
            productId=1,
            quantity=0,
        )

    with pytest.raises(ValueError):
        QuotationGenerationRequest(
            tenantId="tenant_default",
            clientId=1,
            productId=1,
            quantity=-100,
        )


# ==============================================================================
# Test Case 8: Different pricing methods (MARKUP vs GROSS_MARGIN)
# ==============================================================================
def test_pricing_methods_markup_vs_gross_margin():
    """
    Test Case 8: Test markup and gross margin calculations separately.
    Expected:
      - Both use correct distinct formulas.
      - No confusion between markup and gross margin.
    """
    cost = 100000.0
    margin_pct = 25.0
    qty = 500

    # 1. MARKUP: Selling Price = Cost * (1 + 25/100) = 100,000 * 1.25 = 125,000.0
    sp_markup, sp_unit_markup, m_amt_markup = PricingService.calculate_selling_price(
        total_production_cost=cost,
        pricing_method=PricingMethod.MARKUP,
        margin_percentage=margin_pct,
        order_quantity=qty,
    )
    assert sp_markup == 125000.0
    assert sp_unit_markup == 250.0
    assert m_amt_markup == 25000.0

    # 2. GROSS MARGIN: Selling Price = Cost / (1 - 25/100) = 100,000 / 0.75 = 133,333.33
    sp_margin, sp_unit_margin, m_amt_margin = PricingService.calculate_selling_price(
        total_production_cost=cost,
        pricing_method=PricingMethod.GROSS_MARGIN,
        margin_percentage=margin_pct,
        order_quantity=qty,
    )
    assert sp_margin == 133333.33
    assert sp_unit_margin == 266.67
    assert m_amt_margin == 33333.33

    # Assert they are definitely not equal
    assert sp_markup != sp_margin
    assert sp_margin > sp_markup


# ==============================================================================
# Test Case 9: Tenant isolation
# ==============================================================================
def test_tenant_isolation(agent: QuotationAgent):
    """
    Test Case 9: A tenant cannot access another tenant's quotation information.
    Expected:
      - PermissionError / TenantAccessError raised on cross-tenant access.
    """
    # 1. Blocked / unauthorized tenant on generate
    with pytest.raises(TenantAccessError):
        agent.validator.validate_request(
            QuotationGenerationRequest(
                tenantId="unauthorized_tenant",
                clientId=1,
                productId=1,
                quantity=100,
            )
        )

    # 2. Generate quotation for tenant_A
    req_a = QuotationGenerationRequest(
        tenantId="tenant_A",
        clientId=1,
        productId=1,
        quantity=500,
    )
    res_a = agent.generate_quotation(req_a)
    q_id = res_a.quotation.quotationId

    # Tenant A can read it
    q_read = agent.get_quotation(q_id, tenant_id="tenant_A")
    assert q_read.quotationId == q_id

    # Tenant B is blocked from reading it
    with pytest.raises(PermissionError):
        agent.get_quotation(q_id, tenant_id="tenant_B")


# ==============================================================================
# Test Case 10: Market Price Agent unavailable
# ==============================================================================
def test_market_price_agent_unavailable(agent: QuotationAgent):
    """
    Test Case 10: When Market Price Agent service fails.
    Expected:
      - Appropriate integration error handled gracefully.
      - No fabricated material prices.
      - Quotation status reflects incomplete costing.
    """
    with patch("app.agents.market_price.agent.get_market_price_agent", side_effect=RuntimeError("Connection refused")):
        req = QuotationGenerationRequest(
            tenantId="tenant_default",
            clientId=1,
            productId=1,
            quantity=500,
        )
        res = agent.generate_quotation(req)
        q = res.quotation

        assert q.status == QuotationStatus.PENDING_INFORMATION
        assert q.costBreakdown.materials.status == CostComponentStatus.INCOMPLETE
        assert q.costBreakdown.materials.totalCost is None
        assert q.financialSummary.finalQuotationAmount is None


# ==============================================================================
# Test Case 11: Approval workflow
# ==============================================================================
def test_approval_workflow(agent: QuotationAgent):
    """
    Test Case 11: Agent cannot automatically approve its own quotation.
    Only an authorized user can approve or reject.
    """
    req = QuotationGenerationRequest(
        tenantId="tenant_default",
        clientId=1,
        productName="Cotton T-Shirt",
        quantity=500,
    )
    res = agent.generate_quotation(req)
    q = res.quotation
    q_id = q.quotationId

    # 1. Agent generated status is READY_FOR_APPROVAL, never APPROVED automatically
    assert q.status == QuotationStatus.READY_FOR_APPROVAL

    # 2. Cannot approve if status is PENDING_INFORMATION
    q_pending = QuotationDetail(**q.model_dump())
    q_pending.status = QuotationStatus.PENDING_INFORMATION
    q_pending.quotationId = "QT-PENDING"
    q_pending.quotationNumber = "LP-QT-2026-PENDING"
    agent.quotation_repo.save(q_pending)

    with pytest.raises(QuotationStateTransitionError):
        agent.approve_quotation("QT-PENDING", authorized_by="AdminUser")

    # 3. Authorized manager approves the ready quotation
    approved_q = agent.approve_quotation(
        q_id,
        authorized_by="SalesDirector_Ramesh",
        approval_notes="Approved special client discount terms.",
    )
    assert approved_q.status == QuotationStatus.APPROVED
    assert len(approved_q.approvalHistory) == 1
    assert approved_q.approvalHistory[0]["actor"] == "SalesDirector_Ramesh"

    # 4. Cannot re-approve an already finalized quotation
    with pytest.raises(QuotationStateTransitionError):
        agent.approve_quotation(q_id, authorized_by="AnotherUser")


# ==============================================================================
# Test Case 12: Currency and rounding precision
# ==============================================================================
def test_currency_and_rounding(agent: QuotationAgent):
    """
    Test Case 12: Currency consistency and decimal precision.
    Expected:
      - Currency is consistently 'INR'.
      - All totals are strictly rounded to 2 decimal places.
      - Selling price and tax calculations are decimal-safe.
    """
    req = QuotationGenerationRequest(
        tenantId="tenant_default",
        clientId=1,
        productName="Cotton T-Shirt",
        quantity=333,  # Odd quantity to test rounding precision
        pricingMethod=PricingMethod.MARKUP,
        marginPercentage=27.5,
        taxRatePercentage=5.0,
    )
    res = agent.generate_quotation(req)
    fin = res.quotation.financialSummary

    assert fin.currency == "INR"
    assert fin.totalProductionCost == round(fin.totalProductionCost, 2)
    assert fin.sellingPriceBeforeTax == round(fin.sellingPriceBeforeTax, 2)
    assert fin.totalTax == round(fin.totalTax, 2)
    assert fin.finalQuotationAmount == round(fin.finalQuotationAmount, 2)
    assert fin.finalQuotationAmount == round(fin.sellingPriceBeforeTax + fin.totalTax, 2)
