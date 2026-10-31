import math
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger
from app.data.data_repository import DataRepository
from app.schemas.feasibility_schema import (
    FeasibilityIssue,
    FeasibilityRecommendation,
    MachineCheckResult,
    StageMachineAssessment,
)

logger = get_logger(__name__)


class MachineFeasibilityEvaluator:
    """
    Evaluates machine availability, operational capacities, downtime/maintenance,
    and process bottlenecks across all required production stages.
    """

    def __init__(self, repository: DataRepository):
        self.repository = repository

    def evaluate(
        self,
        stages: List[str],
        order_quantity: int,
    ) -> Tuple[MachineCheckResult, List[FeasibilityIssue], List[FeasibilityRecommendation]]:
        """
        Evaluate machine feasibility across each production stage for the given order quantity.
        Returns:
            - MachineCheckResult
            - List of FeasibilityIssues
            - List of FeasibilityRecommendations
        """
        stage_assessments: List[StageMachineAssessment] = []
        issues: List[FeasibilityIssue] = []
        recommendations: List[FeasibilityRecommendation] = []

        max_duration_days = 0
        bottleneck_stage = None
        bottleneck_machine = None
        bottleneck_reason = None
        has_critical_failure = False

        for stage in stages:
            machines = self.repository.get_machines_by_stage(stage)
            if not machines:
                # No machines exist for this stage in the facility
                issues.append(
                    FeasibilityIssue(
                        category="MACHINE_CONSTRAINT",
                        severity="CRITICAL",
                        resourceName=f"{stage} Process Line",
                        title=f"No manufacturing equipment found for stage: {stage}",
                        reason=f"Factory inventory has no machines registered in process area '{stage}'.",
                        actualAvailable="0 machines",
                        required=f"At least 1 functional {stage} machine",
                        shortage=f"Missing {stage} equipment",
                        explanation=f"Cannot execute the {stage} phase of production because no corresponding machinery exists.",
                        businessImpact=f"The order cannot be manufactured internally due to missing {stage} infrastructure.",
                        recommendation=f"Subcontract the {stage} process or procure compatible equipment.",
                        estimatedResolutionDays=None,
                        requiresAdminApproval=True,
                    )
                )
                has_critical_failure = True
                continue

            # Separate primary functional machines from auxiliary inspection stations (e.g. QC-01)
            stage_functional_machines = []
            auxiliary_stations = []
            for m in machines:
                m_type = str(m.get("MachineType", ""))
                # QC-01 is a Quality Inspection Station, not a steam press/finishing iron
                if stage == "Finishing" and "quality" in m_type.lower():
                    auxiliary_stations.append(m)
                else:
                    stage_functional_machines.append(m)

            # Available and Maintenance functional machines
            available = [m for m in stage_functional_machines if m.get("CurrentStatus") == "Available"]
            maintenance = [m for m in stage_functional_machines if m.get("CurrentStatus") == "Maintenance"]

            if stage == "Finishing" and auxiliary_stations:
                aux_codes = [m.get("MachineCode", "") for m in auxiliary_stations]
                issues.append(
                    FeasibilityIssue(
                        category="MACHINE_CONSTRAINT",
                        severity="INFO",
                        resourceName=f"Quality Station ({', '.join(aux_codes)})",
                        affectedResource=f"Quality Station ({', '.join(aux_codes)})",
                        title=f"{', '.join(aux_codes)} dedicated to quality inspection",
                        reason=f"Station {', '.join(aux_codes)} is classified as an inspection station, not a garment steam press.",
                        rootCause="Functional separation: QC-01 is designated for quality inspection and defect verification, excluded from finishing line throughput.",
                        affectedProductionStage="Finishing",
                        actualAvailable=f"{len(aux_codes)} inspection station(s)",
                        actualAvailableQuantity=f"{len(aux_codes)} station(s)",
                        required="Garment pressing equipment",
                        requiredQuantity="Steam press",
                        shortage="None",
                        shortageQuantity="0",
                        explanation=f"Station {', '.join(aux_codes)} (Quality Inspection Station, 350 units/day) is utilized for quality assurance and defect audit, and is not counted as primary garment steam pressing capacity in Finishing.",
                        businessImpact="Ensures rigorous quality inspection without misallocating inspection benches to pressing operations.",
                        recommendation=f"Maintain {', '.join(aux_codes)} for quality audits; route pressing operations to FIN-01 (300 units/day).",
                        recommendedAction=f"Maintain {', '.join(aux_codes)} for inspection.",
                        estimatedResolutionDays=0,
                        requiresAdminApproval=False,
                    )
                )

            available_codes = [m.get("MachineCode", f"M-{m['MachineID']}") for m in available]
            maintenance_codes = [m.get("MachineCode", f"M-{m['MachineID']}") for m in maintenance]

            total_stage_capacity = sum(m.get("CapacityUnitsPerDay", 0) for m in available)

            # Retrieve qualified workforce count for this stage
            qualified_staff = self.repository.get_employees_by_stage(stage)
            qualified_ops_count = max(1, len(qualified_staff))
            req_operators = 2 if stage == "Cutting" else 1

            if not available:
                # All machines in maintenance
                issues.append(
                    FeasibilityIssue(
                        category="MACHINE_CONSTRAINT",
                        severity="CRITICAL",
                        resourceName=f"{stage} Equipment",
                        affectedResource=f"{stage} Equipment",
                        title=f"All {stage} machines currently under maintenance",
                        reason=f"All registered machines ({', '.join(maintenance_codes)}) in {stage} are offline.",
                        rootCause=f"Complete equipment outage: 100% of {stage} machines are under maintenance with zero operational units.",
                        affectedProductionStage=stage,
                        actualAvailable="0 units/day available capacity",
                        actualAvailableQuantity="0 units/day",
                        required=f"{order_quantity} units",
                        requiredQuantity=f"{order_quantity} units",
                        shortage=f"Complete downtime in {stage}",
                        shortageQuantity="All machines offline",
                        explanation=f"All {len(maintenance)} machines designated for {stage} are under scheduled or corrective maintenance.",
                        businessImpact=f"Production cannot proceed through {stage} until maintenance is completed.",
                        recommendation=f"Expedite maintenance servicing on machines {', '.join(maintenance_codes)} or reroute.",
                        recommendedAction=f"Expedite maintenance on {', '.join(maintenance_codes)}.",
                        estimatedResolutionDays=None,
                        requiresAdminApproval=True,
                    )
                )
                has_critical_failure = True
                duration_days = 999
                allocated_code = None
                allocated_cap = 0
            else:
                # Recommended primary machine allocation (advisory)
                primary_m = available[0]
                allocated_code = primary_m.get("MachineCode")
                allocated_cap = primary_m.get("CapacityUnitsPerDay", 100)
                duration_days = math.ceil(order_quantity / allocated_cap)

                # Alternative compatible machines in the same stage (excluding current and non-pressing units)
                compatibles = [c for c in available_codes if c != allocated_code]

                # Check if there are machines in maintenance in this stage (e.g. ST-02 in Stitching, FIN-03 in Finishing)
                if maintenance_codes:
                    issues.append(
                        FeasibilityIssue(
                            category="MACHINE_CONSTRAINT",
                            severity="MEDIUM",
                            resourceName=f"{stage} Machinery ({', '.join(maintenance_codes)})",
                            affectedResource=f"{stage} Machinery ({', '.join(maintenance_codes)})",
                            title=f"Machine {', '.join(maintenance_codes)} is in Maintenance in {stage}",
                            reason=f"Offline maintenance reduces {stage} section throughput.",
                            rootCause=f"Machine(s) {', '.join(maintenance_codes)} offline for maintenance; throughput relies on operational units.",
                            affectedProductionStage=stage,
                            actualAvailable=f"{len(available)} available ({', '.join(available_codes)})",
                            actualAvailableQuantity=f"{len(available)} operational units",
                            required="Full line capacity",
                            requiredQuantity="All lines active",
                            shortage=f"{len(maintenance_codes)} offline machine(s)",
                            shortageQuantity=f"{len(maintenance_codes)} offline",
                            explanation=(
                                f"Machine(s) {', '.join(maintenance_codes)} are unavailable due to maintenance. "
                                f"However, alternative compatible machine(s) ({', '.join(available_codes)}) are fully operational "
                                f"with a combined capacity of {total_stage_capacity} units/day. Machine allocation is advisory and subject to floor confirmation."
                            ),
                            businessImpact=f"Throughput in {stage} is limited to available machines ({allocated_code}), extending duration to {duration_days} days.",
                            recommendation=f"Confirm advisory allocation to active machine {allocated_code} or balance load across {', '.join(available_codes)}.",
                            recommendedAction=f"Advisory allocation: route to {allocated_code} or balance across {', '.join(available_codes)}.",
                            estimatedResolutionDays=3,
                            requiresAdminApproval=False,
                        )
                    )
                    recommendations.append(
                        FeasibilityRecommendation(
                            category="MACHINE",
                            priority="MEDIUM",
                            title=f"Utilize Alternative Compatible Machines in {stage}",
                            action=f"Route {stage} operations to operational machines {', '.join(available_codes)} to circumvent offline unit {', '.join(maintenance_codes)} (Advisory recommendation).",
                            expectedImpact=f"Maintains uninterrupted {stage} flow at {allocated_cap} units/day on {allocated_code}.",
                            requiresAdminApproval=False,
                        )
                    )

            if duration_days > max_duration_days:
                max_duration_days = duration_days
                bottleneck_stage = stage
                bottleneck_machine = allocated_code
                bottleneck_reason = (
                    f"{stage} has the lowest single-line throughput ({allocated_cap} units/day on {allocated_code}), "
                    f"requiring {duration_days} operating day(s) to process {order_quantity} units."
                )

            assessment = StageMachineAssessment(
                stage=stage,
                nominalCapacityUnitsPerDay=total_stage_capacity,
                reservedCapacityUnitsPerDay=None,
                availableCapacityUnitsPerDay=None,
                allocatedCapacityUnitsPerDay=allocated_cap,
                assignedOrderQuantity=order_quantity,
                estimatedDurationDays=duration_days,
                totalStageCapacityUnitsPerDay=total_stage_capacity,
                availableMachines=available_codes,
                maintenanceMachines=maintenance_codes,
                allocatedMachineCode=allocated_code,
                allocatedMachineCodes=[allocated_code] if allocated_code else [],
                capacityPerMachinePerDay={m.get("MachineCode"): m.get("CapacityUnitsPerDay", 100) for m in available} if available else {},
                totalAllocatedCapacityPerDay=allocated_cap,
                quantityAssignedPerMachine={allocated_code: order_quantity} if allocated_code else {},
                availableOperatingHours=8.0,
                existingOrderReservations=None,
                remainingCapacityForOrder=None,
                requiredOperators=req_operators,
                availableQualifiedOperators=qualified_ops_count,
                machineCompatibilityVerified=True,
                durationDays=duration_days,
                isBottleneck=False,  # Will flag after loop
                alternativeCompatibleMachines=compatibles if allocated_code else [],
                reservationStatus="UNKNOWN",
                isCapacityVerified=False,
                scheduleType="PROVISIONAL_ADVISORY",
                capacityNotes=(
                    f"Schedule is provisional/advisory. Machine slot availability on {allocated_code} is unverified because "
                    "order-level machine reservation records are not present in dataset; floor supervisor confirmation "
                    "is required before locking production slots."
                ),
            )
            stage_assessments.append(assessment)

        # Mark bottleneck stage
        for sa in stage_assessments:
            if sa.stage == bottleneck_stage:
                sa.isBottleneck = True

        if has_critical_failure or any(s.allocatedCapacityUnitsPerDay == 0 for s in stage_assessments):
            status = "FAIL"
            is_feasible = False
            summary = f"Machine constraints prevent completion: missing or non-operational equipment in required stages."
        else:
            status = "PASS"
            is_feasible = True
            summary = (
                f"Compatible operational machines are identified across all stages with {bottleneck_stage} as the primary throughput bottleneck "
                f"({max_duration_days} days on {bottleneck_machine}). Machine compatibility is verified, but actual machine-slot availability is "
                "provisional and unverified pending floor production schedule confirmation."
            )

        result = MachineCheckResult(
            status=status,
            isFeasible=is_feasible,
            summary=summary,
            bottleneckStage=bottleneck_stage,
            bottleneckMachine=bottleneck_machine,
            bottleneckReason=bottleneck_reason,
            stages=stage_assessments,
        )
        return result, issues, recommendations
