from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class NegotiationStatus(str, Enum):
    """Lifecycle statuses for a customer quotation negotiation."""
    INITIAL = "INITIAL"
    IN_PROGRESS = "IN_PROGRESS"
    OFFER_MADE = "OFFER_MADE"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    CUSTOMER_ACCEPTED = "CUSTOMER_ACCEPTED"
    CUSTOMER_DECLINED = "CUSTOMER_DECLINED"
    OFFER_EXPIRED = "OFFER_EXPIRED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"


class CustomerIntent(str, Enum):
    """Categorized intent of a customer chat message."""
    GENERAL_QUERY = "GENERAL_QUERY"
    PRICE_OBJECTION = "PRICE_OBJECTION"
    DISCOUNT_REQUEST = "DISCOUNT_REQUEST"
    COUNTER_OFFER = "COUNTER_OFFER"
    DELIVERY_QUERY = "DELIVERY_QUERY"
    PAYMENT_QUERY = "PAYMENT_QUERY"
    PRODUCT_CHANGE_REQUEST = "PRODUCT_CHANGE_REQUEST"
    COST_INQUIRY = "COST_INQUIRY"
    ACCEPTANCE = "ACCEPTANCE"
    REJECTION = "REJECTION"
    OTHER = "OTHER"


class SenderRole(str, Enum):
    """Identity of the message participant."""
    CUSTOMER = "CUSTOMER"
    AGENT = "AGENT"
    SYSTEM = "SYSTEM"
    HUMAN_APPROVER = "HUMAN_APPROVER"


class OfferStatus(str, Enum):
    """Lifecycle state of an individual commercial offer."""
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    SUPERSEDED = "SUPERSEDED"


class ChatMessage(BaseModel):
    """Persistent chat message in a negotiation conversation."""
    messageId: str
    sender: str
    message: str
    intent: Optional[Union[CustomerIntent, str]] = None
    timestamp: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CustomerProfile(BaseModel):
    """Verified customer profile with historical orders and commercial standing."""
    customerId: int
    customerName: str
    companyName: str
    city: str
    email: str
    customerCategory: str = "Standard B2B Client"
    totalOrdersCount: int = 0
    totalSpendINR: float = 0.0
    paymentTerms: str = "30% Advance, Balance on Delivery"
    maxDiscretionaryDiscountPct: float = 2.0
    previousOrders: List[Dict[str, Any]] = Field(default_factory=list)
    previousQuotations: List[Dict[str, Any]] = Field(default_factory=list)


class ClientAssistantChatRequest(BaseModel):
    """Request payload for customer chat and bargaining."""
    tenantId: str = Field(
        default="tenant_default",
        description="Tenant identifier for multi-tenant isolation.",
        min_length=1,
    )
    customerId: int = Field(
        ...,
        description="Verified customer / client ID.",
    )
    quotationId: str = Field(
        ...,
        description="Quotation identifier (e.g. 'QT-103', 'QT-101', '1', 'QT-2026-001').",
        min_length=1,
    )
    conversationId: Optional[str] = Field(
        default=None,
        description="Persistent conversation session ID. If omitted, a new conversation is initialized.",
    )
    message: str = Field(
        ...,
        min_length=1,
        description="Customer natural language message.",
    )
    additionalContext: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional client metadata or channel parameters.",
    )


class AlternativeRecommendation(BaseModel):
    """Actionable manufacturing or commercial alternative."""
    type: str = Field(
        ...,
        description="Alternative type (e.g. 'VOLUME_TIER', 'ALTERNATIVE_FABRIC', 'SCHEDULE_FLEXIBILITY').",
    )
    title: str
    description: str
    proposedPricePerUnit: Optional[float] = None
    differenceFromCurrentOfferINR: Optional[float] = Field(
        default=None,
        description="Difference between proposed unit price and active offer (positive if higher, negative if lower).",
    )
    differenceFromOriginalQuotationINR: Optional[float] = Field(
        default=None,
        description="Difference between proposed unit price and original quotation.",
    )
    alternativeOrderQuantity: Optional[int] = Field(
        default=None,
        description="Applicable order quantity for this alternative specification.",
    )
    totalOrderAmountINR: Optional[float] = Field(
        default=None,
        description="Total order value under this alternative (Proposed Price × Alternative Quantity).",
    )
    savingsVsCurrentOfferINR: Optional[float] = Field(
        default=None,
        description="Total savings compared to current active offer (if positive). Zero or negative if more expensive.",
    )
    savingsVsOriginalQuotationINR: Optional[float] = Field(
        default=None,
        description="Total savings compared to original quotation amount.",
    )
    savingsPerUnitINR: Optional[float] = Field(
        default=None,
        description="Per-unit savings for backward compatibility.",
    )
    tradeOff: Optional[str] = None
    feasible: bool = True
    feasibilityNotes: Optional[str] = None


