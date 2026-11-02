import math
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger
from app.data.data_repository import DataRepository
from app.schemas.quotation_schema import (
    CostComponentStatus,
    MaterialCostItem,
    MaterialsCostBreakdown,
)

logger = get_logger(__name__)


class BOMCostingService:
    """
    Calculates material consumption based on Bill of Materials (BOM)
    and fetches dynamic market prices via the Market Price Agent.
    """

    def __init__(self, repository: DataRepository):
        self.repository = repository

    def calculate_material_costs(
        self,
        product_id: int,
        order_quantity: int,
        specifications: Optional[Dict[str, Any]] = None,
    ) -> MaterialsCostBreakdown:
        """
        Derive material requirements for the product and price each material
        using the Market Price Agent.
        """
        # 1. Retrieve BOM
        bom_items = self.repository.get_product_bom(product_id)
        if not bom_items:
            logger.warning(f"No BOM found for product {product_id}")
            return MaterialsCostBreakdown(
                status=CostComponentStatus.UNAVAILABLE,
                items=[],
                totalCost=None,
                missingMaterials=[f"BOM definition missing for product ID {product_id}"],
            )

        # 2. Lazy load Market Price Agent singleton to avoid circular imports
        mp_agent = None
        mp_agent_error = None
        try:
            from app.agents.market_price.agent import get_market_price_agent
            mp_agent = get_market_price_agent()
        except Exception as e:
            logger.error(f"Failed to access Market Price Agent: {e}")
            mp_agent_error = str(e)

        cost_items: List[MaterialCostItem] = []
        missing_materials: List[str] = []
        has_incomplete = False
        total_material_cost = 0.0

        for item in bom_items:
            mat_id = int(item["materialId"])
            mat_name = str(item["materialName"])
            unit = str(item.get("unit", "unit"))
            net_consumption = float(item.get("netConsumptionPerUnit", 0.0))
            wastage_pct = float(item.get("wastageRatePct", 0.0))
            gross_consumption = float(item.get("grossConsumptionPerUnit", net_consumption))

            # Consumption formulas
            req_qty = round(order_quantity * net_consumption, 4)
            # Gross consumption already factors wastage without double-counting
            adj_qty = round(order_quantity * gross_consumption, 4)

            # Query Market Price Agent
            unit_price: Optional[float] = None
            price_date: Optional[str] = None
            price_confidence: Optional[str] = None
            price_status = "VALID"
            missing_reason: Optional[str] = None

            if mp_agent_error or mp_agent is None:
                price_status = "UNAVAILABLE"
                missing_reason = f"Market Price Agent unavailable: {mp_agent_error or 'Not initialized'}"
                has_incomplete = True
                missing_materials.append(f"{mat_name} (ID: {mat_id})")
            else:
                try:
                    price_result = mp_agent.analyze_single_material(mat_id)
                    unit_price = round(float(price_result.currentPrice), 2)
                    price_date = price_result.latestObservationDate
                    price_confidence = price_result.confidence
                except Exception as e:
                    logger.warning(f"Market Price Agent query failed for material {mat_id} ({mat_name}): {e}")
                    price_status = "UNAVAILABLE"
                    missing_reason = f"Price observation missing in market feed: {str(e)}"
                    has_incomplete = True
                    missing_materials.append(f"{mat_name} (ID: {mat_id})")

            # Calculate individual line item cost
            line_cost: Optional[float] = None
            if unit_price is not None and price_status == "VALID":
                line_cost = round(adj_qty * unit_price, 2)
                total_material_cost += line_cost
            else:
                has_incomplete = True

            cost_items.append(
                MaterialCostItem(
                    materialId=mat_id,
                    materialName=mat_name,
                    category="Fabric" if "Fabric" in mat_name else "Trim / Packaging",
                    unit=unit,
                    netConsumptionPerUnit=net_consumption,
                    wastagePercentage=wastage_pct,
                    grossConsumptionPerUnit=gross_consumption,
                    requiredQuantity=req_qty,
                    adjustedQuantity=adj_qty,
                    unitPrice=unit_price,
                    currency="INR",
                    totalCost=line_cost,
                    priceSource="Market Price Agent (Weekly Spot)",
                    priceEffectiveDate=price_date,
                    priceConfidence=price_confidence,
                    priceStatus=price_status,
                    missingReason=missing_reason,
                )
            )

        status = CostComponentStatus.INCOMPLETE if has_incomplete else CostComponentStatus.COMPLETE
        final_total = round(total_material_cost, 2) if not has_incomplete else None

        return MaterialsCostBreakdown(
            status=status,
            items=cost_items,
            totalCost=final_total,
            missingMaterials=missing_materials,
        )

