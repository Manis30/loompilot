from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, field_validator, model_validator


class QuotationStatus(str, Enum):
    """Lifecycle statuses for a manufacturing quotation."""
    DRAFT = "DRAFT"
    PENDING_INFORMATION = "PENDING_INFORMATION"
    PENDING_REVIEW = "PENDING_REVIEW"
    READY_FOR_APPROVAL = "READY_FOR_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class CostComponentStatus(str, Enum):
    """Calculation completeness state for individual cost components."""
    COMPLETE = "COMPLETE"
    INCOMPLETE = "INCOMPLETE"
    UNAVAILABLE = "UNAVAILABLE"


class PricingMethod(str, Enum):
    """Profit margin calculation methodology."""
    MARKUP = "MARKUP"              # Selling Price = Total Cost * (1 + markup%)
    GROSS_MARGIN = "GROSS_MARGIN"  # Selling Price = Total Cost / (1 - margin%)


class OverheadAllocationMethod(str, Enum):
    """Methodology for allocating factory overhead expenses."""
    PERCENTAGE_OF_DIRECT_COST = "PERCENTAGE_OF_DIRECT_COST"
    COST_PER_LABOUR_HOUR = "COST_PER_LABOUR_HOUR"
    COST_PER_MACHINE_HOUR = "COST_PER_MACHINE_HOUR"
    COST_PER_FINISHED_UNIT = "COST_PER_FINISHED_UNIT"
    FIXED_AMOUNT = "FIXED_AMOUNT"


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------

class OverheadConfigRequest(BaseModel):
    """Configuration for overhead calculation."""
    method: OverheadAllocationMethod = Field(
        default=OverheadAllocationMethod.PERCENTAGE_OF_DIRECT_COST,
        description="Overhead allocation methodology."
    )
    rate: float = Field(
        default=12.0,
        ge=0.0,
        description="Overhead rate (percentage, hourly rate, or per unit rate)."
    )
    description: Optional[str] = "Factory utilities, rent, administration, and supervisory overhead"


