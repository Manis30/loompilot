from datetime import datetime
from typing import Any, Dict, Optional, Union
import pandas as pd
from pydantic import BaseModel

from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
from app.schemas.client_assistant_schema import CustomerProfile, NegotiatedOffer
from app.schemas.quotation_schema import QuotationDetail

logger = get_logger(__name__)


class SalesOrderResult(BaseModel):
    """Result of manufacturing sales order creation workflow."""
    success: bool
    orderId: Optional[Union[str, int]] = None
    orderNumber: Optional[str] = None
    status: str  # "CREATED", "PENDING_CONFIRMATION", "FAILED"
    errorMessage: Optional[str] = None
    createdTimestamp: Optional[str] = None


class SalesOrderService:
    """
    Orchestration service for finalizing customer-accepted quotations into manufacturing orders.
    Enforces that customer acceptance does not falsely claim production scheduling
    unless the backend sales order workflow successfully completes.
    """

    def __init__(self, repository: Optional[DataRepository] = None):
        self.repository = repository or get_data_repository()
        self._order_seq: int = 200

    def create_sales_order(
        self,
        quotation: QuotationDetail,
        offer: NegotiatedOffer,
        customer_profile: CustomerProfile,
        simulate_failure: bool = False,
    ) -> SalesOrderResult:
        """
        Execute sales-order creation workflow upon customer acceptance.
        """
        now_dt = datetime.now()
        now_iso = now_dt.isoformat()

        if simulate_failure:
            logger.warning("Simulated sales order creation failure triggered.")
            return SalesOrderResult(
                success=False,
                orderId=None,
                orderNumber=None,
                status="PENDING_CONFIRMATION",
                errorMessage="Sales order workflow could not complete immediately. Awaiting formal confirmation.",
                createdTimestamp=now_iso,
            )

        try:
            self.repository._ensure_loaded()
            self._order_seq += 1
            order_id = self._order_seq
            order_number = f"LP-2026-ORD-{order_id:03d}"

            # If orders DataFrame is loaded, persist order row
            if self.repository._orders_df is not None:
                new_row = {
                    "OrderID": order_id,
                    "OrderNumber": order_number,
                    "ClientID": int(customer_profile.customerId),
                    "ProductID": int(quotation.product.productId),
                    "ReceivedDate": pd.to_datetime(now_dt),
                    "RequiredDeliveryDate": pd.to_datetime(quotation.requestedDeliveryDate or (now_dt + pd.Timedelta(days=14))),
                    "OrderQuantity": int(offer.orderQuantity),
                    "QuotedUnitPriceINR": float(offer.revisedPricePerUnit),
                    "QuotedTotalINR": round(float(offer.revisedPricePerUnit * offer.orderQuantity), 2),
                    "OrderStatus": "Confirmed",
                    "ProducedQuantity": 0,
                    "RemainingQuantity": int(offer.orderQuantity),
                }
                new_df = pd.DataFrame([new_row])
                self.repository._orders_df = pd.concat([self.repository._orders_df, new_df], ignore_index=True)

            logger.info(
                f"Successfully created manufacturing sales order '{order_number}' (ID: {order_id}) "
                f"for Customer {customer_profile.customerId} at ₹{offer.revisedPricePerUnit:.2f}/unit."
            )
            return SalesOrderResult(
                success=True,
                orderId=order_id,
                orderNumber=order_number,
                status="CREATED",
                createdTimestamp=now_iso,
            )
        except Exception as e:
            logger.error(f"Error creating sales order: {e}", exc_info=True)
            return SalesOrderResult(
                success=False,
                orderId=None,
                orderNumber=None,
                status="FAILED",
                errorMessage=str(e),
                createdTimestamp=now_iso,
            )

