from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger
from app.data.data_repository import DataRepository
from app.schemas.feasibility_schema import (
    ExistingOrdersCheckResult,
    FeasibilityIssue,
)

logger = get_logger(__name__)


class CommitmentEvaluator:
    """
    Analyzes active manufacturing commitments from existing in-progress orders,
    evaluating queue load on machines, committed stock, and preventing resource conflicts.
    """

    def __init__(self, repository: DataRepository):
        self.repository = repository

    def evaluate(
        self,
        order_id: Optional[int] = None,
    ) -> Tuple[ExistingOrdersCheckResult, List[FeasibilityIssue]]:
        """
        Evaluate active order backlog and resource reservations.
        Returns:
            - ExistingOrdersCheckResult
            - List of FeasibilityIssues
        """
        active_orders = self.repository.get_active_orders()
        issues: List[FeasibilityIssue] = []

        # Filter out current order if it's already an active order
        other_active = [o for o in active_orders if o.get("OrderID") != order_id]
        total_remaining = sum(int(o.get("RemainingQuantity", 0)) for o in other_active)

        conflict_notes: List[str] = []
        if len(other_active) > 0:
            conflict_notes.append(
                f"{len(other_active)} active order(s) currently in progress with {total_remaining} remaining units."
            )

        # Check if backlog is heavy
        if total_remaining > 3000:
            conflict_notes.append(
                f"High floor backlog: {total_remaining} units currently in progress across stages. "
                "New production batches should be sequenced behind current cutting/stitching runs."
            )
            issues.append(
                FeasibilityIssue(
                    category="SCHEDULE_CONFLICT",
                    severity="MEDIUM",
                    resourceName="Factory Production Queue",
                    affectedResource="Factory Production Queue",
                    title="Active production backlog across manufacturing lines",
                    reason="Existing in-progress orders occupy floor capacity and active work-in-progress (WIP).",
                    rootCause=f"Factory floor load: {total_remaining} committed units across {len(other_active)} active orders.",
                    affectedProductionStage="Overall Line Scheduling",
                    actualAvailable=f"{len(other_active)} orders currently on floor",
                    actualAvailableQuantity=f"{len(other_active)} active orders",
                    required="Line clearance / slot scheduling",
                    requiredQuantity="Sequential slot",
                    shortage=f"{total_remaining} queued units",
                    shortageQuantity=f"{total_remaining} units",
                    explanation=(
                        f"There are {len(other_active)} active in-progress orders with {total_remaining} remaining units identified. "
                        "Actual order-level machine-slot reservations are not verified in the dataset. "
                        "The proposed order must be sequenced after confirmation of existing production commitments; "
                        "no reservation or capacity protection has been performed by the Feasibility Agent."
                    ),
                    businessImpact="Production schedule is provisional. Actual machine-slot availability requires floor confirmation against existing WIP commitments.",
                    recommendation="Confirm existing floor commitments and sequence the proposed order into verified machine slots.",
                    recommendedAction="Verify machine-slot availability and sequence behind active production runs.",
                    estimatedResolutionDays=2,
                    requiresAdminApproval=False,
                )
            )

        status = "WARNING" if issues else "PASS"
        summary = (
            f"Assessed {len(other_active)} active in-progress order(s) with {total_remaining} remaining units identified. "
            "Their actual machine-slot reservations are not verified. The proposed order must be sequenced after confirmation "
            "of existing production commitments; no reservation or capacity protection has been performed by the Feasibility Agent."
        )

        result = ExistingOrdersCheckResult(
            status=status,
            activeOrdersCount=len(other_active),
            totalCommittedUnits=total_remaining,
            summary=summary,
            conflictNotes=conflict_notes,
        )
        return result, issues

