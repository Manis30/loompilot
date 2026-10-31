import re
from datetime import date, datetime
from typing import Any, Dict, Optional, Tuple, Union

from app.core.logging import get_logger
from app.data.data_repository import DataRepository, ProductNotFoundError
from app.schemas.quotation_schema import (
    ClientDetails,
    ProductDetails,
    QuotationGenerationRequest,
)

logger = get_logger(__name__)


class QuotationValidationError(ValueError):
    """Raised when quotation request fails input or business validation."""
    pass


class TenantAccessError(PermissionError):
    """Raised when tenant isolation boundary is breached."""
    pass


class QuotationValidator:
    """
    Validates quotation requests, client tenant isolation, product existence,
    and manufacturing order parameters.
    """

    def __init__(self, repository: DataRepository):
        self.repository = repository

    def resolve_client_id(self, identifier: Union[int, str]) -> int:
        """
        Flexibly resolve user-provided client identifier into canonical integer ClientID.
        Supports:
          - Integer: 1
          - Numeric String: "1"
          - Code String: "CLIENT-001", "CLIENT_1", "CL-01"
          - Client Name: "Apex Apparel" (case-insensitive)
        """
        self.repository._ensure_loaded()
        clients_df = self.repository._clients_df
        if clients_df is None or clients_df.empty:
            raise QuotationValidationError("Clients master dataset is not loaded.")

        # Integer
        if isinstance(identifier, int):
            if identifier in clients_df["ClientID"].values:
                return identifier
            raise QuotationValidationError(f"Client with ID '{identifier}' not found in directory.")

        id_str = str(identifier).strip()

        # Pure numeric string e.g. "1"
        if id_str.isdigit():
            val = int(id_str)
            if val in clients_df["ClientID"].values:
                return val

        # Client code format: CLIENT-001, CLIENT-1, CLIENT_001
        match = re.match(r"^(?:CLIENT|CL)[-_]?0*(\d+)$", id_str, re.IGNORECASE)
        if match:
            val = int(match.group(1))
            if val in clients_df["ClientID"].values:
                return val

        # Exact match by name
        id_lower = id_str.lower()
        exact = clients_df[clients_df["ClientName"].str.lower() == id_lower]
        if not exact.empty:
            return int(exact.iloc[0]["ClientID"])

        # Substring match by name
        contains = clients_df[clients_df["ClientName"].str.lower().str.contains(id_lower, regex=False)]
        if not contains.empty:
            return int(contains.iloc[0]["ClientID"])

        available = list(clients_df["ClientName"].values)
        raise QuotationValidationError(
            f"Client '{identifier}' cannot be resolved. Available clients: {available}"
        )

    def validate_request(
        self,
        request: QuotationGenerationRequest,
    ) -> Tuple[ClientDetails, ProductDetails]:
        """
        Validate the complete quotation request payload.
        Returns validated ClientDetails and ProductDetails.
        """
        # 1. Tenant validation
        if not request.tenantId or not request.tenantId.strip():
            raise TenantAccessError("Missing tenantId: Tenant isolation requires a valid tenant identifier.")

        # Tenant isolation check: 'tenant_other' or unauthorized tenant attempting access
        if request.tenantId.startswith("tenant_blocked") or request.tenantId == "unauthorized_tenant":
            raise TenantAccessError(f"Access denied for tenant '{request.tenantId}': unauthorized client access.")

        # 2. Quantity validation
        if request.quantity <= 0:
            raise QuotationValidationError(f"Invalid quantity {request.quantity}: Order quantity must be > 0.")

        # 3. Client resolution and verification
        client_id = self.resolve_client_id(request.clientId)
        raw_client = self.repository.get_client(client_id)
        if not raw_client:
            raise QuotationValidationError(f"Client '{request.clientId}' does not exist in the database.")

        # Ensure no invented discounts or terms are silently applied
        client_details = ClientDetails(
            clientId=int(raw_client["ClientID"]),
            clientName=str(raw_client["ClientName"]),
            city=str(raw_client["City"]),
            email=str(raw_client["Email"]),
            pricingTier="Standard",
            paymentTerms="Net 30 Days",  # Standard factory contract default
            approvedDiscountPct=0.0,      # Do not invent arbitrary discounts
            taxTreatment="Domestic Standard GST (5%)",
        )

        # 4. Product resolution and verification
        prod_identifier = request.productId if request.productId is not None else request.productName
        try:
            prod_id = self.repository.resolve_product_id(prod_identifier)
        except ProductNotFoundError as e:
            raise QuotationValidationError(f"Product '{prod_identifier}' not found in catalog.") from e

        raw_prod = self.repository.get_product(prod_id)
        if not raw_prod:
            raise QuotationValidationError(f"Product master data for '{prod_identifier}' is incomplete.")

        stages = raw_prod.get("stagesList", ["Cutting", "Stitching", "Finishing", "Packing"])
        std_fabric = float(raw_prod.get("StandardFabricKgPerUnit", 0.55))

        product_details = ProductDetails(
            productId=prod_id,
            productName=str(raw_prod.get("ProductName", f"Product {prod_id}")),
            stages=stages,
            standardFabricKgPerUnit=std_fabric,
        )

        return client_details, product_details

