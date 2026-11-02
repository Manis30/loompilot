from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AlertSeverity(str, Enum):
    """Operational alert severity levels."""
    CRITICAL = "CRITICAL"  # Severe breakdown, major delivery delay (> 14 days), emergency
    HIGH = "HIGH"          # Machine under maintenance, overdue production order
    MEDIUM = "MEDIUM"      # Moderate performance gap, elevated absenteeism (> 10%)
    LOW = "LOW"            # Operational advisory, preventive notice


class AlertCategory(str, Enum):
    """Operational categories for monitoring alerts."""
    MACHINE = "MACHINE"
    PRODUCTION = "PRODUCTION"
    WORKFORCE = "WORKFORCE"
    QUALITY = "QUALITY"
    GENERAL = "GENERAL"


class AlertStatus(str, Enum):
    """Lifecycle status of an operational alert."""
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class OperationalAlert(BaseModel):
    """Standardized operational alert with supporting empirical evidence."""
    alertId: str
    category: AlertCategory
    severity: AlertSeverity
    relatedEntity: Optional[str] = Field(None, description="Machine code, Order Number, or Process Area")
    description: str
    evidence: str = Field(description="Actual source record from dataset supporting the alert")
    detectedTimestamp: str
    recommendedAction: str
    status: AlertStatus = AlertStatus.ACTIVE


class MachineStatusItem(BaseModel):
    """Granular operational snapshot of an individual factory machine."""
    machineId: int
    machineCode: str
    machineType: str
    processArea: str
    capacityUnitsPerDay: float
    currentStatus: str = Field(description="Status from dataset: Available, Maintenance, Breakdown")
    isOperating: bool
    isIdle: bool
    isUnderMaintenance: bool
    requiresAttention: bool
    attentionReason: Optional[str] = None


class MachineUtilizationMetric(BaseModel):
    """
    Machine utilization metrics calculated deterministically.
    If actual running time data is unavailable, explicitly reports non-calculability.
    """
    actualRunningTimeHours: Optional[float] = None
    availableProductionTimeHours: Optional[float] = None
    utilizationPct: Optional[float] = None
    formula: str = "Machine Utilization (%) = (Actual Running Time / Available Production Time) * 100"
    isCalculable: bool = False
    dataAvailabilityNote: str


class MachineMonitoringResponse(BaseModel):
    """Consolidated machine operations monitoring view."""
    asOfDate: str
    totalMachines: int
    availableCount: int
    runningCount: int
    idleCount: int
    maintenanceCount: int
    breakdownCount: int
    machines: List[MachineStatusItem]
    utilization: MachineUtilizationMetric
    attentionRequiredMachines: List[str]


class ProductionOrderItem(BaseModel):
    """Progress and scheduling tracking for a manufacturing order."""
    orderId: int
    orderNumber: str
    productId: int
    productName: str
    orderQuantity: int = Field(description="Planned production target")
    producedQuantity: int = Field(description="Actual cumulative production output")
    remainingQuantity: int
    productionAchievementPct: float = Field(description="Production Achievement (%) = (Actual / Planned) * 100")
    receivedDate: str
    requiredDeliveryDate: str
    isDelayed: bool
    delayDays: int
    orderStatus: str
    stagesProgress: List[Dict[str, Any]] = Field(default_factory=list)


class ProductionMonitoringResponse(BaseModel):
    """Consolidated factory production progress and schedule performance."""
    asOfDate: str
    totalPlannedUnits: int
    totalProducedUnits: int
    overallAchievementPct: float
    totalOrdersCount: int
    activeOrdersCount: int
    completedOrdersCount: int
    delayedOrdersCount: int
    delayedOrders: List[ProductionOrderItem]
    activeOrders: List[ProductionOrderItem]
    bottleneckStages: List[Dict[str, Any]]
    formula: str = "Production Achievement (%) = (Actual Production / Planned Production) * 100"


class EmployeeAttendanceItem(BaseModel):
    """Individual employee attendance record (privacy-protected, no sensitive PII)."""
    employeeId: int
    employeeName: str
    jobRole: str
    attendanceStatus: str
    hoursWorked: Optional[float] = None


class WorkforceMonitoringResponse(BaseModel):
    """Workforce attendance, availability, and capacity sufficiency monitoring."""
    asOfDate: str
    totalEmployees: int
    presentCount: int
    absentCount: int
    halfDayCount: int
    leaveCount: int
    workforceAvailabilityPct: float = Field(
        description="Workforce Availability (%) = ((Present + 0.5 * HalfDay) / TotalEmployees) * 100"
    )
    absentEmployees: List[EmployeeAttendanceItem]
    isWorkforceSufficient: bool
    workforceNotes: str
    dataPrivacyNotice: str = (
        "CONFIDENTIALITY SAFEGUARD: Personal identifiers (Aadhaar, address, bank, compensation) "
        "are strictly omitted from operational monitoring views."
    )


class RootCauseItem(BaseModel):
    """Identified root causes distinguishing verified records from possible correlations."""
    issueType: str
    relatedEntity: str
    isVerified: bool = Field(description="True if directly supported by empirical dataset records; False if inferred")
    causeDescription: str
    supportingEvidence: str


class RecommendationItem(BaseModel):
    """Actionable factory management recommendation grounded in real metrics."""
    recommendationId: str
    priority: AlertSeverity
    category: AlertCategory
    targetEntity: str
    actionText: str
    justification: str
    isAutomatedAction: bool = False
    governanceNotice: str = "Recommendations are advisory. Operational changes require authorized management workflows."


class FactoryHealthReport(BaseModel):
    """Comprehensive factory operational health summary."""
    reportId: str
    asOfTimestamp: str
    asOfDate: str
    dataSourcesUsed: List[str]
    factoryHealthStatus: str  # "HEALTHY", "NEEDS_ATTENTION", "DEGRADED", "CRITICAL"
    machineSummary: Dict[str, Any]
    machineUtilization: MachineUtilizationMetric
    productionSummary: Dict[str, Any]
    delayedOrdersSummary: Dict[str, Any]
    workforceSummary: Dict[str, Any]
    activeAlertsCount: int
    criticalIssuesCount: int
    alerts: List[OperationalAlert]
    rootCauses: List[RootCauseItem]
    recommendations: List[RecommendationItem]
    missingDataNotice: str


class MonitoringQueryRequest(BaseModel):
    """Natural-language or structured factory monitoring request."""
    tenantId: str = Field(default="tenant_default", description="Multi-tenant identifier.")
    query: str = Field(description="Natural language question regarding machines, production, workforce, or health.")
    targetDate: Optional[str] = Field(default=None, description="ISO date to inspect (e.g. '2026-10-31'). Defaults to latest.")
    runtimeHoursInput: Optional[Dict[str, float]] = Field(
        default=None,
        description="Optional runtime hours data {machineCode: hours} if testing machine utilization.",
    )
    includeAlerts: bool = True
    includeRecommendations: bool = True


class MonitoringQueryResponse(BaseModel):
    """Structured response containing AI answer, verified metrics, alerts, and advice."""
    success: bool = True
    agent: str = "monitoring_agent"
    tenantId: str
    asOfDate: str
    query: str
    intent: str
    answer: str
    structuredData: Dict[str, Any]
    alerts: List[OperationalAlert]
    recommendations: List[str]
    missingDataNotices: List[str]

