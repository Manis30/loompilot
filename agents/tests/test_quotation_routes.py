import pytest
from fastapi import HTTPException

from app.api.routes.quotation_routes import (
    generate_quotation,
    list_quotations,
    get_quotation_by_id,
    approve_quotation,
    reject_quotation,
    quotation_health_check,
)
from app.agents.quotation.agent import QuotationAgent
from app.agents.quotation.quotation_repository import QuotationRepository
from app.data.data_repository import DataRepository, get_data_repository
from app.schemas.quotation_schema import (
    PricingMethod,
    QuotationApprovalRequest,
    QuotationGenerationRequest,
    QuotationRejectionRequest,
    QuotationStatus,
)


@pytest.fixture(scope="module")
def real_repo() -> DataRepository:
    r = get_data_repository()
    r._ensure_loaded()
    return r


@pytest.fixture
def clean_agent(real_repo: DataRepository) -> QuotationAgent:
    q_repo = QuotationRepository(data_repository=real_repo)
    return QuotationAgent(repository=real_repo, quotation_repository=q_repo)


def test_quotation_health_endpoint(clean_agent: QuotationAgent, real_repo: DataRepository):
    """Test health check route returns healthy status and metadata."""
    res = quotation_health_check(agent=clean_agent, repository=real_repo)
    assert res["status"] == "healthy"
    assert res["agent"] == "quotation_agent"
    assert res["datasetsLoaded"] is True
    assert res["totalProducts"] >= 7
    assert res["totalMaterials"] == 9
    assert "MARKUP" in res["supportedPricingMethods"]


def test_generate_quotation_route_success(clean_agent: QuotationAgent):
    """Test POST /generate route with valid payload."""
    payload = QuotationGenerationRequest(
        tenantId="tenant_default",
        clientId="Apex Apparel",
        productName="Cotton T-Shirt",
        quantity=500,
        pricingMethod=PricingMethod.MARKUP,
        marginPercentage=20.0,
    )
    res = generate_quotation(payload=payload, agent=clean_agent)
    assert res.success is True
    assert res.quotation.status == QuotationStatus.READY_FOR_APPROVAL
    assert res.quotation.financialSummary.totalProductionCost is not None
    assert res.quotation.client.clientName == "Apex Apparel"


def test_generate_quotation_route_invalid_client(clean_agent: QuotationAgent):
    """Test POST /generate route with non-existent client raises 400."""
    payload = QuotationGenerationRequest(
        tenantId="tenant_default",
        clientId="NonExistentClientXYZ123",
        productName="Cotton T-Shirt",
        quantity=500,
    )
    with pytest.raises(HTTPException) as exc_info:
        generate_quotation(payload=payload, agent=clean_agent)
    assert exc_info.value.status_code == 400


def test_generate_quotation_route_tenant_isolation(clean_agent: QuotationAgent):
    """Test POST /generate route with blocked tenant raises 403."""
    payload = QuotationGenerationRequest(
        tenantId="unauthorized_tenant",
        clientId=1,
        productName="Cotton T-Shirt",
        quantity=500,
    )
    with pytest.raises(HTTPException) as exc_info:
        generate_quotation(payload=payload, agent=clean_agent)
    assert exc_info.value.status_code == 403


def test_list_and_get_quotation_routes(clean_agent: QuotationAgent):
    """Test GET /api/agents/quotation and GET /api/agents/quotation/{id}."""
    # Generate 2 quotations
    p1 = QuotationGenerationRequest(
        tenantId="tenant_A",
        clientId=1,
        productName="Cotton T-Shirt",
        quantity=200,
    )
    p2 = QuotationGenerationRequest(
        tenantId="tenant_B",
        clientId=2,
        productName="Polo Shirt",
        quantity=300,
    )
    res1 = generate_quotation(payload=p1, agent=clean_agent)
    res2 = generate_quotation(payload=p2, agent=clean_agent)

    q1_id = res1.quotation.quotationId

    # List all
    all_q = list_quotations(agent=clean_agent)
    assert all_q.totalCount >= 2

    # Filter by tenant_A
    tenant_a_q = list_quotations(tenantId="tenant_A", agent=clean_agent)
    assert len(tenant_a_q.quotations) == 1
    assert tenant_a_q.quotations[0].quotationId == q1_id

    # Get by ID
    single_q = get_quotation_by_id(quotationId=q1_id, tenantId="tenant_A", agent=clean_agent)
    assert single_q.success is True
    assert single_q.quotation.quotationId == q1_id

    # Forbidden cross-tenant access raises 403
    with pytest.raises(HTTPException) as exc:
        get_quotation_by_id(quotationId=q1_id, tenantId="tenant_B", agent=clean_agent)
    assert exc.value.status_code == 403


def test_approve_and_reject_routes(clean_agent: QuotationAgent):
    """Test POST /approve and POST /reject endpoints."""
    req = QuotationGenerationRequest(
        tenantId="tenant_default",
        clientId=1,
        productName="Cotton T-Shirt",
        quantity=500,
    )
    res = generate_quotation(payload=req, agent=clean_agent)
    q_id = res.quotation.quotationId

    # Approve
    appr_payload = QuotationApprovalRequest(
        authorizedBy="FactoryOwner_Murugan",
        approvalNotes="Terms agreed over client call.",
    )
    approved = approve_quotation(
        quotationId=q_id,
        payload=appr_payload,
        agent=clean_agent,
    )
    assert approved.quotation.status == QuotationStatus.APPROVED

    # Reject on a separate quotation
    res_rej = generate_quotation(payload=req, agent=clean_agent)
    rej_id = res_rej.quotation.quotationId

    rej_payload = QuotationRejectionRequest(
        rejectedBy="CommercialLead_Priya",
        rejectionReason="Client requested discount exceeding threshold.",
    )
    rejected = reject_quotation(
        quotationId=rej_id,
        payload=rej_payload,
        agent=clean_agent,
    )
    assert rejected.quotation.status == QuotationStatus.REJECTED

