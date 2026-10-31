from datetime import date
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, model_validator


class FeasibilityEvaluationRequest(BaseModel):
    """Request payload for assessing manufacturing order feasibility."""
    tenantId: str = Field(
        default="tenant_default",
        description="Tenant identifier for multi-tenant isolation.",
        min_length=1,
    )
    orderId: Optional[Union[int, str]] = Field(
        default=None,
        description="Order identifier (e.g. 1, 'LP-2026-001', 'ORD-001').",
    )
    productId: Optional[Union[int, str]] = Field(
        default=None,
        description="Optional product override or simulation product identifier.",
    )
    orderQuantity: Optional[int] = Field(
        default=None,
        ge=1,
        description="Optional quantity override or simulation quantity.",
    )
    requiredDeliveryDate: Optional[date] = Field(
        default=None,
        description="Optional required delivery date override or simulation date.",
    )
    evaluationDate: Optional[date] = Field(
        default=None,
        description="Anchor evaluation date (defaults to current date or latest dataset date).",
    )
    includeMarketPriceRisk: Optional[bool] = Field(
        default=False,
        description="Optional hook to query Market Price Agent for price forecasting on short materials.",
    )
    customOrder: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional nested dictionary for custom order simulation.",
    )

    @model_validator(mode="before")
    @classmethod
    def unpack_custom_order(cls, data: Any) -> Any:
        if isinstance(data, dict):
            co = data.get("customOrder")
            if isinstance(co, dict):
                if not data.get("orderId"):
                    data["orderId"] = co.get("orderNumber") or co.get("orderId") or "SIM-001"
                if not data.get("productId") and co.get("productId"):
                    data["productId"] = co.get("productId")
                if not data.get("orderQuantity") and co.get("orderQuantity"):
                    data["orderQuantity"] = co.get("orderQuantity")
                if not data.get("requiredDeliveryDate") and (co.get("requiredDeliveryDate") or co.get("requestedDeliveryDate")):
                    data["requiredDeliveryDate"] = co.get("requiredDeliveryDate") or co.get("requestedDeliveryDate")
            if not data.get("orderId"):
                data["orderId"] = "SIM-001"
        return data


class SupplierLeadTimeInfo(BaseModel):
    """Preferred supplier details for a material."""
    supplierId: int
    supplierName: str
    city: str
    leadTimeDays: int


class MaterialProcurementOption(BaseModel):
    """Mutually exclusive procurement option for resolving material shortage."""
    scope: str = Field(description="NEW_ORDER_ONLY or FACTORY_WIDE_REPLENISHMENT")
    quantity: float
    unit: str
    supplierName: Optional[str] = None
    estimatedLeadTimeDays: Optional[int] = None
    isRecommended: bool = False
    recommendationReason: str = ""
    costImpactNote: str = ""


class MaterialItemAssessment(BaseModel):
    """Detailed feasibility evaluation for an individual BOM material line item."""
    materialId: int
    materialName: str
    unit: str
    processStage: str
    netConsumptionPerUnit: float
    wastageRatePct: float
    grossConsumptionPerUnit: float
    requiredQuantity: float
    physicalStock: float = 0.0
    currentStock: float
    committedStock: float
    netAvailableStock: float
    usableAvailableStock: float = 0.0
    existingCommitmentDeficit: float = 0.0
    shortageQuantity: float
    newOrderRequirement: float = 0.0
    newOrderProcurementQuantity: float = 0.0
    factoryWideReplenishmentQuantity: float = 0.0
    procurementScope: str = "NEW_ORDER_ONLY"
    additionalProcurementQuantity: float = 0.0
    isShortage: bool
    supplier: Optional[SupplierLeadTimeInfo] = None
    procurementLeadTimeDays: Optional[int] = None
    expectedAvailabilityDate: Optional[str] = None
    isProcurementConfirmed: bool = False
    procurementOptions: Dict[str, MaterialProcurementOption] = Field(default_factory=dict)
    selectedProcurementOption: Optional[str] = None
    procurementChoiceInstruction: Optional[str] = None
    procurementConfirmationStatus: str = "UNCONFIRMED_ESTIMATE"
    scheduleImpactIfDelayed: Optional[str] = None
    notes: Optional[str] = None
    marketPriceForecast: Optional[Dict[str, Any]] = None