class CustomerOfferView(BaseModel):
    """
    Customer-facing view of a commercial offer.
    Excludes internal floor prices, cost breakdowns, and profit margins.
    """
    message: str = Field(
        ...,
        description="Customer-facing professional B2B text message.",
    )
    offerId: Optional[str] = Field(
        default=None,
        description="Unique identifier for the commercial offer.",
    )
    originalPricePerUnit: float = Field(
        ...,
        description="Original quoted unit price in INR.",
    )
    revisedPricePerUnit: float = Field(
        ...,
        description="Current revised/negotiated unit price in INR.",
    )
    orderQuantity: int = Field(
        ...,
        description="Order quantity from the active quotation.",
    )
    originalQuotationTotal: float = Field(
        ...,
        description="Original total order amount (Original Price × Quantity).",
    )
    revisedQuotationTotal: float = Field(
        ...,
        description="Revised total order amount (Revised Price × Quantity).",
    )
    totalSavings: float = Field(
        ...,
        description="Total customer savings (Original Total - Revised Total).",
    )
    discountPercentage: float = Field(
        ...,
        description="Calculated discount percentage on original unit price.",
    )
    taxStatus: str = Field(
        default="TAX_NOT_CALCULATED",
        description="Tax calculation status: 'CALCULATED' or 'TAX_NOT_CALCULATED'.",
    )
    subtotalAmount: float = Field(
        ...,
        description="Subtotal order amount before statutory taxes.",
    )
    taxAmount: Optional[float] = Field(
        default=None,
        description="Applicable statutory tax amount if quotation includes tax.",
    )
    finalQuotationTotalWithTax: Optional[float] = Field(
        default=None,
        description="Final quotation total including taxes where configured.",
    )
    finalPayableAmount: Optional[float] = Field(
        default=None,
        description="Final total payable amount (Subtotal + Taxes). None if tax is not calculated.",
    )
    offerExpiresAt: Optional[str] = Field(
        default=None,
        description="ISO-8601 expiration timestamp for this revised offer.",
    )
    suggestedAlternatives: Optional[List[AlternativeRecommendation]] = Field(
        default=None,
        description="Grounded manufacturing alternatives when target price is unmet.",
    )


class InternalNegotiationMetadata(BaseModel):
    """
    Internal governance metadata for factory sales managers and application services.
    STRICT SECURITY RULE: NEVER exposed to customer-facing channels.
    """
    minimumAuthorizedPrice: float = Field(
        ...,
        description="Internal minimum authorized selling price floor.",
    )
    requiresApproval: bool = Field(
        default=False,
        description="Whether current concession requires human managerial approval.",
    )
    pendingApprovalId: Optional[str] = Field(
        default=None,
        description="Associated pending approval ID if escalated.",
    )
    pricingValidationStatus: str = Field(
        default="VALID",
        description="Status of pricing validation: 'VALID', 'EXPIRED_QUOTATION', 'MISSING_PRICING_DATA', 'BELOW_FLOOR'.",
    )
    customerTargetPrice: Optional[float] = Field(
        default=None,
        description="Explicit target price requested by customer.",
    )
    concessionGrantedPct: float = Field(
        default=0.0,
        description="Percentage concession granted from original quoted price.",
    )
    productionCostPerUnit: Optional[float] = Field(
        default=None,
        description="Factory direct manufacturing cost per unit.",
    )
    approvalNotes: Optional[str] = Field(
        default=None,
        description="Managerial justification or notes.",
    )


class NegotiatedOffer(BaseModel):
    """Auditable record of a formal price offer."""
    offerId: str
    quotationId: str
    originalPricePerUnit: float
    revisedPricePerUnit: float
    orderQuantity: int
    originalQuotationTotal: float
    revisedQuotationTotal: float
    totalSavings: float
    discountPercentage: float
    createdAt: str
    expiresAt: str
    offerStatus: OfferStatus = OfferStatus.ACTIVE


