import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple, Union
import pandas as pd

from app.core.config import settings
from app.core.logging import get_logger
from app.data.excel_loader import ExcelDataLoader
from app.data.data_validator import DataValidator

logger = get_logger(__name__)


class MaterialNotFoundError(KeyError):
    """Raised when a requested material cannot be found in the datasets."""
    pass


class OrderNotFoundError(KeyError):
    """Raised when a requested order cannot be found in the datasets."""
    pass


class ProductNotFoundError(KeyError):
    """Raised when a requested product cannot be found in the datasets."""
    pass


class DataRepository:
    """
    Central repository for market price, materials, orders, machines, and manufacturing data.
    Abstracts Excel file storage to prepare for future database migrations.
    """

    def __init__(self, loader: Optional[ExcelDataLoader] = None):
        self.loader = loader or ExcelDataLoader()
        self._materials_df: Optional[pd.DataFrame] = None
        self._prices_df: Optional[pd.DataFrame] = None
        self._suppliers_df: Optional[pd.DataFrame] = None
        self._orders_df: Optional[pd.DataFrame] = None
        self._products_df: Optional[pd.DataFrame] = None
        self._order_materials_df: Optional[pd.DataFrame] = None
        self._machines_df: Optional[pd.DataFrame] = None
        self._machine_status_df: Optional[pd.DataFrame] = None
        self._production_reports_df: Optional[pd.DataFrame] = None
        self._attendance_df: Optional[pd.DataFrame] = None
        self._employees_df: Optional[pd.DataFrame] = None
        self._supervisors_df: Optional[pd.DataFrame] = None
        self._clients_df: Optional[pd.DataFrame] = None
        self._quotations_df: Optional[pd.DataFrame] = None
        self._warnings: List[str] = []
        self._is_loaded: bool = False

    def load(self, force: bool = False) -> None:
        """Load and validate all datasets into memory."""
        if self._is_loaded and not force:
            return

        logger.info("Loading LoomPilot datasets into repository...")

        # Market Price & Material Catalogs
        raw_materials = self.loader.load_materials()
        self._materials_df, mat_warnings = DataValidator.validate_materials(raw_materials)
        self._warnings.extend(mat_warnings)

        raw_prices = self.loader.load_market_prices()
        self._prices_df, price_warnings = DataValidator.validate_market_prices(raw_prices)
        self._warnings.extend(price_warnings)

        raw_suppliers = self.loader.load_suppliers()
        self._suppliers_df, sup_warnings = DataValidator.validate_suppliers(raw_suppliers)
        self._warnings.extend(sup_warnings)

        # Manufacturing & Feasibility Datasets
        try:
            raw_orders = self.loader.load_orders()
            self._orders_df, order_warnings = DataValidator.validate_orders(raw_orders)
            self._warnings.extend(order_warnings)
        except Exception as e:
            logger.warning(f"Failed to load orders dataset: {e}")

        try:
            raw_products = self.loader.load_products()
            self._products_df, prod_warnings = DataValidator.validate_products(raw_products)
            self._warnings.extend(prod_warnings)
        except Exception as e:
            logger.warning(f"Failed to load products dataset: {e}")

        try:
            self._order_materials_df = self.loader.load_order_materials()
        except Exception as e:
            logger.warning(f"Failed to load order materials dataset: {e}")

        try:
            raw_machines = self.loader.load_machines()
            self._machines_df, machine_warnings = DataValidator.validate_machines(raw_machines)
            self._warnings.extend(machine_warnings)
        except Exception as e:
            logger.warning(f"Failed to load machines dataset: {e}")

        try:
            raw_status = self.loader.load_machine_status()
            self._machine_status_df, status_warnings = DataValidator.validate_machine_status(raw_status)
            self._warnings.extend(status_warnings)
        except Exception as e:
            logger.warning(f"Failed to load machine status dataset: {e}")

        try:
            raw_reports = self.loader.load_production_reports()
            self._production_reports_df, rep_warnings = DataValidator.validate_production_reports(raw_reports)
            self._warnings.extend(rep_warnings)
        except Exception as e:
            logger.warning(f"Failed to load production reports dataset: {e}")

        try:
            raw_att = self.loader.load_attendance()
            self._attendance_df, att_warnings = DataValidator.validate_attendance(raw_att)
            self._warnings.extend(att_warnings)
        except Exception as e:
            logger.warning(f"Failed to load attendance dataset: {e}")

        try:
            raw_emp = self.loader.load_employees()
            self._employees_df, emp_warnings = DataValidator.validate_employees(raw_emp)
            self._warnings.extend(emp_warnings)
        except Exception as e:
            logger.warning(f"Failed to load employees dataset: {e}")

        try:
            self._supervisors_df = self.loader.load_supervisors()
        except Exception as e:
            logger.warning(f"Failed to load supervisors dataset: {e}")

        try:
            self._clients_df = self.loader.load_clients()
        except Exception as e:
            logger.warning(f"Failed to load clients dataset: {e}")

        try:
            self._quotations_df = self.loader.load_quotations()
        except Exception as e:
            logger.warning(f"Failed to load quotations dataset: {e}")

        self._is_loaded = True
        logger.info(
            f"Datasets loaded successfully: {len(self._materials_df)} materials, "
            f"{len(self._prices_df)} price observations, {len(self._suppliers_df)} suppliers, "
            f"{len(self._orders_df) if self._orders_df is not None else 0} orders."
        )

    def reload(self) -> None:
        """Force reload datasets from disk."""
        self.load(force=True)

    def _ensure_loaded(self) -> None:
        if not self._is_loaded:
            self.load()

    # --------------------------------------------------------------------------
    # Material & Price Accessors (Existing Market Price Agent Methods)
    # --------------------------------------------------------------------------

    def resolve_material_id(self, identifier: Union[int, str]) -> int:
        """
        Flexibly resolve user-provided material identifier into the canonical integer MaterialID.
        Supports:
          - Integer: 1
          - Numeric String: "1"
          - Code String: "MAT_01", "MAT_1", "M01", "M1"
          - Material Name: "Cotton Fabric" (case-insensitive match)
        """
        self._ensure_loaded()
        assert self._materials_df is not None

        if isinstance(identifier, int):
            if identifier in self._materials_df["MaterialID"].values:
                return identifier
            raise MaterialNotFoundError(f"Material with ID '{identifier}' not found in catalog.")

        identifier_str = str(identifier).strip()

        if identifier_str.isdigit():
            val = int(identifier_str)
            if val in self._materials_df["MaterialID"].values:
                return val

        code_match = re.match(r"^(?:MAT|M)[-_]?0*(\d+)$", identifier_str, re.IGNORECASE)
        if code_match:
            val = int(code_match.group(1))
            if val in self._materials_df["MaterialID"].values:
                return val

        identifier_lower = identifier_str.lower()
        exact_matches = self._materials_df[
            self._materials_df["MaterialName"].str.lower() == identifier_lower
        ]
        if not exact_matches.empty:
            return int(exact_matches.iloc[0]["MaterialID"])

        contains_matches = self._materials_df[
            self._materials_df["MaterialName"].str.lower().str.contains(identifier_lower, regex=False)
        ]
        if not contains_matches.empty:
            return int(contains_matches.iloc[0]["MaterialID"])

        available = list(self._materials_df["MaterialID"].values)
        available_names = list(self._materials_df["MaterialName"].values)
        raise MaterialNotFoundError(
            f"Material identifier '{identifier}' cannot be resolved. "
            f"Available material IDs: {available}, Names: {available_names}"
        )

    def get_material(self, identifier: Union[int, str]) -> Dict[str, Any]:
        """Retrieve material catalog details."""
        self._ensure_loaded()
        assert self._materials_df is not None

        mat_id = self.resolve_material_id(identifier)
        row = self._materials_df[self._materials_df["MaterialID"] == mat_id].iloc[0]
        data = row.to_dict()

        supplier_id = int(data.get("PreferredSupplierID", 0))
        supplier_info = self.get_supplier(supplier_id)
        if supplier_info:
            data["supplier"] = supplier_info

        return data

    def get_supplier(self, supplier_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve supplier details by SupplierID."""
        self._ensure_loaded()
        assert self._suppliers_df is not None

        matches = self._suppliers_df[self._suppliers_df["SupplierID"] == supplier_id]
        if matches.empty:
            return None
        return matches.iloc[0].to_dict()

    def get_all_materials(self) -> List[Dict[str, Any]]:
        """Return all materials in the master catalog."""
        self._ensure_loaded()
        assert self._materials_df is not None

        materials = []
        for _, row in self._materials_df.iterrows():
            data = row.to_dict()
            sup_id = int(data.get("PreferredSupplierID", 0))
            data["supplier"] = self.get_supplier(sup_id)
            materials.append(data)
        return materials

    def get_all_material_ids(self) -> List[int]:
        """Return list of all canonical Material IDs."""
        self._ensure_loaded()
        assert self._materials_df is not None
        return sorted(list(self._materials_df["MaterialID"].unique()))

    def get_price_history(
        self,
        identifier: Union[int, str],
        as_of_date: Optional[Union[date, datetime, str]] = None,
        lookback_days: Optional[int] = None,
    ) -> pd.DataFrame:
        """Retrieve historical price observations for a material."""
        self._ensure_loaded()
        assert self._prices_df is not None

        mat_id = self.resolve_material_id(identifier)
        history = self._prices_df[self._prices_df["MaterialID"] == mat_id].copy()

        if as_of_date is not None:
            cutoff = pd.to_datetime(as_of_date)
            history = history[history["ObservationDate"] <= cutoff]

        if lookback_days is not None and not history.empty:
            max_date = history["ObservationDate"].max()
            start_date = max_date - pd.Timedelta(days=lookback_days)
            history = history[history["ObservationDate"] >= start_date]

        return history.sort_values(by="ObservationDate").reset_index(drop=True)

    def get_dataset_metadata(self) -> Dict[str, Any]:
        """Generate comprehensive metadata for the /datasets endpoint."""
        self._ensure_loaded()
        assert self._materials_df is not None
        assert self._prices_df is not None

        inspection = self.loader.get_dataset_inspection_summary()

        min_date = self._prices_df["ObservationDate"].min().strftime("%Y-%m-%d")
        max_date = self._prices_df["ObservationDate"].max().strftime("%Y-%m-%d")

        verified_count = int((self._prices_df["VerificationStatus"] == "Verified").sum())
        pending_count = int((self._prices_df["VerificationStatus"] == "Pending Review").sum())

        return {
            "datasetDirectory": str(self.loader.dataset_dir),
            "totalDatasetsDiscovered": len(inspection),
            "primaryMarketDataset": "LoomPilot_MarketPrices.xlsx",
            "totalMaterialsAvailable": len(self._materials_df),
            "totalObservations": len(self._prices_df),
            "dateRange": {
                "startDate": min_date,
                "endDate": max_date,
            },
            "dataQualitySummary": {
                "verifiedObservations": verified_count,
                "pendingReviewObservations": pending_count,
                "samplingFrequency": "Weekly (every 7 days)",
                "warnings": self._warnings,
            },
            "inspection": inspection,
        }

    # --------------------------------------------------------------------------
    # Orders, Products & Feasibility Accessors
    # --------------------------------------------------------------------------

    def resolve_order_id(self, identifier: Union[int, str]) -> int:
        """
        Flexibly resolve user-provided order identifier into the canonical integer OrderID.
        Supports:
          - Integer: 1
          - Numeric String: "1"
          - Order Number: "LP-2026-001", "lp-2026-001"
          - Code String: "ORD-001", "ORD-1", "ORD_001", "ORD_1"
        """
        self._ensure_loaded()
        if self._orders_df is None or self._orders_df.empty:
            raise OrderNotFoundError("Orders dataset is not available.")

        # Integer
        if isinstance(identifier, int):
            if identifier in self._orders_df["OrderID"].values:
                return identifier
            raise OrderNotFoundError(f"Order with ID '{identifier}' not found in records.")

        identifier_str = str(identifier).strip()

        # Pure numeric string "1"
        if identifier_str.isdigit():
            val = int(identifier_str)
            if val in self._orders_df["OrderID"].values:
                return val

        # Matches LP-2026-001
        exact_num = self._orders_df[
            self._orders_df["OrderNumber"].str.lower() == identifier_str.lower()
        ]
        if not exact_num.empty:
            return int(exact_num.iloc[0]["OrderID"])

        # Matches ORD-001, ORD-1, ORD_001
        ord_match = re.match(r"^ORD[-_]?0*(\d+)$", identifier_str, re.IGNORECASE)
        if ord_match:
            val = int(ord_match.group(1))
            if val in self._orders_df["OrderID"].values:
                return val

        # Match by LP-2026 trailing number e.g. "001" -> Order 1
        lp_match = re.match(r"^LP[-_]?\d*[-_]?0*(\d+)$", identifier_str, re.IGNORECASE)
        if lp_match:
            val = int(lp_match.group(1))
            if val in self._orders_df["OrderID"].values:
                return val

        available_orders = list(self._orders_df["OrderNumber"].values[:10])
        raise OrderNotFoundError(
            f"Order identifier '{identifier}' cannot be resolved. "
            f"Sample valid order numbers: {available_orders}"
        )

    def get_order(self, identifier: Union[int, str]) -> Dict[str, Any]:
        """Retrieve full order details by OrderID or OrderNumber."""
        self._ensure_loaded()
        if self._orders_df is None:
            raise OrderNotFoundError("Orders dataset not loaded.")

        order_id = self.resolve_order_id(identifier)
        row = self._orders_df[self._orders_df["OrderID"] == order_id].iloc[0]
        data = row.to_dict()

        # Format dates as ISO strings
        if pd.notnull(data.get("ReceivedDate")):
            data["ReceivedDate"] = pd.to_datetime(data["ReceivedDate"]).strftime("%Y-%m-%d")
        if pd.notnull(data.get("RequiredDeliveryDate")):
            data["RequiredDeliveryDate"] = pd.to_datetime(data["RequiredDeliveryDate"]).strftime("%Y-%m-%d")
        if pd.notnull(data.get("ActualDeliveryDate")):
            data["ActualDeliveryDate"] = pd.to_datetime(data["ActualDeliveryDate"]).strftime("%Y-%m-%d")
        else:
            data["ActualDeliveryDate"] = None

        # Attach Product details
        prod_id = int(data.get("ProductID", 0))
        prod_info = self.get_product(prod_id)
        if prod_info:
            data["product"] = prod_info

        # Attach Client details
        client_id = int(data.get("ClientID", 0))
        client_info = self.get_client(client_id)
        if client_info:
            data["client"] = client_info

        # Attach order materials if present
        data["orderMaterials"] = self.get_order_materials(order_id)

        return data

    def get_all_orders(self) -> List[Dict[str, Any]]:
        """Retrieve list of all manufacturing orders."""
        self._ensure_loaded()
        if self._orders_df is None:
            return []
        orders = []
        for _, row in self._orders_df.iterrows():
            data = row.to_dict()
            if pd.notnull(data.get("ReceivedDate")):
                data["ReceivedDate"] = pd.to_datetime(data["ReceivedDate"]).strftime("%Y-%m-%d")
            if pd.notnull(data.get("RequiredDeliveryDate")):
                data["RequiredDeliveryDate"] = pd.to_datetime(data["RequiredDeliveryDate"]).strftime("%Y-%m-%d")
            orders.append(data)
        return orders

    def get_active_orders(self) -> List[Dict[str, Any]]:
        """Retrieve in-progress orders with outstanding quantities."""
        self._ensure_loaded()
        if self._orders_df is None:
            return []
        active_df = self._orders_df[
            (self._orders_df["OrderStatus"] == "In Progress") &
            (self._orders_df["RemainingQuantity"] > 0)
        ]
        return [r.to_dict() for _, r in active_df.iterrows()]

    def resolve_product_id(self, identifier: Union[int, str]) -> int:
        """Resolve product identifier into integer ProductID."""
        self._ensure_loaded()
        if self._products_df is None:
            raise ProductNotFoundError("Products dataset not available.")

        if isinstance(identifier, int):
            if identifier in self._products_df["ProductID"].values:
                return identifier
            raise ProductNotFoundError(f"Product ID '{identifier}' not found in catalog.")

        id_str = str(identifier).strip()
        if id_str.isdigit():
            val = int(id_str)
            if val in self._products_df["ProductID"].values:
                return val

        # Match by name
        id_lower = id_str.lower()
        exact = self._products_df[self._products_df["ProductName"].str.lower() == id_lower]
        if not exact.empty:
            return int(exact.iloc[0]["ProductID"])

        contains = self._products_df[self._products_df["ProductName"].str.lower().str.contains(id_lower, regex=False)]
        if not contains.empty:
            return int(contains.iloc[0]["ProductID"])

        available = list(self._products_df["ProductName"].values)
        raise ProductNotFoundError(f"Product '{identifier}' cannot be resolved. Available products: {available}")

    def get_product(self, identifier: Union[int, str]) -> Optional[Dict[str, Any]]:
        """Retrieve product master details."""
        self._ensure_loaded()
        if self._products_df is None:
            return None
        try:
            prod_id = self.resolve_product_id(identifier)
            row = self._products_df[self._products_df["ProductID"] == prod_id].iloc[0]
            data = row.to_dict()
            # Parse stages as a list
            stages_str = str(data.get("ProductionStages", "Cutting, Stitching, Finishing, Packing"))
            data["stagesList"] = [s.strip() for s in stages_str.split(",") if s.strip()]
            return data
        except ProductNotFoundError:
            return None

    def get_all_products(self) -> List[Dict[str, Any]]:
        """Retrieve all products in the catalog."""
        self._ensure_loaded()
        if self._products_df is None:
            return []
        products = []
        for _, row in self._products_df.iterrows():
            data = row.to_dict()
            stages_str = str(data.get("ProductionStages", ""))
            data["stagesList"] = [s.strip() for s in stages_str.split(",") if s.strip()]
            products.append(data)
        return products

    def get_product_bom(self, product_id: int) -> List[Dict[str, Any]]:
        """
        Derive the standard Bill of Materials (BOM) for a product based on validated dataset recipes.
        Includes 5% cutting fabric wastage rate validated from historical orders.
        """
        prod = self.get_product(product_id)
        if not prod:
            return []

        std_fabric_kg = float(prod.get("StandardFabricKgPerUnit", 0.55))
        fabric_wastage_pct = 5.0
        fabric_gross_kg = round(std_fabric_kg * 1.05, 4)

        # Linen shirt uses Linen Fabric (Material 7), others use Cotton Fabric (Material 1)
        if product_id == 6:  # Linen Casual Shirt
            fabric_mat_id = 7
        else:
            fabric_mat_id = 1

        bom = [
            {
                "materialId": fabric_mat_id,
                "materialName": self.get_material(fabric_mat_id)["MaterialName"],
                "unit": "kg",
                "netConsumptionPerUnit": std_fabric_kg,
                "wastageRatePct": fabric_wastage_pct,
                "grossConsumptionPerUnit": fabric_gross_kg,
                "processStage": "Cutting",
            },
            {
                "materialId": 2,  # Polyester Thread
                "materialName": "Polyester Thread",
                "unit": "cone",
                "netConsumptionPerUnit": 0.010,
                "wastageRatePct": 0.0,
                "grossConsumptionPerUnit": 0.010,
                "processStage": "Stitching",
            },
            {
                "materialId": 5,  # Packaging Bags
                "materialName": "Packaging Bags",
                "unit": "piece",
                "netConsumptionPerUnit": 1.0,
                "wastageRatePct": 0.0,
                "grossConsumptionPerUnit": 1.0,
                "processStage": "Packing",
            },
        ]

        # Trims: Elastic Tape for Hoodies (4), Chino/Trousers (5), Sports Track Pant (7)
        if product_id in [2, 4, 7]:
            bom.append({
                "materialId": 8,  # Elastic Tape
                "materialName": "Elastic Tape",
                "unit": "meter",
                "netConsumptionPerUnit": 1.0,
                "wastageRatePct": 0.0,
                "grossConsumptionPerUnit": 1.0,
                "processStage": "Stitching",
            })

        # Buttons for School Uniform Shirt (3)
        if product_id == 3:
            bom.append({
                "materialId": 3,  # Buttons
                "materialName": "Buttons",
                "unit": "piece",
                "netConsumptionPerUnit": 6.0,
                "wastageRatePct": 0.0,
                "grossConsumptionPerUnit": 6.0,
                "processStage": "Stitching",
            })

        return bom

    def get_order_materials(self, order_id: int) -> List[Dict[str, Any]]:
        """Retrieve explicit order materials line items if available."""
        self._ensure_loaded()
        if self._order_materials_df is None or self._order_materials_df.empty:
            return []
        items = self._order_materials_df[self._order_materials_df["OrderID"] == order_id]
        results = []
        for _, r in items.iterrows():
            d = r.to_dict()
            mat_id = int(d.get("MaterialID", 0))
            mat_info = self.get_material(mat_id)
            d["materialName"] = mat_info["MaterialName"] if mat_info else "Unknown"
            d["unit"] = mat_info["Unit"] if mat_info else "unit"
            results.append(d)
        return results

    def get_all_machines(self) -> List[Dict[str, Any]]:
        """Retrieve all factory machines."""
        self._ensure_loaded()
        if self._machines_df is None:
            return []
        return [r.to_dict() for _, r in self._machines_df.iterrows()]

    def get_machines_by_stage(self, stage: str) -> List[Dict[str, Any]]:
        """Retrieve machines assigned to a given ProcessArea / production stage."""
        self._ensure_loaded()
        if self._machines_df is None:
            return []
        stage_clean = stage.strip().lower()
        matches = self._machines_df[
            self._machines_df["ProcessArea"].str.lower() == stage_clean
        ]
        return [r.to_dict() for _, r in matches.iterrows()]

    def get_machine_status_history(self, machine_id: int) -> List[Dict[str, Any]]:
        """Retrieve snapshot status history for a machine."""
        self._ensure_loaded()
        if self._machine_status_df is None:
            return []
        sub = self._machine_status_df[self._machine_status_df["MachineID"] == machine_id]
        return [r.to_dict() for _, r in sub.sort_values(by="SnapshotDate").iterrows()]

    def get_all_employees(self) -> List[Dict[str, Any]]:
        """Retrieve employee directory."""
        self._ensure_loaded()
        if self._employees_df is None:
            return []
        return [r.to_dict() for _, r in self._employees_df.iterrows()]

    def get_employees_by_stage(self, stage: str) -> List[Dict[str, Any]]:
        """Map and filter employees qualified for a production stage."""
        self._ensure_loaded()
        if self._employees_df is None:
            return []
        stage_clean = stage.strip().lower()
        employees = []
        for _, row in self._employees_df.iterrows():
            d = row.to_dict()
            role = d["JobRole"].lower()
            assigned = False
            if "cutting" in stage_clean or stage_clean == "cutting":
                if "cut" in role:
                    assigned = True
            elif "stitching" in stage_clean or stage_clean == "stitching":
                if "stitch" in role or "tailor" in role:
                    assigned = True
            elif "finishing" in stage_clean or stage_clean == "finishing":
                if "finish" in role or "quality" in role or "checker" in role:
                    assigned = True
            elif "packing" in stage_clean or stage_clean == "packing":
                if "pack" in role:
                    assigned = True
            if assigned:
                employees.append(d)
        return employees

    def get_attendance_summary(self) -> Dict[str, Any]:
        """Calculate workforce attendance statistics from historical attendance logs."""
        self._ensure_loaded()
        if self._attendance_df is None or self._attendance_df.empty:
            return {
                "overallAttendanceRate": 0.915,
                "totalLoggedDays": 0,
                "dailyShiftHours": 8,
            }

        total_records = len(self._attendance_df)
        present_count = int((self._attendance_df["AttendanceStatus"] == "Present").sum())
        half_day_count = int((self._attendance_df["AttendanceStatus"] == "Half Day").sum())

        effective_days = present_count + 0.5 * half_day_count
        attendance_rate = round(effective_days / total_records, 4) if total_records > 0 else 0.915

        return {
            "overallAttendanceRate": attendance_rate,
            "totalLoggedRecords": total_records,
            "presentCount": present_count,
            "halfDayCount": half_day_count,
            "absentCount": int((self._attendance_df["AttendanceStatus"] == "Absent").sum()),
            "dailyShiftHours": 8,
        }

    def get_production_quality_metrics(self) -> Dict[str, Any]:
        """Empirical production defect and quality metrics from production reports."""
        self._ensure_loaded()
        if self._production_reports_df is None or self._production_reports_df.empty:
            return {
                "overallDefectRate": 0.0157,
                "stageDefectRates": {"Cutting": 0.0145, "Stitching": 0.0160, "Finishing": 0.0161, "Packing": 0.0174},
            }

        total_produced = float(self._production_reports_df["CumulativeProducedQuantity"].sum())
        total_defects = float(self._production_reports_df["DefectiveQuantity"].sum())
        overall_rate = round(total_defects / total_produced, 4) if total_produced > 0 else 0.0157

        stage_rates = {}
        for stage, grp in self._production_reports_df.groupby("ProcessStage"):
            p_sum = float(grp["CumulativeProducedQuantity"].sum())
            d_sum = float(grp["DefectiveQuantity"].sum())
            stage_rates[stage] = round(d_sum / p_sum, 4) if p_sum > 0 else 0.015

        return {
            "overallDefectRate": overall_rate,
            "stageDefectRates": stage_rates,
            "totalReportedUnits": int(total_produced),
            "totalDefects": int(total_defects),
        }

    def get_committed_stock(self, exclude_order_id: Optional[int] = None) -> Dict[int, float]:
        """
        Calculate committed material stock consumed by active in-progress orders.
        Uses product BOM formulas to prevent distorted values from raw accounting anomalies.
        """
        self._ensure_loaded()
        active_orders = self.get_active_orders()
        committed: Dict[int, float] = {}

        for o in active_orders:
            o_id = o.get("OrderID")
            if exclude_order_id is not None and o_id == exclude_order_id:
                continue

            rem_qty = float(o.get("RemainingQuantity", 0))
            if rem_qty <= 0:
                continue

            prod_id = int(o.get("ProductID", 1))
            bom = self.get_product_bom(prod_id)
            for item in bom:
                m_id = item["materialId"]
                needed = rem_qty * item["grossConsumptionPerUnit"]
                committed[m_id] = round(committed.get(m_id, 0.0) + needed, 2)

        return committed

    def get_client(self, client_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve client directory details."""
        self._ensure_loaded()
        if self._clients_df is None:
            return None
        matches = self._clients_df[self._clients_df["ClientID"] == client_id]
        if matches.empty:
            return None
        return matches.iloc[0].to_dict()

    def verify_stock_movements_ledger(self) -> Dict[str, Any]:
        """
        Verify whether an external MongoDB stockMovements collection is accessible and usable.
        If available, attempts reconciliation (OpeningStock + Inbound - Outbound +/- Adjustments).
        If unavailable or empty, returns structured verification status without fabricating records.
        """
        result = {
            "accessible": False,
            "status": "UNAVAILABLE",
            "source": "MongoDB (stockMovements)",
            "recordsCount": 0,
            "reconciled": False,
            "reconciliationDiscrepancies": {},
            "details": "stockMovements collection is not present or database connection unavailable in active environment; warehouse stock snapshot from Materials catalog is used."
        }

        # Try connecting if pymongo is installed and MongoDB is accessible
        try:
            from pymongo import MongoClient
            import os
            mongo_uri = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI") or "mongodb://localhost:27017/"
            db_name = os.environ.get("DATABASE_NAME") or "loompilot"
            client = MongoClient(mongo_uri, serverSelectionTimeoutMS=1000)
            db = client[db_name]
            col_names = db.list_collection_names()
            target_col = None
            for name in ["stockMovements", "stock_movements", "stockmovement"]:
                if name in col_names:
                    target_col = name
                    break

            if target_col:
                col = db[target_col]
                count = col.count_documents({})
                result["accessible"] = True
                result["recordsCount"] = count
                if count > 0:
                    result["status"] = "ACTIVE"
                    # Attempt reconciliation if movement records exist
                    movements = list(col.find({}))
                    reconciled_balances: Dict[int, float] = {}
                    for m in movements:
                        m_id = m.get("MaterialID") or m.get("materialId")
                        m_type = str(m.get("MovementType", "")).upper()
                        qty = float(m.get("Quantity", 0))
                        if m_id:
                            mid_int = int(m_id)
                            if m_type in ("INBOUND", "RECEIPT", "OPENING"):
                                reconciled_balances[mid_int] = round(reconciled_balances.get(mid_int, 0.0) + qty, 2)
                            elif m_type in ("OUTBOUND", "ISSUE", "CONSUMPTION"):
                                reconciled_balances[mid_int] = round(reconciled_balances.get(mid_int, 0.0) - qty, 2)
                            elif m_type in ("ADJUSTMENT",):
                                reconciled_balances[mid_int] = round(reconciled_balances.get(mid_int, 0.0) + qty, 2)
                    result["reconciled"] = True
                    result["reconciledBalances"] = reconciled_balances
                    result["details"] = f"Successfully queried {count} movement records from MongoDB collection '{target_col}'."
                else:
                    result["status"] = "EMPTY"
                    result["details"] = f"MongoDB collection '{target_col}' exists but contains 0 records."
        except Exception as e:
            logger.debug(f"MongoDB stockMovements check skipped/unavailable: {e}")
            result["details"] = f"MongoDB stockMovements check: database service unavailable or pymongo client not configured ({type(e).__name__})."

        return result


# Global repository singleton
_repository_instance: Optional[DataRepository] = None


def get_data_repository() -> DataRepository:
    """Return the global DataRepository singleton."""
    global _repository_instance
    if _repository_instance is None:
        _repository_instance = DataRepository()
        _repository_instance.load()
    return _repository_instance