class MaterialCheckResult(BaseModel):
    """Aggregated material feasibility evaluation."""
    status: str = Field(description="PASS, WARNING, FAIL, or INSUFFICIENT_DATA")
    isFeasible: bool
    summary: str
    materialsCount: int
    shortagesCount: int
    totalExistingCommitmentDeficit: float = 0.0
    maxProcurementLeadTimeDays: int
    materialAvailabilityDate: Optional[str] = None
    stageMaterialAvailabilityDates: Dict[str, Optional[str]] = Field(default_factory=dict)
    items: List[MaterialItemAssessment] = Field(default_factory=list)


class StageMachineAssessment(BaseModel):
    """Machine capacity assessment for a specific production stage."""
    stage: str
    nominalCapacityUnitsPerDay: int
    reservedCapacityUnitsPerDay: Optional[int] = Field(
        default=None,
        description="Pre-scheduled order capacity. Represented as None/unknown when reservation schedules are not present in dataset.",
    )
    availableCapacityUnitsPerDay: Optional[int] = Field(
        default=None,
        description="Verified available capacity. Represented as None/unknown when machine reservation timetables are unverified.",
    )
    allocatedCapacityUnitsPerDay: int = Field(
        description="Nominal throughput of allocated equipment used for provisional scheduling model."
    )
    assignedOrderQuantity: int
    estimatedDurationDays: int

    # Backward compatibility aliases
    totalStageCapacityUnitsPerDay: Optional[int] = None
    totalAllocatedCapacityPerDay: Optional[int] = None
    allocatedMachineCode: Optional[str] = None
    allocatedMachineCodes: List[str] = Field(default_factory=list)
    availableMachines: List[str] = Field(default_factory=list)
    maintenanceMachines: List[str] = Field(default_factory=list)
    capacityPerMachinePerDay: Dict[str, int] = Field(default_factory=dict)
    quantityAssignedPerMachine: Dict[str, int] = Field(default_factory=dict)
    availableOperatingHours: float = 8.0
    existingOrderReservations: Optional[int] = None
    remainingCapacityForOrder: Optional[int] = None
    requiredOperators: int = 1
    availableQualifiedOperators: int = 1
    machineCompatibilityVerified: bool = True
    durationDays: Optional[int] = None
    isBottleneck: bool = False
    alternativeCompatibleMachines: List[str] = Field(default_factory=list)

    # Status markers
    reservationStatus: str = "UNKNOWN"
    isCapacityVerified: bool = False
    scheduleType: str = "PROVISIONAL_ADVISORY"
    capacityNotes: str = (
        "Schedule is provisional/advisory. Machine slot availability is unverified because "
        "order-level machine reservation records are not present in dataset; floor supervisor "
        "confirmation is required before locking production slots."
    )

    @model_validator(mode="before")
    @classmethod
    def sync_capacity_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Sync nominal / total
            if "totalStageCapacityUnitsPerDay" in data and "nominalCapacityUnitsPerDay" not in data:
                data["nominalCapacityUnitsPerDay"] = data["totalStageCapacityUnitsPerDay"]
            elif "nominalCapacityUnitsPerDay" in data and "totalStageCapacityUnitsPerDay" not in data:
                data["totalStageCapacityUnitsPerDay"] = data["nominalCapacityUnitsPerDay"]

            # Sync durationDays / estimatedDurationDays
            if "durationDays" in data and "estimatedDurationDays" not in data:
                data["estimatedDurationDays"] = data["durationDays"]
            elif "estimatedDurationDays" in data and "durationDays" not in data:
                data["durationDays"] = data["estimatedDurationDays"]

            # Sync allocatedCapacityUnitsPerDay / totalAllocatedCapacityPerDay
            if "totalAllocatedCapacityPerDay" in data and "allocatedCapacityUnitsPerDay" not in data:
                data["allocatedCapacityUnitsPerDay"] = data["totalAllocatedCapacityPerDay"]
            elif "allocatedCapacityUnitsPerDay" in data and "totalAllocatedCapacityPerDay" not in data:
                data["totalAllocatedCapacityPerDay"] = data["allocatedCapacityUnitsPerDay"]

            # Sync quantityAssignedPerMachine / assignedOrderQuantity
            if "assignedOrderQuantity" not in data and "quantityAssignedPerMachine" in data:
                vals = list(data["quantityAssignedPerMachine"].values())
                data["assignedOrderQuantity"] = vals[0] if vals else 0
            elif "assignedOrderQuantity" in data and "quantityAssignedPerMachine" not in data:
                m_code = data.get("allocatedMachineCode") or "M-01"
                data["quantityAssignedPerMachine"] = {m_code: data["assignedOrderQuantity"]}
        return data