class ClientAssistantCustomerResponse(BaseModel):
    """
    Customer-facing API response for Client Assistant chat and bargaining.
    Contains ONLY customer-authorized information.
    Zero internal metadata, zero floor prices, zero cost numbers.
    """
    success: bool = True
    agent: str = "client_assistant_agent"
    conversationId: str
    customerId: int
    quotationId: str
    intent: CustomerIntent
    negotiationStatus: NegotiationStatus
    customerResponse: CustomerOfferView
    salesOrderId: Optional[Union[str, int]] = None
    orderCreationStatus: Optional[str] = None
    timestamp: str


class ClientAssistantInternalResponse(ClientAssistantCustomerResponse):
    """
    Authorized staff / internal application response containing negotiation metadata.
    Accessible ONLY with managerial authentication or explicit internal access.
    """
    internalMetadata: InternalNegotiationMetadata

    # Backward compatibility attributes matching earlier API schema
    response: Optional[str] = None
    originalPricePerUnit: Optional[float] = None
    currentOfferPerUnit: Optional[float] = None
    customerTargetPrice: Optional[float] = None
    minimumAuthorizedPrice: Optional[float] = None
    requiresApproval: Optional[bool] = None
    pendingApprovalId: Optional[str] = None
    suggestedAlternatives: Optional[List[AlternativeRecommendation]] = None


# Alias for internal codebase backwards compatibility
ClientAssistantChatResponse = ClientAssistantInternalResponse


class PendingApprovalRecord(BaseModel):
    """Record of an escalated pricing or term exception requiring human authorization."""
    approvalId: str
    conversationId: str
    tenantId: str
    customerId: int
    quotationId: str
    requestedPricePerUnit: float
    originalPricePerUnit: float
    minimumAuthorizedPrice: float
    requestedDiscountPct: float
    reason: str
    status: str = "PENDING"  # PENDING, APPROVED, REJECTED
    createdTimestamp: str
    decidedBy: Optional[str] = None
    decisionTimestamp: Optional[str] = None
    decisionNotes: Optional[str] = None


class HumanApprovalDecisionRequest(BaseModel):
    """Request payload for authorized manager to approve or reject an escalated negotiation."""
    tenantId: str = Field(
        default="tenant_default",
        description="Tenant identifier for multi-tenant isolation.",
    )
    authorizedBy: str = Field(
        ...,
        min_length=1,
        description="Name or ID of authorizing executive.",
    )
    decision: str = Field(
        ...,
        description="Decision: 'APPROVE' or 'REJECT'.",
    )
    approvedPricePerUnit: Optional[float] = Field(
        default=None,
        description="Approved negotiated unit price (if approving). Defaults to requested target price.",
    )
    notes: Optional[str] = Field(
        default=None,
        description="Managerial justification or conditions.",
    )


class HumanApprovalResponse(BaseModel):
    """Response payload after manager approval decision."""
    success: bool = True
    agent: str = "client_assistant_agent"
    approvalId: str
    conversationId: str
    quotationId: str
    status: str
    decision: str
    decidedBy: str
    effectivePricePerUnit: float
    message: str
    timestamp: str


class ConversationDetailResponse(BaseModel):
    """Detailed conversation history and negotiation progression."""
    success: bool = True
    agent: str = "client_assistant_agent"
    conversationId: str
    tenantId: str
    customerId: int
    quotationId: str
    negotiationStatus: NegotiationStatus
    originalPricePerUnit: float
    currentOfferPerUnit: float
    customerTargetPrice: Optional[float] = None
    minimumAuthorizedPrice: float
    requiresApproval: bool = False
    pendingApprovalId: Optional[str] = None
    activeOffer: Optional[NegotiatedOffer] = None
    messageCount: int
    messages: List[ChatMessage]
    negotiationSummary: Dict[str, Any] = Field(default_factory=dict)


class ConversationListResponse(BaseModel):
    """List of active or past conversations."""
    success: bool = True
    agent: str = "client_assistant_agent"
    totalCount: int
    conversations: List[ConversationDetailResponse]


class PendingApprovalsListResponse(BaseModel):
    """List of pending managerial approval requests."""
    success: bool = True
    agent: str = "client_assistant_agent"
    totalCount: int
    pendingApprovals: List[PendingApprovalRecord]


class AlternativesRequest(BaseModel):
    """Request to generate feasibility-backed product or quantity alternatives."""
    tenantId: str = "tenant_default"
    customerId: int
    quotationId: str
    targetPricePerUnit: Optional[float] = None


class AlternativesResponse(BaseModel):
    """Response containing validated alternatives."""
    success: bool = True
    agent: str = "client_assistant_agent"
    quotationId: str
    originalPricePerUnit: float
    targetPricePerUnit: Optional[float] = None
    alternatives: List[AlternativeRecommendation]
