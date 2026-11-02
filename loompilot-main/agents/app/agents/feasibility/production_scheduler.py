from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger
from app.schemas.feasibility_schema import (
    FeasibilityIssue,
    MachineCheckResult,
    MaterialCheckResult,
    ProductionScheduleResult,
    ScheduleStageItem,
    WorkforceCheckResult,
)

logger = get_logger(__name__)


class ProductionScheduler:
    """
    Constructs a dependency-respecting production timeline considering stage-aware material procurement,
    sequential stage durations, machine capacities, quality buffers, and dispatch staging.
    Calculates earliest realistic feasible delivery date and delay against requested deadline.
    """

    DISPATCH_BUFFER_DAYS = 1
    QUALITY_BUFFER_DAYS = 1

    @staticmethod
    def is_working_day(d: date) -> bool:
        """Returns True if date is a factory working day (Monday=0 ... Saturday=5; Sunday=6 is off)."""
        return d.weekday() != 6

    @staticmethod
    def ensure_working_day(d: date) -> date:
        """Advance date to Monday if it falls on Sunday (factory weekly off)."""
        if d.weekday() == 6:
            return d + timedelta(days=1)
        return d

    @classmethod
    def next_working_day(cls, d: date, allow_sunday: bool = False) -> date:
        """Returns the next calendar day that is a factory working day (skipping Sunday)."""
        cur = d + timedelta(days=1)
        while not allow_sunday and cur.weekday() == 6:
            cur += timedelta(days=1)
        return cur

    @classmethod
    def add_working_days(cls, start: date, working_days: int, allow_sunday: bool = False) -> date:
        """
        Adds working days to start date, skipping Sundays unless allow_sunday is True.
        """
        cur = start if allow_sunday else cls.ensure_working_day(start)
        days_added = 0
        while days_added < working_days:
            cur += timedelta(days=1)
            if allow_sunday or cur.weekday() != 6:
                days_added += 1
        return cur

    @classmethod
    def add_working_days_inclusive(cls, start: date, working_days: int, allow_sunday: bool = False) -> date:
        """
        Calculates the inclusive completion date for a task lasting `working_days`.
        If working_days == 1, startDate and endDate are identical.
        Prevents double-counting boundary dates across sequential production stages.
        """
        cur = start if allow_sunday else cls.ensure_working_day(start)
        days_counted = 1
        while days_counted < working_days:
            cur += timedelta(days=1)
            if allow_sunday or cur.weekday() != 6:
                days_counted += 1
        return cur

    def calculate_timeline(
        self,
        evaluation_date: date,
        requested_delivery_date: Optional[date],
        stage_durations: Dict[str, int],
        stage_material_dates: Dict[str, Optional[date]],
        stage_machine_codes: Dict[str, str],
        stage_capacities: Dict[str, int],
        bottleneck_stage: Optional[str] = None,
        notes_prefix: str = "",
        allow_sunday: bool = False,
    ) -> ProductionScheduleResult:
        """
        Calculates a complete stage-aware milestone timeline using the inferred 6-day factory calendar
        (Monday through Saturday operating days, Sunday weekly off).
        Materials must be available before the stage that consumes them.
        Stage boundary dates are discrete and non-overlapping.
        """
        stage_items: List[ScheduleStageItem] = []
        stages_sequence = ["Cutting", "Stitching", "Finishing", "Packing"]

        # Track when each stage can begin
        cutting_mat_date = stage_material_dates.get("Cutting", evaluation_date) or evaluation_date
        stitching_mat_date = stage_material_dates.get("Stitching", evaluation_date) or evaluation_date
        packing_mat_date = stage_material_dates.get("Packing", evaluation_date) or evaluation_date

        # 1. Procurement phase if Cutting materials require replenishment (Supplier transit = calendar days)
        if cutting_mat_date > evaluation_date:
            proc_lead_days = (cutting_mat_date - evaluation_date).days
            stage_items.append(
                ScheduleStageItem(
                    stage="Material Procurement (Cutting)",
                    durationDays=proc_lead_days,
                    startDate=evaluation_date.strftime("%Y-%m-%d"),
                    endDate=cutting_mat_date.strftime("%Y-%m-%d"),
                    dependency="Purchase Order Approval & Supplier Delivery",
                    notes=f"Procuring fabric required for Cutting with estimated {proc_lead_days}-day supplier transit (Calendar days).",
                )
            )
            # Advance to working day if arrival falls on Sunday
            cutting_start = self.ensure_working_day(cutting_mat_date) if not allow_sunday else cutting_mat_date
            proc_comp_str = cutting_mat_date.strftime("%Y-%m-%d")
        else:
            cutting_start = self.ensure_working_day(evaluation_date) if not allow_sunday else evaluation_date
            proc_comp_str = evaluation_date.strftime("%Y-%m-%d")

        prod_start_date = cutting_start
        total_prod_days = 0

        # Execute stages sequentially according to 6-day factory calendar
        prev_stage_end: Optional[date] = None
        prev_stage_name = "Material Procurement" if cutting_mat_date > evaluation_date else "Order Release"

        for stage_name in stages_sequence:
            duration = max(1, stage_durations.get(stage_name, 1))
            total_prod_days += duration

            # Stage-aware material arrival constraint and discrete sequential handover
            if prev_stage_end is None:
                earliest_possible = cutting_start
            else:
                earliest_possible = self.next_working_day(prev_stage_end, allow_sunday=allow_sunday)

            if stage_name == "Cutting":
                raw_start = max(earliest_possible, self.ensure_working_day(cutting_mat_date))
            elif stage_name == "Stitching":
                raw_start = max(earliest_possible, self.ensure_working_day(stitching_mat_date))
            elif stage_name == "Packing":
                raw_start = max(earliest_possible, self.ensure_working_day(packing_mat_date))
            else:
                raw_start = earliest_possible

            s_start = raw_start if allow_sunday else self.ensure_working_day(raw_start)

            # Stage notes
            m_code = stage_machine_codes.get(stage_name, 'Assigned Equipment')
            m_cap = stage_capacities.get(stage_name, 100)
            stage_notes = f"Processed on {m_code} ({m_cap} units/day)."
            if prev_stage_end is not None and s_start > self.next_working_day(prev_stage_end, allow_sunday=allow_sunday):
                wait_days = (s_start - prev_stage_end).days
                stage_notes += f" Waited {wait_days} day(s) for stage materials to arrive."

            if notes_prefix and (bottleneck_stage is None or stage_name == bottleneck_stage):
                stage_notes = f"{notes_prefix} {stage_notes}"

            s_end = self.add_working_days_inclusive(s_start, duration, allow_sunday=allow_sunday)
            stage_items.append(
                ScheduleStageItem(
                    stage=stage_name,
                    durationDays=duration,
                    startDate=s_start.strftime("%Y-%m-%d"),
                    endDate=s_end.strftime("%Y-%m-%d"),
                    dependency=f"Completion of {prev_stage_name}" + (f" & {stage_name} Material Delivery" if s_start > earliest_possible else ""),
                    notes=stage_notes,
                )
            )
            prev_stage_end = s_end
            prev_stage_name = stage_name

        prod_completion_date = prev_stage_end or cutting_start

        # Phase: Quality & Inspection Buffer (1 working day)
        q_start = self.next_working_day(prod_completion_date, allow_sunday=allow_sunday)
        q_end = self.add_working_days_inclusive(q_start, self.QUALITY_BUFFER_DAYS, allow_sunday=allow_sunday)
        stage_items.append(
            ScheduleStageItem(
                stage="Quality & Defect Buffer",
                durationDays=self.QUALITY_BUFFER_DAYS,
                startDate=q_start.strftime("%Y-%m-%d"),
                endDate=q_end.strftime("%Y-%m-%d"),
                dependency="Packing Stage Completion",
                notes="Quality inspection buffer incorporating empirical ~1.57% historical defect rework allowance.",
            )
        )

        # Phase: Dispatch Staging Buffer (1 working day)
        d_start = self.next_working_day(q_end, allow_sunday=allow_sunday)
        d_end = self.add_working_days_inclusive(d_start, self.DISPATCH_BUFFER_DAYS, allow_sunday=allow_sunday)
        stage_items.append(
            ScheduleStageItem(
                stage="Dispatch & Logistics Staging",
                durationDays=self.DISPATCH_BUFFER_DAYS,
                startDate=d_start.strftime("%Y-%m-%d"),
                endDate=d_end.strftime("%Y-%m-%d"),
                dependency="Quality Sign-off",
                notes="Final packaging, carton staging, and client dispatch preparation.",
            )
        )

        earliest_delivery_date = d_end
        earliest_delivery_str = earliest_delivery_date.strftime("%Y-%m-%d")
        total_cycle_days = (earliest_delivery_date - evaluation_date).days

        # Delay calculation: delayDays = max(0, earliestFeasibleDeliveryDate - requestedDeliveryDate)
        delay_days = 0
        req_date_str = requested_delivery_date.strftime("%Y-%m-%d") if requested_delivery_date else None
        if requested_delivery_date is not None:
            delay_days = max(0, (earliest_delivery_date - requested_delivery_date).days)

        return ProductionScheduleResult(
            evaluationDate=evaluation_date.strftime("%Y-%m-%d"),
            procurementCompletionDate=proc_comp_str,
            estimatedProductionStartDate=prod_start_date.strftime("%Y-%m-%d"),
            estimatedProductionCompletionDate=prod_completion_date.strftime("%Y-%m-%d"),
            earliestFeasibleDeliveryDate=earliest_delivery_str,
            requestedDeliveryDate=req_date_str,
            delayDays=delay_days,
            totalProductionDurationDays=total_prod_days,
            totalCycleDays=total_cycle_days,
            dispatchBufferDays=self.DISPATCH_BUFFER_DAYS,
            qualityBufferDays=self.QUALITY_BUFFER_DAYS,
            stageBreakdown=stage_items,
            scheduleBottleneck=bottleneck_stage,
            scheduleType="PROVISIONAL_ADVISORY",
            machineSlotConfirmationRequired=True,
            workingCalendarDescription="Inferred 6-Day Factory Calendar (Mon-Sat, Sun Off; derived from LoomPilot_Attendance.xlsx until official factory master calendar is configured)",
        )

    def calculate_schedule(
        self,
        evaluation_date: date,
        requested_delivery_date: Optional[date],
        material_check: MaterialCheckResult,
        machine_check: MachineCheckResult,
        workforce_check: WorkforceCheckResult,
    ) -> Tuple[Optional[ProductionScheduleResult], str, int, Optional[FeasibilityIssue]]:
        """
        Calculate production schedule.
        Returns:
            - ProductionScheduleResult (or None if missing information)
            - assessment_status: FEASIBLE, CONDITIONALLY_FEASIBLE, NOT_FEASIBLE, NEEDS_INFORMATION
            - delay_days: int
            - schedule_issue: Optional[FeasibilityIssue]
        """
        # 1. Check for missing information (BOM or product data)
        if material_check.status == "INSUFFICIENT_DATA" or not machine_check.stages:
            return None, "NEEDS_INFORMATION", 0, None

        # 2. Check for hard impossibilities (e.g. complete equipment failure with no available machines)
        if not machine_check.isFeasible and any(s.totalStageCapacityUnitsPerDay == 0 for s in machine_check.stages):
            issue = FeasibilityIssue(
                category="MACHINE_CONSTRAINT",
                severity="CRITICAL",
                resourceName="Manufacturing Line",
                affectedResource="Manufacturing Line",
                title="Manufacturing cannot be scheduled due to offline stage equipment",
                reason="One or more critical production stages have zero operational machines.",
                rootCause="All registered machinery in required process stage is in Maintenance status with zero available backup capacity.",
                affectedProductionStage=machine_check.bottleneckStage or "Assembly",
                actualAvailable="0 units/day capacity",
                actualAvailableQuantity="0 units/day",
                required="Functional production stage",
                requiredQuantity="At least 1 operational machine",
                shortage="Complete stage outage",
                shortageQuantity="All machines offline",
                explanation="No functional machines are available to complete all mandatory production stages.",
                businessImpact="Order cannot be manufactured internally under current equipment state.",
                recommendation="Restore machinery or arrange third-party contract manufacturing.",
                recommendedAction="Expedite maintenance restoration or subcontract affected stage.",
                estimatedResolutionDays=None,
                requiresAdminApproval=True,
            )
            return None, "NOT_FEASIBLE", 0, issue

        # 3. Check for unresolvable material shortages (shortage without supplier)
        if material_check.status == "FAIL":
            issue = FeasibilityIssue(
                category="MATERIAL_SHORTAGE",
                severity="CRITICAL",
                resourceName="Raw Materials",
                affectedResource="Raw Materials",
                title="Manufacturing cannot be scheduled due to unresolvable material shortage",
                reason="Material shortage exists with no registered supplier lead time.",
                rootCause="Missing catalog supplier mapping prevents calculating replenishment arrival date.",
                affectedProductionStage="Procurement",
                actualAvailable="0 unallocated stock",
                actualAvailableQuantity="0",
                required="Verified supplier with lead times",
                requiredQuantity="1 active supplier",
                shortage="Unresolvable material shortage",
                shortageQuantity="Unknown lead time",
                explanation="One or more required BOM materials cannot be procured because no preferred supplier is listed.",
                businessImpact="Production schedule cannot be computed reliably without supplier delivery dates.",
                recommendation="Register and approve a qualified supplier with contractual lead times.",
                recommendedAction="Onboard qualified material supplier.",
                estimatedResolutionDays=None,
                requiresAdminApproval=True,
            )
            return None, "NOT_FEASIBLE", 0, issue

        # Prepare stage maps
        stage_durations: Dict[str, int] = {}
        stage_machine_codes: Dict[str, str] = {}
        stage_capacities: Dict[str, int] = {}

        for sa in machine_check.stages:
            stage_durations[sa.stage] = sa.durationDays
            stage_machine_codes[sa.stage] = sa.allocatedMachineCode or "Equipment"
            stage_capacities[sa.stage] = sa.allocatedCapacityUnitsPerDay

        # Parse stage material availability dates
        stage_material_dates: Dict[str, Optional[date]] = {}
        for stg, date_str in material_check.stageMaterialAvailabilityDates.items():
            if date_str:
                try:
                    stage_material_dates[stg] = date.fromisoformat(date_str)
                except Exception:
                    stage_material_dates[stg] = evaluation_date
            else:
                stage_material_dates[stg] = evaluation_date

        # Calculate stage-aware timeline
        result = self.calculate_timeline(
            evaluation_date=evaluation_date,
            requested_delivery_date=requested_delivery_date,
            stage_durations=stage_durations,
            stage_material_dates=stage_material_dates,
            stage_machine_codes=stage_machine_codes,
            stage_capacities=stage_capacities,
            bottleneck_stage=machine_check.bottleneckStage,
        )

        earliest_delivery_date = date.fromisoformat(result.earliestFeasibleDeliveryDate)
        delay_days = result.delayDays
        earliest_delivery_str = result.earliestFeasibleDeliveryDate
        req_date_str = result.requestedDeliveryDate
        total_cycle_days = result.totalCycleDays

        schedule_issue = None
        if requested_delivery_date is not None and delay_days > 0:
            schedule_issue = FeasibilityIssue(
                category="SCHEDULE_CONFLICT",
                severity="HIGH",
                resourceName="Delivery Commitment",
                affectedResource="Delivery Commitment",
                title="Requested delivery date cannot be achieved with standard schedule",
                reason="Total required cycle time exceeds available days before the requested deadline.",
                rootCause=f"Cumulative production and procurement cycle ({total_cycle_days} days) exceeds client requested window ({(requested_delivery_date - evaluation_date).days} days).",
                affectedProductionStage=machine_check.bottleneckStage or "Overall Schedule",
                actualAvailable=f"Earliest feasible delivery: {earliest_delivery_str} ({total_cycle_days} days)",
                actualAvailableQuantity=f"{total_cycle_days} days",
                required=f"Requested delivery: {req_date_str} ({(requested_delivery_date - evaluation_date).days} days available)",
                requiredQuantity=f"{(requested_delivery_date - evaluation_date).days} days",
                shortage=f"Schedule deficit of {delay_days} calendar day(s)",
                shortageQuantity=f"{delay_days} days",
                explanation=(
                    f"The requested delivery date ({req_date_str}) allows {(requested_delivery_date - evaluation_date).days} days. "
                    f"However, cumulative required lead time is {total_cycle_days} days (including stage-aware procurement, "
                    f"{result.totalProductionDurationDays} days production, and {self.QUALITY_BUFFER_DAYS + self.DISPATCH_BUFFER_DAYS} days quality/dispatch buffer). "
                    f"Earliest feasible delivery is {earliest_delivery_str} ({delay_days} days delay)."
                ),
                businessImpact=f"Committing to {req_date_str} risks client SLA penalty and breach of contract.",
                recommendation=(
                    f"Propose revised delivery date of {earliest_delivery_str} to client, or fast-track procurement and "
                    "authorize overtime on the bottleneck line to compress cycle time."
                ),
                recommendedAction=f"Propose revised delivery date of {earliest_delivery_str} or authorize line compression.",
                estimatedResolutionDays=delay_days,
                requiresAdminApproval=True,
            )

        # Classification Rules:
        # FEASIBLE: Requested delivery date can be met using currently available resources without unresolved prerequisites.
        # CONDITIONALLY_FEASIBLE: Requested delivery date can be met after explicitly identified procurement, scheduling, resource allocation, or approval actions.
        # NOT_FEASIBLE: Delivery cannot be achieved under the evaluated constraints.
        # NEEDS_INFORMATION: Critical information is missing or insufficient to calculate a reliable schedule.
        has_prerequisites = (
            material_check.shortagesCount > 0
            or material_check.totalExistingCommitmentDeficit > 0
            or not machine_check.isFeasible
            or any(m.status == "WARNING" for m in [material_check, machine_check, workforce_check])
        )

        if delay_days > 90:
            status = "NOT_FEASIBLE"
        elif delay_days > 0:
            status = "CONDITIONALLY_FEASIBLE"
        elif has_prerequisites:
            status = "CONDITIONALLY_FEASIBLE"
        else:
            status = "FEASIBLE"

        return result, status, delay_days, schedule_issue