class MachineCheckResult(BaseModel):
    """Aggregated machine feasibility evaluation."""
    status: str = Field(description="PASS, WARNING, or FAIL")
    isFeasible: bool
    summary: str
    bottleneckStage: Optional[str] = None
    bottleneckMachine: Optional[str] = None
    bottleneckReason: Optional[str] = None
    stages: List[StageMachineAssessment] = Field(default_factory=list)


class StageWorkforceAssessment(BaseModel):
    """Workforce assessment for a specific production stage."""
    stage: str
    qualifiedWorkersCount: int
    primarySupervisor: Optional[str] = None
    attendanceRatePct: float
    dailyAvailableHours: float
    isSufficient: bool
    notes: str


class WorkforceCheckResult(BaseModel):
    """Aggregated workforce feasibility evaluation."""
    status: str = Field(description="PASS, WARNING, or FAIL")
    isFeasible: bool
    summary: str
    overallAttendanceRatePct: float
    dailyShiftHours: int
    stages: List[StageWorkforceAssessment] = Field(default_factory=list)


class ExistingOrdersCheckResult(BaseModel):
    """Impact analysis of active commitments from in-progress orders."""
    status: str
    activeOrdersCount: int
    totalCommittedUnits: int
    summary: str
    conflictNotes: List[str] = Field(default_factory=list)


class ScheduleStageItem(BaseModel):
    """Individual timeline phase in the calculated production schedule."""
    stage: str
    durationDays: int
    startDate: str
    endDate: str
    dependency: str
    notes: Optional[str] = None


class ProductionScheduleResult(BaseModel):
    """Calculated production schedule with process dependencies."""
    evaluationDate: str
    procurementCompletionDate: Optional[str] = None
    estimatedProductionStartDate: Optional[str] = None
    estimatedProductionCompletionDate: Optional[str] = None
    earliestFeasibleDeliveryDate: Optional[str] = None
    requestedDeliveryDate: Optional[str] = None
    delayDays: int
    totalProductionDurationDays: int
    totalCycleDays: int
    dispatchBufferDays: int
    qualityBufferDays: int
    stageBreakdown: List[ScheduleStageItem] = Field(default_factory=list)
    scheduleBottleneck: Optional[str] = None
    scheduleType: str = "PROVISIONAL_ADVISORY"
    machineSlotConfirmationRequired: bool = True
    workingCalendarDescription: str = (
        "Inferred 6-Day Factory Calendar (Mon-Sat, Sun Off; derived from LoomPilot_Attendance.xlsx "
        "until official factory master calendar is configured)"
    )


