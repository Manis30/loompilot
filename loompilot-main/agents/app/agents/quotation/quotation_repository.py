from datetime import datetime
from typing import Dict, List, Optional, Tuple
import pandas as pd

from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
from app.schemas.quotation_schema import (
    QuotationDetail,
    QuotationStatus,
)

logger = get_logger(__name__)


class QuotationNotFoundError(KeyError):
    """Raised when quotation cannot be found."""
    pass


class QuotationStateTransitionError(ValueError):
    """Raised when an invalid status transition is attempted."""
    pass


class QuotationRepository:
    """
    In-memory and dataset-backed repository for manufacturing quotations.
    Provides persistence, retrieval, status lifecycle tracking, and multi-tenant isolation.
    """

    def __init__(self, data_repository: Optional[DataRepository] = None):
        self.data_repository = data_repository or get_data_repository()
        self._quotations_store: Dict[str, QuotationDetail] = {}
        self._next_quotation_seq: int = 100

    def save(self, quotation: QuotationDetail) -> QuotationDetail:
        """Persist quotation in the store."""
        self._quotations_store[quotation.quotationId] = quotation
        # Also index by quotationNumber
        self._quotations_store[quotation.quotationNumber] = quotation
        logger.info(f"Saved quotation '{quotation.quotationNumber}' (Status: {quotation.status.value})")
        return quotation

    def get(self, quotation_identifier: str, tenant_id: Optional[str] = None) -> QuotationDetail:
        """
        Retrieve quotation by quotationId or quotationNumber with tenant isolation check.
        """
        quotation = self._quotations_store.get(quotation_identifier)
        if not quotation:
            raise QuotationNotFoundError(f"Quotation '{quotation_identifier}' not found in active records.")

        if tenant_id and quotation.tenantId != tenant_id:
            logger.warning(
                f"Tenant isolation mismatch: requested tenant '{tenant_id}' cannot access quotation "
                f"'{quotation_identifier}' belonging to tenant '{quotation.tenantId}'."
            )
            raise PermissionError(f"Access denied: quotation does not belong to tenant '{tenant_id}'.")

        return quotation

    def list_quotations(
        self,
        tenant_id: Optional[str] = None,
        status: Optional[QuotationStatus] = None,
    ) -> List[QuotationDetail]:
        """
        Query quotations matching tenant and status filters.
        Deduplicates because quotations are keyed by both ID and Number.
        """
        unique_quotations = {q.quotationId: q for q in self._quotations_store.values()}
        results = list(unique_quotations.values())

        if tenant_id:
            results = [q for q in results if q.tenantId == tenant_id]

        if status:
            results = [q for q in results if q.status == status]

        return results

    def approve(
        self,
        quotation_identifier: str,
        authorized_by: str,
        approval_notes: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> QuotationDetail:
        """
        Authorize and approve a quotation.
        Only valid for quotations in READY_FOR_APPROVAL or PENDING_REVIEW status.
        """
        quotation = self.get(quotation_identifier, tenant_id=tenant_id)

        if quotation.status in (QuotationStatus.APPROVED, QuotationStatus.REJECTED):
            raise QuotationStateTransitionError(
                f"Quotation '{quotation.quotationNumber}' has already been finalized as {quotation.status.value}."
            )

        if quotation.status == QuotationStatus.PENDING_INFORMATION:
            raise QuotationStateTransitionError(
                f"Cannot approve quotation '{quotation.quotationNumber}': Required costing information is missing."
            )

        # Record approval transition
        quotation.status = QuotationStatus.APPROVED
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        record = {
            "action": "APPROVED",
            "actor": authorized_by,
            "timestamp": timestamp,
            "notes": approval_notes or "Authorized for client issuance.",
        }
        if quotation.approvalHistory is None:
            quotation.approvalHistory = []
        quotation.approvalHistory.append(record)

        self.save(quotation)
        logger.info(f"Quotation '{quotation.quotationNumber}' approved by '{authorized_by}'.")
        return quotation

    def reject(
        self,
        quotation_identifier: str,
        rejected_by: str,
        rejection_reason: str,
        tenant_id: Optional[str] = None,
    ) -> QuotationDetail:
        """
        Record authorized rejection of a quotation.
        """
        quotation = self.get(quotation_identifier, tenant_id=tenant_id)

        if quotation.status in (QuotationStatus.APPROVED, QuotationStatus.REJECTED):
            raise QuotationStateTransitionError(
                f"Quotation '{quotation.quotationNumber}' has already been finalized as {quotation.status.value}."
            )

        quotation.status = QuotationStatus.REJECTED
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        record = {
            "action": "REJECTED",
            "actor": rejected_by,
            "timestamp": timestamp,
            "reason": rejection_reason,
        }
        if quotation.approvalHistory is None:
            quotation.approvalHistory = []
        quotation.approvalHistory.append(record)

        self.save(quotation)
        logger.info(f"Quotation '{quotation.quotationNumber}' rejected by '{rejected_by}': {rejection_reason}")
        return quotation

    def generate_next_quotation_id(self) -> Tuple[str, str]:
        """Generate unique ID and readable numbering LP-QT-2026-XXX."""
        self._next_quotation_seq += 1
        seq = self._next_quotation_seq
        q_id = f"QT-{seq:03d}"
        q_num = f"LP-QT-2026-{seq:03d}"
        return q_id, q_num


_quotation_repo_singleton: Optional[QuotationRepository] = None


def get_quotation_repository() -> QuotationRepository:
    """Return the global QuotationRepository singleton."""
    global _quotation_repo_singleton
    if _quotation_repo_singleton is None:
        _quotation_repo_singleton = QuotationRepository()
    return _quotation_repo_singleton
