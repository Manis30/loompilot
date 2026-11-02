from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class SupplierNegotiationStatus(str, Enum):
    """Lifecycle statuses for raw material supplier negotiations."""
    INITIAL = "INITIAL"
    IN_PROGRESS = "IN_PROGRESS"
    COUNTER_MADE = "COUNTER_MADE"
    OFFER_ACCEPTED = "OFFER_ACCEPTED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"


class SupplierNegotiationIntent(str, Enum):
    """Categorized intent of a material supplier chat message."""
    QUOTE_SUBMISSION = "QUOTE_SUBMISSION"
    PRICE_INCREASE = "PRICE_INCREASE"
    BULK_DISCOUNT_OFFER = "BULK_DISCOUNT_OFFER"
    PAYMENT_TERM_DISCOUNT = "PAYMENT_TERM_DISCOUNT"
    QUALITY_VARIATION = "QUALITY_VARIATION"
    COUNTER_OFFER = "COUNTER_OFFER"
    ACCEPTANCE = "ACCEPTANCE"
    REJECTION = "REJECTION"
    GENERAL_QUERY = "GENERAL_QUERY"
    OTHER = "OTHER"


class SupplierOfferView(BaseModel):
    """Structured view of a supplier commercial offer or LoomPilot counter-offer."""
    offerId: str
    conversationId: str
    materialId: int
    materialName: str
    quantity: float
    unit: str
    supplierQuotedPriceINR: float
    loompilotCounterPriceINR: Optional[float] = None
    paymentTerms: Optional[str] = None
    status: str
    createdAt: str
    offerExpiresAt: str


class ProcurementBenchmark(BaseModel):
    """Factual benchmark metrics from LoomPilot inventory and market price datasets."""
    materialId: int
    materialName: str
    unit: str
    recordedUnitPriceINR: float
    marketSpotPriceINR: float
    marketPriceTrend: str
    market30DayChangePct: float
    currentStock: float
    committedStock: float
    netAvailableStock: float
    preferredSupplierId: int
    preferredSupplierName: str
    targetPurchasePriceINR: float
    maxAuthorizedProcurementPriceINR: float
    inventorySufficient: bool


class InternalProcurementMetadata(BaseModel):
    """
    Confidential internal metrics for procurement managers and executives.
    Strictly restricted from being exposed in public or supplier-facing communications.
    """
    targetPurchasePriceINR: float
    maxAuthorizedProcurementPriceINR: float
    recordedUnitPriceINR: float
    marketSpotPriceINR: float
    currentStock: float
    inventorySufficient: bool
    marketVerificationNote: str
    qualityCheckPassed: bool
    qualityNotes: Optional[str] = None
    requiresApproval: bool = False
    pendingApprovalId: Optional[str] = None
    escalationReason: Optional[str] = None
    confidentialityNotice: str = (
        "CONFIDENTIAL: Internal procurement ceilings, target prices, and factory margins "
        "must never be disclosed to external suppliers."
    )


class SupplierChatRequest(BaseModel):
    """Incoming request payload for Material Supplier Assistant negotiation."""
    tenantId: str = Field(default="tenant_default", description="Multi-tenant identifier.")
    supplierId: int = Field(description="Supplier ID from LoomPilot supplier directory.")
    materialId: Union[int, str] = Field(description="Material ID (int) or Name (e.g. 'Cotton Fabric').")
    conversationId: str = Field(description="Unique conversation session tracking ID.")
    message: str = Field(description="Supplier incoming message text.")
    quantity: Optional[float] = Field(default=None, description="Procurement batch quantity.")
    unit: Optional[str] = Field(default=None, description="Measurement unit (e.g. 'kg', 'cone', 'meter').")
    offeredPricePerUnit: Optional[float] = Field(default=None, description="Explicit price quoted by supplier in INR.")
    paymentTerms: Optional[str] = Field(default=None, description="Commercial credit/payment terms (e.g. 'Net 30', 'Net 15').")
    proposedGsm: Optional[float] = Field(default=None, description="Supplier proposed fabric GSM if varying specification.")
    includeInternalMetadata: bool = Field(default=False, description="Set True only by authorized procurement staff.")


class SupplierChatResponse(BaseModel):
    """
    Supplier-facing clean response payload.
    Contains no internal margin targets, maximum willingness to pay, or customer quotations.
    """
    success: bool = True
    agent: str = "material_supplier_assistant"
    conversationId: str
    supplierId: int
    supplierName: str
    materialId: int
    materialName: str
    intent: SupplierNegotiationIntent
    negotiationStatus: SupplierNegotiationStatus
    supplierQuotedPrice: Optional[float] = None
    loompilotCounterPrice: Optional[float] = None
    quantity: float
    unit: str
    paymentTermsNegotiated: Optional[str] = None
    response: str
    timestamp: str
    activeOffer: Optional[SupplierOfferView] = None
    internalMetadata: Optional[InternalProcurementMetadata] = None


class SupplierApprovalView(BaseModel):
    """Pending or decided procurement managerial approval record."""
    approvalId: str
    conversationId: str
    supplierId: int
    supplierName: str
    materialId: int
    materialName: str
    quantity: float
    unit: str
    supplierQuotedPrice: float
    maxAuthorizedPrice: float
    targetPrice: float
    reason: str
    status: str = "PENDING"
    createdAt: str
    decision: Optional[str] = None
    decidedAt: Optional[str] = None
    decidedBy: Optional[str] = None


class SupplierApprovalDecisionRequest(BaseModel):
    """Request payload for an authorized procurement executive deciding an escalation."""
    decision: str = Field(description="Decision: 'APPROVE' or 'REJECT'")
    decidedBy: str = Field(default="procurement_manager", description="Username or ID of authorizing staff.")
    authorizedPricePerUnit: Optional[float] = Field(default=None, description="Specific approved price cap per unit.")
    notes: Optional[str] = Field(default=None, description="Internal procurement approval notes.")