class FeasibilityChecks(BaseModel):
    """Grouped assessment checks covering all operational manufacturing domains."""
    material: MaterialCheckResult
    machine: MachineCheckResult
    workforce: WorkforceCheckResult
    existingOrders: ExistingOrdersCheckResult
    productionSchedule: Optional[ProductionScheduleResult] = None


class FeasibilityIssue(BaseModel):
    """Detailed operational issue explaining a constraint in understandable business terms."""
    category: str = Field(description="MATERIAL_SHORTAGE, MACHINE_CONSTRAINT, WORKFORCE_CONSTRAINT, SCHEDULE_CONFLICT, or DATA_LIMITATION")
    severity: str = Field(description="CRITICAL, HIGH, MEDIUM, LOW, or INFO")
    resourceName: str
    affectedResource: Optional[str] = None
    title: str
    reason: str
    rootCause: Optional[str] = None
    affectedProductionStage: Optional[str] = None
    actualAvailable: Optional[str] = None
    actualAvailableQuantity: Optional[str] = None
    required: Optional[str] = None
    requiredQuantity: Optional[str] = None
    shortage: Optional[str] = None
    shortageQuantity: Optional[str] = None
    existingCommitmentDeficit: Optional[float] = None
    newOrderShortage: Optional[float] = None
    recommendedProcurementQuantity: Optional[float] = None
    procurementScope: Optional[str] = None
    supplierName: Optional[str] = None
    estimatedLeadTimeDays: Optional[int] = None
    explanation: str
    businessImpact: str
    recommendation: str
    recommendedAction: Optional[str] = None
    estimatedResolutionDays: Optional[int] = None
    estimatedResolutionTime: Optional[str] = None
    requiresAdminApproval: bool = True

    @model_validator(mode="before")
    @classmethod
    def sync_issue_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Sync resource
            if "resourceName" in data and not data.get("affectedResource"):
                data["affectedResource"] = data["resourceName"]
            elif "affectedResource" in data and not data.get("resourceName"):
                data["resourceName"] = data["affectedResource"]

            # Sync reason / rootCause
            if "reason" in data and not data.get("rootCause"):
                data["rootCause"] = data["reason"]
            elif "rootCause" in data and not data.get("reason"):
                data["reason"] = data["rootCause"]

            # Sync recommendation / recommendedAction
            if "recommendation" in data and not data.get("recommendedAction"):
                data["recommendedAction"] = data["recommendation"]
            elif "recommendedAction" in data and not data.get("recommendation"):
                data["recommendation"] = data["recommendedAction"]

            # Sync actualAvailable / actualAvailableQuantity
            if "actualAvailable" in data and not data.get("actualAvailableQuantity"):
                data["actualAvailableQuantity"] = str(data["actualAvailable"])
            elif "actualAvailableQuantity" in data and not data.get("actualAvailable"):
                data["actualAvailable"] = str(data["actualAvailableQuantity"])

            # Sync required / requiredQuantity
            if "required" in data and not data.get("requiredQuantity"):
                data["requiredQuantity"] = str(data["required"])
            elif "requiredQuantity" in data and not data.get("required"):
                data["required"] = str(data["requiredQuantity"])

            # Sync shortage / shortageQuantity
            if "shortage" in data and not data.get("shortageQuantity"):
                data["shortageQuantity"] = str(data["shortage"])
            elif "shortageQuantity" in data and not data.get("shortage"):
                data["shortage"] = str(data["shortageQuantity"])

            # Sync estimatedResolutionDays / estimatedResolutionTime
            if "estimatedResolutionDays" in data and data["estimatedResolutionDays"] is not None and not data.get("estimatedResolutionTime"):
                data["estimatedResolutionTime"] = f"{data['estimatedResolutionDays']} day(s)"
        return data


