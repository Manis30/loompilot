from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from app.schemas.feasibility_schema import (
    AlternativeScenario,
    MachineCheckResult,
    MaterialCheckResult,
    ProductionScheduleResult,
    WorkforceCheckResult,
)


import math
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from app.schemas.feasibility_schema import (
    AlternativeScenario,
    MachineCheckResult,
    MaterialCheckResult,
    ProductionScheduleResult,
    WorkforceCheckResult,
)
from app.agents.feasibility.production_scheduler import ProductionScheduler


class FeasibilityScenarioEngine:
    """
    Generates actionable, data-backed operational scenarios to mitigate manufacturing constraints,
    such as schedule extensions, multi-machine balancing, overtime shifts, and expedited procurement.
    Every scenario recalculates the full production schedule through ProductionScheduler.
    """

    def __init__(self):
        self.scheduler = ProductionScheduler()

    def generate_scenarios(
        self,
        evaluation_date: date,
        requested_delivery_date: Optional[date],
        order_quantity: int,
        schedule: Optional[ProductionScheduleResult],
        material_check: MaterialCheckResult,
        machine_check: MachineCheckResult,
        workforce_check: WorkforceCheckResult,
    ) -> List[AlternativeScenario]:
        """Generate realistic alternative manufacturing scenarios by recalculating complete schedules."""
        scenarios: List[AlternativeScenario] = []

        if schedule is None or not schedule.earliestFeasibleDeliveryDate:
            # When schedule is uncomputable (e.g. missing BOM or complete stage outage)
            return scenarios

        earliest_delivery = schedule.earliestFeasibleDeliveryDate
        delay = schedule.delayDays
        earliest_dt = date.fromisoformat(earliest_delivery)

        # Extract baseline stage parameters
        stage_durations = {s.stage: s.durationDays for s in machine_check.stages}
        stage_machine_codes = {s.stage: (s.allocatedMachineCode or "Equipment") for s in machine_check.stages}
        stage_capacities = {s.stage: s.allocatedCapacityUnitsPerDay for s in machine_check.stages}

        stage_material_dates: Dict[str, Optional[date]] = {}
        for stg, dt_str in material_check.stageMaterialAvailabilityDates.items():
            if dt_str:
                try:
                    stage_material_dates[stg] = date.fromisoformat(dt_str)
                except Exception:
                    stage_material_dates[stg] = evaluation_date
            else:
                stage_material_dates[stg] = evaluation_date

        bottleneck_stage = machine_check.bottleneckStage or "Stitching"

        cal_desc = "Inferred 6-Day Factory Calendar (Mon-Sat, Sun Off; derived from LoomPilot_Attendance.xlsx until official factory master calendar is configured)"

        # Scenario 1: Delivery Date Extension
        if delay > 0:
            scenarios.append(
                AlternativeScenario(
                    scenarioName="Extend Delivery Date to Earliest Feasible Date",
                    description=(
                        f"Retain full contracted order quantity ({order_quantity} units) and "
                        f"align delivery commitment with the calculated feasible date of {earliest_delivery}."
                    ),
                    changes=f"Extend delivery deadline by {delay} calendar day(s) from requested date.",
                    resolvesConstraint=True,
                    expectedDeliveryDate=earliest_delivery,
                    revisedEarliestDeliveryDate=earliest_delivery,
                    delayDays=0,
                    daysSaved=0,
                    workforceVerified=False,
                    isWorkforceConfirmed=False,
                    workforceVerificationStatus="ADVISORY (Operator shift assignments to active floor orders unverified)",
                    machineVerified=True,
                    machineCompatibilityVerified=True,
                    isMachineSlotConfirmed=False,
                    workloadAllocation={stage_machine_codes.get(bottleneck_stage, "ST-01"): order_quantity},
                    workingCalendarUsed=cal_desc,
                    remainingRisks="Requires client commercial acceptance of the amended delivery date.",
                    requiresAdminApproval=True,
                    recalculatedSchedule=schedule.model_dump(),
                )
            )

        # Scenario 2: Parallel Machine Allocation / Multi-Line Load Balancing
        if bottleneck_stage:
            for s in machine_check.stages:
                if s.stage == bottleneck_stage and len(s.availableMachines) > 1:
                    # Verify workforce availability for parallel lines
                    wf_stage = next((ws for ws in workforce_check.stages if ws.stage == s.stage), None)
                    qualified_workers = wf_stage.qualifiedWorkersCount if wf_stage else 1
                    possible_lines = min(len(s.availableMachines), max(1, qualified_workers))

                    if possible_lines > 1:
                        selected_machines = s.availableMachines[:possible_lines]
                        stage_cap_map = s.capacityPerMachinePerDay or {}
                        # Calculate exact combined capacity across allocated machines
                        # e.g. for Stitching: ST-01 (180) + ST-03 (190) + STI-04 (180) = 550 units/day
                        combined_capacity = sum(stage_cap_map.get(m, s.allocatedCapacityUnitsPerDay) for m in selected_machines)

                        # Allocate workload proportionally to machine throughput
                        workload_alloc: Dict[str, int] = {}
                        assigned_so_far = 0
                        for i, m_code in enumerate(selected_machines):
                            if i == len(selected_machines) - 1:
                                workload_alloc[m_code] = order_quantity - assigned_so_far
                            else:
                                m_cap = stage_cap_map.get(m_code, s.allocatedCapacityUnitsPerDay)
                                m_qty = round((m_cap / combined_capacity) * order_quantity)
                                workload_alloc[m_code] = m_qty
                                assigned_so_far += m_qty

                        # Max duration required across the parallel lines
                        compressed_duration = max(
                            math.ceil(workload_alloc[m] / stage_cap_map.get(m, s.allocatedCapacityUnitsPerDay))
                            for m in selected_machines
                        )
                        durations_copy = dict(stage_durations)
                        durations_copy[s.stage] = compressed_duration
                        capacities_copy = dict(stage_capacities)
                        capacities_copy[s.stage] = combined_capacity
                        stage_codes_copy = dict(stage_machine_codes)
                        stage_codes_copy[s.stage] = ", ".join(selected_machines)

                        recalculated = self.scheduler.calculate_timeline(
                            evaluation_date=evaluation_date,
                            requested_delivery_date=requested_delivery_date,
                            stage_durations=durations_copy,
                            stage_material_dates=stage_material_dates,
                            stage_machine_codes=stage_codes_copy,
                            stage_capacities=capacities_copy,
                            bottleneck_stage=bottleneck_stage,
                            notes_prefix=f"[Parallel {possible_lines}-Line ({combined_capacity} u/d)]",
                        )

                        revised_delivery = recalculated.earliestFeasibleDeliveryDate
                        revised_dt = date.fromisoformat(revised_delivery)
                        days_saved = max(0, (earliest_dt - revised_dt).days)
                        new_delay = recalculated.delayDays

                        machine_breakdown = ", ".join(
                            f"{m}: {workload_alloc[m]} units ({stage_cap_map.get(m, s.allocatedCapacityUnitsPerDay)} u/d)"
                            for m in selected_machines
                        )
                        operator_alloc = {m: "1 Operator" for m in selected_machines}

                        scenarios.append(
                            AlternativeScenario(
                                scenarioName=f"Parallel Multi-Line Processing in {bottleneck_stage}",
                                description=(
                                    f"Distribute {bottleneck_stage} workload simultaneously across "
                                    f"{possible_lines} active machines ({', '.join(selected_machines)}) with combined throughput of {combined_capacity} units/day."
                                ),
                                changes=(
                                    f"Compress {bottleneck_stage} duration from {s.durationDays} days down to "
                                    f"{compressed_duration} day(s) using parallel lines ({machine_breakdown}), saving {days_saved} calendar day(s)."
                                ),
                                resolvesConstraint=new_delay == 0,
                                expectedDeliveryDate=revised_delivery,
                                revisedEarliestDeliveryDate=revised_delivery,
                                delayDays=new_delay,
                                daysSaved=days_saved,
                                workforceVerified=False,  # Labeled advisory per operational guidelines
                                isWorkforceConfirmed=False,
                                machineVerified=True,
                                machineCompatibilityVerified=True,
                                isMachineSlotConfirmed=False,
                                workloadAllocation=workload_alloc,
                                requiredOperators=possible_lines,
                                availableQualifiedOperators=qualified_workers,
                                operatorAllocation=operator_alloc,
                                operatorCommitmentStatus="UNKNOWN (Shift/order-level operator assignment records unavailable in dataset)",
                                workforceVerificationStatus=(
                                    f"ADVISORY ({qualified_workers} qualified operators in roster, "
                                    "but shift commitments to active orders are unverified)"
                                ),
                                workingCalendarUsed=cal_desc,
                                remainingRisks=(
                                    f"Requires simultaneous operator staffing across {possible_lines} "
                                    f"{bottleneck_stage} stations under floor supervisor guidance. Staffing is advisory pending floor shift roster verification."
                                ),
                                requiresAdminApproval=True,
                                recalculatedSchedule=recalculated.model_dump(),
                            )
                        )
                    break

        # Scenario 3: Overtime / Second Shift Allocation
        if delay > 0 and workforce_check.isFeasible and bottleneck_stage in stage_durations:
            # Overtime increases daily productive hours by ~50% (8 to 12 hours)
            ot_duration = max(1, math.ceil(stage_durations[bottleneck_stage] / 1.5))
            durations_copy = dict(stage_durations)
            durations_copy[bottleneck_stage] = ot_duration

            recalculated = self.scheduler.calculate_timeline(
                evaluation_date=evaluation_date,
                requested_delivery_date=requested_delivery_date,
                stage_durations=durations_copy,
                stage_material_dates=stage_material_dates,
                stage_machine_codes=stage_machine_codes,
                stage_capacities=stage_capacities,
                bottleneck_stage=bottleneck_stage,
                notes_prefix="[Overtime Shift]",
            )

            ot_delivery = recalculated.earliestFeasibleDeliveryDate
            ot_dt = date.fromisoformat(ot_delivery)
            days_saved = max(0, (earliest_dt - ot_dt).days)
            ot_delay = recalculated.delayDays

            scenarios.append(
                AlternativeScenario(
                    scenarioName="Authorize Overtime / Extended Shift on Bottleneck Line",
                    description=(
                        f"Implement 4 hours of daily overtime or an auxiliary shift in {bottleneck_stage} "
                        "under floor supervisor supervision."
                    ),
                    changes=f"Increases daily productive hours from 8 to 12 hours, recovering {days_saved} day(s).",
                    resolvesConstraint=ot_delay == 0,
                    expectedDeliveryDate=ot_delivery,
                    revisedEarliestDeliveryDate=ot_delivery,
                    delayDays=ot_delay,
                    daysSaved=days_saved,
                    workforceVerified=False,
                    isWorkforceConfirmed=False,
                    workforceVerificationStatus="ADVISORY (Overtime shift staffing subject to floor supervisor and operator agreement)",
                    machineVerified=True,
                    machineCompatibilityVerified=True,
                    isMachineSlotConfirmed=False,
                    workloadAllocation={stage_machine_codes.get(bottleneck_stage, "ST-01"): order_quantity},
                    workingCalendarUsed=cal_desc,
                    remainingRisks="Increases labor overtime cost and requires supervisor agreement.",
                    requiresAdminApproval=True,
                    recalculatedSchedule=recalculated.model_dump(),
                )
            )

        # Scenario 4: Fast-Track / Expedited Material Procurement
        cutting_mat_dt = stage_material_dates.get("Cutting", evaluation_date) or evaluation_date
        lead_days = (cutting_mat_dt - evaluation_date).days
        if lead_days >= 2:
            # Compress transit from 4 days to 2 days (or max(1, lead_days - 2))
            expedited_lead = max(1, lead_days - 2)
            expedited_mat_dates = dict(stage_material_dates)
            expedited_mat_dates["Cutting"] = evaluation_date + timedelta(days=expedited_lead)

            recalculated = self.scheduler.calculate_timeline(
                evaluation_date=evaluation_date,
                requested_delivery_date=requested_delivery_date,
                stage_durations=stage_durations,
                stage_material_dates=expedited_mat_dates,
                stage_machine_codes=stage_machine_codes,
                stage_capacities=stage_capacities,
                bottleneck_stage=bottleneck_stage,
                notes_prefix="",
            )

            exp_delivery = recalculated.earliestFeasibleDeliveryDate
            exp_dt = date.fromisoformat(exp_delivery)
            days_saved = max(0, (earliest_dt - exp_dt).days)
            exp_delay = recalculated.delayDays

            scenarios.append(
                AlternativeScenario(
                    scenarioName="Expedited Supplier Procurement",
                    description="Negotiate express dispatch / priority logistics with raw material suppliers.",
                    changes=(
                        f"Compress procurement lead time from {lead_days} days to {expedited_lead} days, "
                        f"advancing production start by {days_saved} day(s)."
                    ),
                    resolvesConstraint=exp_delay == 0,
                    expectedDeliveryDate=exp_delivery,
                    revisedEarliestDeliveryDate=exp_delivery,
                    delayDays=exp_delay,
                    daysSaved=days_saved,
                    workforceVerified=False,
                    isWorkforceConfirmed=False,
                    workforceVerificationStatus="ADVISORY (Standard single-line operator assignment unverified against active order schedule)",
                    machineVerified=True,
                    machineCompatibilityVerified=True,
                    isMachineSlotConfirmed=False,
                    workloadAllocation={stage_machine_codes.get(bottleneck_stage, "ST-01"): order_quantity},
                    isProcurementConfirmed=False,
                    workingCalendarUsed=cal_desc,
                    remainingRisks="Unconfirmed supplier estimate: Requires commercial agreement with supplier; transit compression is subject to carrier confirmation.",
                    requiresAdminApproval=True,
                    recalculatedSchedule=recalculated.model_dump(),
                )
            )

        # Scenario 5: Split Batch / Partial Early Delivery
        if delay > 0 and order_quantity > 200:
            half_qty = order_quantity // 2
            half_durations = {stg: max(1, math.ceil(dur / 2)) for stg, dur in stage_durations.items()}

            recalculated = self.scheduler.calculate_timeline(
                evaluation_date=evaluation_date,
                requested_delivery_date=requested_delivery_date,
                stage_durations=half_durations,
                stage_material_dates=stage_material_dates,
                stage_machine_codes=stage_machine_codes,
                stage_capacities=stage_capacities,
                bottleneck_stage=bottleneck_stage,
                notes_prefix="[Batch 1 of 2]",
            )

            first_batch_delivery = recalculated.earliestFeasibleDeliveryDate
            first_batch_dt = date.fromisoformat(first_batch_delivery)
            days_saved = max(0, (earliest_dt - first_batch_dt).days)

            scenarios.append(
                AlternativeScenario(
                    scenarioName="Split Delivery (Staged Shipments)",
                    description=(
                        f"Ship an initial partial batch of {half_qty} units on {first_batch_delivery}, "
                        f"followed by the remaining {order_quantity - half_qty} units on {earliest_delivery}."
                    ),
                    changes="Splits manufacturing run into two sequential dispatch lots.",
                    resolvesConstraint=True,
                    expectedDeliveryDate=f"Batch 1: {first_batch_delivery}, Batch 2: {earliest_delivery}",
                    revisedEarliestDeliveryDate=first_batch_delivery,
                    delayDays=0,
                    daysSaved=days_saved,
                    workforceVerified=False,
                    isWorkforceConfirmed=False,
                    workforceVerificationStatus="ADVISORY (Batch split staffing unverified against active order schedule)",
                    machineVerified=True,
                    machineCompatibilityVerified=True,
                    isMachineSlotConfirmed=False,
                    workloadAllocation={stage_machine_codes.get(bottleneck_stage, "ST-01"): half_qty},
                    workingCalendarUsed=cal_desc,
                    remainingRisks="Requires client consent for split shipment and incurs two dispatch logistics legs.",
                    requiresAdminApproval=True,
                    recalculatedSchedule=recalculated.model_dump(),
                )
            )

        return scenarios

