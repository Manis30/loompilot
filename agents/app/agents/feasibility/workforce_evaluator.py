from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger
from app.data.data_repository import DataRepository
from app.schemas.feasibility_schema import (
    FeasibilityIssue,
    FeasibilityRecommendation,
    StageWorkforceAssessment,
    WorkforceCheckResult,
)

logger = get_logger(__name__)


class WorkforceFeasibilityEvaluator:
    """
    Evaluates workforce availability, supervisor coverage, attendance rates,
    and process-specific skill sets across manufacturing departments.
    """

    SUPERVISOR_MAP = {
        "Cutting": "Suresh Kumar (Supervisor ID: 1)",
        "Stitching": "Meena Ravi (Supervisor ID: 2)",
        "Finishing": "Arun Prakash (Supervisor ID: 3)",
        "Packing": "Arun Prakash (Supervisor ID: 3)",
    }

    def __init__(self, repository: DataRepository):
        self.repository = repository

    def evaluate(
        self,
        stages: List[str],
        order_quantity: int,
    ) -> Tuple[WorkforceCheckResult, List[FeasibilityIssue], List[FeasibilityRecommendation]]:
        """
        Evaluate workforce headcount, attendance reliability, and stage assignments.
        Returns:
            - WorkforceCheckResult
            - List of FeasibilityIssues
            - List of FeasibilityRecommendations
        """
        stage_assessments: List[StageWorkforceAssessment] = []
        issues: List[FeasibilityIssue] = []
        recommendations: List[FeasibilityRecommendation] = []

        attendance_summary = self.repository.get_attendance_summary()
        overall_attendance_rate = attendance_summary.get("overallAttendanceRate", 0.901)
        shift_hours = attendance_summary.get("dailyShiftHours", 8)

        has_shortage = False

        for stage in stages:
            employees = self.repository.get_employees_by_stage(stage)
            workers_count = len(employees)
            supervisor = self.SUPERVISOR_MAP.get(stage, "Floor Supervisor")

            # Calculate daily effective labor hours
            daily_hours = round(workers_count * shift_hours * overall_attendance_rate, 1)

            # Minimum workers needed per stage
            min_workers_needed = 2 if stage in ["Cutting", "Stitching"] else 1
            is_sufficient = workers_count >= min_workers_needed

            if not is_sufficient:
                has_shortage = True
                issues.append(
                    FeasibilityIssue(
                        category="WORKFORCE_CONSTRAINT",
                        severity="HIGH",
                        resourceName=f"{stage} Department Workforce",
                        affectedResource=f"{stage} Department Workforce",
                        title=f"Insufficient qualified operators in {stage}",
                        reason=f"Only {workers_count} operator(s) assigned, below minimum requirement of {min_workers_needed}.",
                        rootCause=f"Headcount deficit in {stage}: {workers_count} active qualified operators vs {min_workers_needed} required minimum.",
                        affectedProductionStage=stage,
                        actualAvailable=f"{workers_count} qualified staff ({daily_hours} hrs/day)",
                        actualAvailableQuantity=f"{workers_count} staff",
                        required=f"Minimum {min_workers_needed} qualified operators",
                        requiredQuantity=f"{min_workers_needed} operators",
                        shortage=f"Need {min_workers_needed - workers_count} additional operator(s)",
                        shortageQuantity=f"{min_workers_needed - workers_count} operators",
                        explanation=(
                            f"The {stage} section has {workers_count} qualified employee(s). "
                            f"With an empirical attendance rate of {overall_attendance_rate * 100:.1f}%, staffing is thin."
                        ),
                        businessImpact=f"Reduces daily line speed in {stage} and increases susceptibility to absenteeism delays.",
                        recommendation=(
                            f"Coordinate with supervisor {supervisor} to reassign cross-trained operators or "
                            f"authorize scheduled overtime to safeguard production pace."
                        ),
                        recommendedAction=f"Supervisor {supervisor} reassignment or overtime authorization in {stage}.",
                        estimatedResolutionDays=1,
                        requiresAdminApproval=True,
                    )
                )
                recommendations.append(
                    FeasibilityRecommendation(
                        category="WORKFORCE",
                        priority="MEDIUM",
                        title=f"Authorize Overtime or Cross-Line Support in {stage}",
                        action=f"Assign qualified backup operators to {stage} under supervision of {supervisor}.",
                        expectedImpact=f"Boosts effective daily production hours from {daily_hours} to maintain line balance.",
                        requiresAdminApproval=True,
                    )
                )

            assessment = StageWorkforceAssessment(
                stage=stage,
                qualifiedWorkersCount=workers_count,
                primarySupervisor=supervisor,
                attendanceRatePct=round(overall_attendance_rate * 100, 1),
                dailyAvailableHours=daily_hours,
                isSufficient=is_sufficient,
                notes=(
                    f"{workers_count} skilled operator(s) active under {supervisor}. "
                    f"Generates ~{daily_hours} productive labor hours/day at {overall_attendance_rate * 100:.1f}% attendance."
                ),
            )
            stage_assessments.append(assessment)

        status = "WARNING" if has_shortage else "PASS"
        summary = (
            f"Workforce availability is validated across {len(stages)} stages with "
            f"an average factory attendance rate of {overall_attendance_rate * 100:.1f}%. "
            + ("Some stages require supervisor reassignment." if has_shortage else "Adequate staffing available for planned shifts.")
        )

        result = WorkforceCheckResult(
            status=status,
            isFeasible=not has_shortage or all(sa.qualifiedWorkersCount > 0 for sa in stage_assessments),
            summary=summary,
            overallAttendanceRatePct=round(overall_attendance_rate * 100, 1),
            dailyShiftHours=shift_hours,
            stages=stage_assessments,
        )
        return result, issues, recommendations