class FeasibilityRecommendation(BaseModel):
    """Actionable recommendation for factory administrators."""
    category: str = Field(description="PROCUREMENT, MACHINE, WORKFORCE, SCHEDULING, or PROCESS")
    priority: str = Field(description="HIGH, MEDIUM, or LOW")
    title: str
    action: str
    expectedImpact: str
    requiresAdminApproval: bool = True


class AlternativeScenario(BaseModel):
    """Alternative production scenario for mitigating identified bottlenecks."""
    scenarioName: str
    description: str
    changes: str
    resolvesConstraint: bool
    expectedDeliveryDate: Optional[str] = None
    revisedEarliestDeliveryDate: Optional[str] = None
    delayDays: int
    daysSaved: int = 0
    workforceVerified: bool = False
    isWorkforceConfirmed: bool = False
    machineVerified: bool = True
    machineCompatibilityVerified: bool = True
    isMachineSlotConfirmed: bool = False
    workloadAllocation: Dict[str, int] = Field(default_factory=dict)
    requiredOperators: Optional[int] = None
    availableQualifiedOperators: Optional[int] = None
    operatorAllocation: Dict[str, str] = Field(default_factory=dict)
    operatorCommitmentStatus: str = "UNKNOWN (Shift/order-level operator assignment records unavailable in dataset)"
    workforceVerificationStatus: str = "ADVISORY (Qualified operators in roster, but active floor commitments are unverified)"
    isProcurementConfirmed: bool = False
    workingCalendarUsed: str = (
        "Inferred 6-Day Factory Calendar (Mon-Sat, Sun Off; derived from LoomPilot_Attendance.xlsx "
        "until official factory master calendar is configured)"
    )
    remainingRisks: str
    requiresAdminApproval: bool = True
    recalculatedSchedule: Optional[Dict[str, Any]] = None

    @model_validator(mode="before")
    @classmethod
    def sync_scenario_dates(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "expectedDeliveryDate" in data and not data.get("revisedEarliestDeliveryDate"):
                data["revisedEarliestDeliveryDate"] = data["expectedDeliveryDate"]
            elif "revisedEarliestDeliveryDate" in data and not data.get("expectedDeliveryDate"):
                data["expectedDeliveryDate"] = data["revisedEarliestDeliveryDate"]
        return data


class FeasibilityEvaluationResponse(BaseModel):
    """Comprehensive manufacturing feasibility assessment contract."""
    success: bool = True
    agent: str = "feasibility_agent"
    tenantId: str
    orderId: Union[int, str]
    orderNumber: Optional[str] = None
    productName: Optional[str] = None
    orderQuantity: int
    assessmentStatus: str = Field(description="FEASIBLE, CONDITIONALLY_FEASIBLE, NOT_FEASIBLE, or NEEDS_INFORMATION")
    status: Optional[str] = None
    requestedDeliveryDate: Optional[str] = None
    estimatedProductionStartDate: Optional[str] = None
    estimatedProductionCompletionDate: Optional[str] = None
    earliestFeasibleDeliveryDate: Optional[str] = None
    delayDays: int = 0
    confidence: str = Field(description="HIGH, MEDIUM, or LOW")
    summary: str
    scheduleType: str = "PROVISIONAL_ADVISORY"
    machineSlotConfirmationRequired: bool = True
    stockLedgerStatus: Optional[Dict[str, Any]] = None
    checks: Optional[FeasibilityChecks] = None
    issues: List[FeasibilityIssue] = Field(default_factory=list)
    recommendations: List[FeasibilityRecommendation] = Field(default_factory=list)
    alternativeScenarios: List[AlternativeScenario] = Field(default_factory=list)
    dataLimitations: List[str] = Field(default_factory=list)
    explanation: str

    @model_validator(mode="before")
    @classmethod
    def sync_status_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "assessmentStatus" in data and not data.get("status"):
                data["status"] = data["assessmentStatus"]
            elif "status" in data and not data.get("assessmentStatus"):
                data["assessmentStatus"] = data["status"]
        return data