class QuotationGenerationRequest(BaseModel):
    """Request payload for generating a manufacturing quotation."""
    tenantId: str = Field(
        default="tenant_default",
        description="Tenant identifier for multi-tenant isolation.",
        min_length=1,
    )
    clientId: Union[int, str] = Field(
        ...,
        description="Client identifier (e.g. 1, '1', 'CLIENT-001', or client name).",
    )
    productName: Optional[str] = Field(
        default=None,
        description="Product name (e.g. 'Cotton T-Shirt', 'Linen Casual Shirt').",
    )
    productId: Optional[Union[int, str]] = Field(
        default=None,
        description="Product ID if known (e.g. 1, 'PROD-001').",
    )
    quantity: int = Field(
        ...,
        gt=0,
        description="Requested manufacturing order quantity (must be > 0).",
    )
    specifications: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Technical specifications (fabric, GSM, size ratio, prints, packaging).",
    )
    requestedDeliveryDate: Optional[Union[date, str]] = Field(
        default=None,
        description="Target customer delivery date (YYYY-MM-DD).",
    )
    pricingMethod: PricingMethod = Field(
        default=PricingMethod.MARKUP,
        description="Pricing method: MARKUP on production cost or GROSS_MARGIN on selling price.",
    )
    marginPercentage: Optional[float] = Field(
        default=25.0,
        ge=0.0,
        lt=100.0,
        description="Target profit margin or markup percentage.",
    )
    taxRatePercentage: Optional[float] = Field(
        default=5.0,
        ge=0.0,
        description="Applicable tax rate (e.g. 5% GST for textile/garments). Set None if unconfigured.",
    )
    currency: str = Field(
        default="INR",
        description="Currency code for quotation (default INR).",
    )
    labourRates: Optional[Dict[str, float]] = Field(
        default=None,
        description="Optional configured hourly labour rates per stage (e.g. {'Cutting': 120.0, 'Stitching': 140.0, ...}).",
    )
    machineRates: Optional[Dict[str, float]] = Field(
        default=None,
        description="Optional configured hourly operating cost rates per machine type or stage.",
    )
    overheadConfig: Optional[OverheadConfigRequest] = Field(
        default=None,
        description="Optional manufacturing overhead allocation rules. If not provided, default factory rule applies.",
    )
    additionalCosts: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Configured additional costs (packaging, printing, embroidery, transportation).",
    )
    customerNotes: Optional[str] = Field(
        default=None,
        description="Customer-supplied specific requirements or notes.",
    )

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Order quantity must be strictly greater than zero.")
        return v

    @model_validator(mode="before")
    @classmethod
    def check_product_specified(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("productName") and not data.get("productId"):
                raise ValueError("Either 'productName' or 'productId' must be provided.")
        return data


class QuotationApprovalRequest(BaseModel):
    """Payload to authorize quotation approval."""
    authorizedBy: str = Field(
        ...,
        min_length=1,
        description="Name or ID of authorizing manager/executive.",
    )
    approvalNotes: Optional[str] = Field(
        default=None,
        description="Approval comments, rationale, or special conditions.",
    )


class QuotationRejectionRequest(BaseModel):
    """Payload to record quotation rejection."""
    rejectedBy: str = Field(
        ...,
        min_length=1,
        description="Name or ID of rejecting manager/client.",
    )
    rejectionReason: str = Field(
        ...,
        min_length=1,
        description="Clear reason for rejection (price too high, lead time, specification mismatch).",
    )


# ---------------------------------------------------------------------------
# Detailed Costing Line Item Models
# ---------------------------------------------------------------------------

class MaterialCostItem(BaseModel):
    """Detailed BOM material line item calculation."""
    materialId: int
    materialName: str
    category: str = "Raw Material"
    unit: str
    netConsumptionPerUnit: float
    wastagePercentage: float
    grossConsumptionPerUnit: float
    requiredQuantity: float
    adjustedQuantity: float
    unitPrice: Optional[float] = None
    currency: str = "INR"
    totalCost: Optional[float] = None
    priceSource: str = "Market Price Agent"
    priceEffectiveDate: Optional[str] = None
    priceConfidence: Optional[str] = None
    priceStatus: str = "VALID"
    missingReason: Optional[str] = None


class LabourCostItem(BaseModel):
    """Detailed stage-specific labour costing line item."""
    stage: str
    operationName: str
    requiredHoursPerUnit: float
    totalLabourHours: float
    hourlyRateINR: Optional[float] = None
    totalCost: Optional[float] = None
    currency: str = "INR"
    rateSource: str = "Configured Department Rate"
    status: str = "VALID"
    missingReason: Optional[str] = None


class MachineCostItem(BaseModel):
    """Detailed machine operation costing line item."""
    stage: str
    machineType: str
    standardThroughputUnitsPerHour: float
    machineOperatingHours: float
    hourlyOperatingCostINR: Optional[float] = None
    totalCost: Optional[float] = None
    currency: str = "INR"
    powerAndMaintenanceAllocation: Optional[float] = None
    status: str = "VALID"
    missingReason: Optional[str] = None


class OverheadCostItem(BaseModel):
    """Manufacturing overhead allocation line item."""
    component: str
    allocationMethod: str
    basisAmount: Optional[float] = None
    appliedRate: float
    allocatedCost: Optional[float] = None
    currency: str = "INR"
    notes: Optional[str] = None


class AdditionalCostItem(BaseModel):
    """Customer or process specific additional production cost."""
    costType: str
    description: str
    costBasis: str = "PER_UNIT"
    rateOrAmount: float
    totalCost: float
    currency: str = "INR"


class TaxBreakdownItem(BaseModel):
    """Detailed tax component."""
    taxType: str
    taxRatePercentage: float
    taxableAmount: float
    taxAmount: float
    currency: str = "INR"


# ---------------------------------------------------------------------------
# Cost Breakdown & Financial Summary Sections
# ---------------------------------------------------------------------------

class MaterialsCostBreakdown(BaseModel):
    status: CostComponentStatus = CostComponentStatus.COMPLETE
    items: List[MaterialCostItem] = Field(default_factory=list)
    totalCost: Optional[float] = None
    missingMaterials: List[str] = Field(default_factory=list)


class LabourCostBreakdown(BaseModel):
    status: CostComponentStatus = CostComponentStatus.COMPLETE
    operations: List[LabourCostItem] = Field(default_factory=list)
    totalCost: Optional[float] = None
    totalLabourHours: Optional[float] = None
    missingOperations: List[str] = Field(default_factory=list)


class MachineCostBreakdown(BaseModel):
    status: CostComponentStatus = CostComponentStatus.COMPLETE
    operations: List[MachineCostItem] = Field(default_factory=list)
    totalCost: Optional[float] = None
    totalMachineHours: Optional[float] = None
    missingMachines: List[str] = Field(default_factory=list)


class OverheadCostBreakdown(BaseModel):
    status: CostComponentStatus = CostComponentStatus.COMPLETE
    items: List[OverheadCostItem] = Field(default_factory=list)
    totalCost: Optional[float] = None
    allocationMethod: Optional[str] = None


class AdditionalCostBreakdown(BaseModel):
    status: CostComponentStatus = CostComponentStatus.COMPLETE
    items: List[AdditionalCostItem] = Field(default_factory=list)
    totalCost: Optional[float] = 0.0


class QuotationCostBreakdown(BaseModel):
    """Comprehensive bottom-up cost breakdown."""
    materials: MaterialsCostBreakdown = Field(default_factory=MaterialsCostBreakdown)
    labour: LabourCostBreakdown = Field(default_factory=LabourCostBreakdown)
    machine: MachineCostBreakdown = Field(default_factory=MachineCostBreakdown)
    overhead: OverheadCostBreakdown = Field(default_factory=OverheadCostBreakdown)
    additionalCosts: AdditionalCostBreakdown = Field(default_factory=AdditionalCostBreakdown)


class ClientDetails(BaseModel):
    """Customer profile information."""
    clientId: int
    clientName: str
    city: str
    email: str
    pricingTier: str = "Standard"
    paymentTerms: Optional[str] = None
    approvedDiscountPct: float = 0.0
    taxTreatment: str = "Domestic Standard GST"


class ProductDetails(BaseModel):
    """Product master information."""
    productId: int
    productName: str
    stages: List[str] = Field(default_factory=list)
    standardFabricKgPerUnit: float


class QuotationFinancialSummary(BaseModel):
    """Summary of financial metrics, margin, and taxes."""
    currency: str = "INR"
    totalMaterialCost: Optional[float] = None
    totalLabourCost: Optional[float] = None
    totalMachineCost: Optional[float] = None
    totalOverheadCost: Optional[float] = None
    totalAdditionalCost: Optional[float] = None
    totalProductionCost: Optional[float] = None
    productionCostPerUnit: Optional[float] = None
    pricingMethod: Optional[str] = None
    marginPercentage: Optional[float] = None
    marginAmount: Optional[float] = None
    sellingPriceBeforeTax: Optional[float] = None
    sellingPricePerUnit: Optional[float] = None
    taxBreakdown: List[TaxBreakdownItem] = Field(default_factory=list)
    totalTax: Optional[float] = None
    finalQuotationAmount: Optional[float] = None
    finalQuotationAmountPerUnit: Optional[float] = None


# ---------------------------------------------------------------------------
# Top-Level Quotation Models
# ---------------------------------------------------------------------------

class QuotationDetail(BaseModel):
    """Full structured manufacturing quotation record."""
    quotationId: str
    quotationNumber: str
    tenantId: str
    client: ClientDetails
    product: ProductDetails
    productName: str
    quantity: int
    status: QuotationStatus
    specifications: Dict[str, Any] = Field(default_factory=dict)
    costBreakdown: QuotationCostBreakdown
    financialSummary: QuotationFinancialSummary
    assumptions: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    missingInformation: List[str] = Field(default_factory=list)
    explanation: Optional[str] = None
    calculationTimestamp: str
    validUntil: Optional[str] = None
    requestedDeliveryDate: Optional[str] = None
    estimatedLeadTimeDays: Optional[int] = None
    approvalHistory: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class QuotationResponse(BaseModel):
    """Standard API response wrapping a QuotationDetail."""
    success: bool = True
    agent: str = "quotation_agent"
    quotation: QuotationDetail
    message: Optional[str] = None


class QuotationListResponse(BaseModel):
    """Response payload for querying quotations."""
    success: bool = True
    agent: str = "quotation_agent"
    totalCount: int
    quotations: List[QuotationDetail]

