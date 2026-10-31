from typing import Any, Dict, List, Tuple
import pandas as pd

from app.core.logging import get_logger

logger = get_logger(__name__)


class DataValidator:
    """Validates structural integrity, column presence, data types, and nulls in datasets."""

    REQUIRED_MARKET_PRICE_COLS = [
        "PriceObservationID",
        "MaterialID",
        "ObservationDate",
        "UnitPriceINR",
        "PriceSource",
        "VerificationStatus",
    ]

    REQUIRED_MATERIAL_COLS = [
        "MaterialID",
        "MaterialName",
        "Unit",
        "CurrentStock",
        "CurrentUnitRateINR",
        "PreferredSupplierID",
    ]

    REQUIRED_SUPPLIER_COLS = [
        "SupplierID",
        "SupplierName",
        "City",
        "LeadTimeDays",
    ]

    REQUIRED_ORDER_COLS = [
        "OrderID",
        "OrderNumber",
        "ClientID",
        "ProductID",
        "ReceivedDate",
        "RequiredDeliveryDate",
        "OrderQuantity",
        "OrderStatus",
        "ProducedQuantity",
        "RemainingQuantity",
    ]

    REQUIRED_PRODUCT_COLS = [
        "ProductID",
        "ProductName",
        "ProductionStages",
        "StandardFabricKgPerUnit",
    ]

    REQUIRED_MACHINE_COLS = [
        "MachineID",
        "MachineCode",
        "MachineType",
        "ProcessArea",
        "CapacityUnitsPerDay",
        "CurrentStatus",
    ]

    REQUIRED_MACHINE_STATUS_COLS = [
        "MachineStatusID",
        "MachineID",
        "SnapshotDate",
        "AvailabilityStatus",
        "AvailableCapacityUnitsPerDay",
    ]

    REQUIRED_PRODUCTION_REPORT_COLS = [
        "ProductionReportID",
        "OrderID",
        "ProcessStage",
        "CumulativeProducedQuantity",
        "DefectiveQuantity",
    ]

    REQUIRED_ATTENDANCE_COLS = [
        "AttendanceID",
        "EmployeeID",
        "AttendanceDate",
        "AttendanceStatus",
        "HoursWorked",
    ]

    REQUIRED_EMPLOYEE_COLS = [
        "EmployeeID",
        "EmployeeName",
        "SupervisorID",
        "JobRole",
    ]

    @classmethod
    def validate_market_prices(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate and sanitize market prices DataFrame."""
        warnings: List[str] = []

        missing_cols = [c for c in cls.REQUIRED_MARKET_PRICE_COLS if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Market prices dataset missing required columns: {missing_cols}")

        clean_df = df.copy()

        null_counts = clean_df[cls.REQUIRED_MARKET_PRICE_COLS].isnull().sum()
        for col, count in null_counts.items():
            if count > 0:
                warnings.append(f"Column '{col}' has {count} null values.")

        clean_df = clean_df.dropna(subset=["MaterialID", "ObservationDate", "UnitPriceINR"])

        clean_df["MaterialID"] = clean_df["MaterialID"].astype(int)
        clean_df["ObservationDate"] = pd.to_datetime(clean_df["ObservationDate"])
        clean_df["UnitPriceINR"] = clean_df["UnitPriceINR"].astype(float)
        clean_df["PriceSource"] = clean_df["PriceSource"].astype(str)
        clean_df["VerificationStatus"] = clean_df["VerificationStatus"].astype(str)

        invalid_prices = clean_df[clean_df["UnitPriceINR"] <= 0]
        if not invalid_prices.empty:
            warnings.append(f"Detected {len(invalid_prices)} rows with non-positive UnitPriceINR.")
            clean_df = clean_df[clean_df["UnitPriceINR"] > 0]

        duplicate_mask = clean_df.duplicated(subset=["MaterialID", "ObservationDate"], keep="last")
        dup_count = int(duplicate_mask.sum())
        if dup_count > 0:
            warnings.append(f"Found and removed {dup_count} duplicate (MaterialID, ObservationDate) records.")
            clean_df = clean_df[~duplicate_mask]

        clean_df = clean_df.sort_values(by=["MaterialID", "ObservationDate"]).reset_index(drop=True)
        return clean_df, warnings

    @classmethod
    def validate_materials(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate and sanitize materials master DataFrame."""
        warnings: List[str] = []

        missing_cols = [c for c in cls.REQUIRED_MATERIAL_COLS if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Materials dataset missing required columns: {missing_cols}")

        clean_df = df.copy()
        clean_df["MaterialID"] = clean_df["MaterialID"].astype(int)
        clean_df["MaterialName"] = clean_df["MaterialName"].astype(str).str.strip()
        clean_df["Unit"] = clean_df["Unit"].astype(str).str.strip()
        clean_df["CurrentStock"] = clean_df["CurrentStock"].astype(float)
        clean_df["CurrentUnitRateINR"] = clean_df["CurrentUnitRateINR"].astype(float)
        clean_df["PreferredSupplierID"] = clean_df["PreferredSupplierID"].astype(int)

        if clean_df["MaterialID"].duplicated().any():
            warnings.append("Duplicate MaterialIDs detected in materials master dataset.")
            clean_df = clean_df.drop_duplicates(subset=["MaterialID"], keep="first")

        return clean_df, warnings

    @classmethod
    def validate_suppliers(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate and sanitize suppliers DataFrame."""
        warnings: List[str] = []

        missing_cols = [c for c in cls.REQUIRED_SUPPLIER_COLS if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Suppliers dataset missing required columns: {missing_cols}")

        clean_df = df.copy()
        clean_df["SupplierID"] = clean_df["SupplierID"].astype(int)
        clean_df["SupplierName"] = clean_df["SupplierName"].astype(str).str.strip()
        clean_df["City"] = clean_df["City"].astype(str).str.strip()
        clean_df["LeadTimeDays"] = clean_df["LeadTimeDays"].astype(int)

        return clean_df, warnings

    @classmethod
    def validate_orders(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate and sanitize manufacturing orders DataFrame."""
        warnings: List[str] = []
        missing_cols = [c for c in cls.REQUIRED_ORDER_COLS if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Orders dataset missing required columns: {missing_cols}")

        clean_df = df.copy()
        clean_df["OrderID"] = clean_df["OrderID"].astype(int)
        clean_df["OrderNumber"] = clean_df["OrderNumber"].astype(str).str.strip()
        clean_df["ClientID"] = clean_df["ClientID"].astype(int)
        clean_df["ProductID"] = clean_df["ProductID"].astype(int)
        clean_df["ReceivedDate"] = pd.to_datetime(clean_df["ReceivedDate"])
        clean_df["RequiredDeliveryDate"] = pd.to_datetime(clean_df["RequiredDeliveryDate"])
        clean_df["OrderQuantity"] = clean_df["OrderQuantity"].astype(int)
        clean_df["OrderStatus"] = clean_df["OrderStatus"].astype(str).str.strip()
        clean_df["ProducedQuantity"] = clean_df["ProducedQuantity"].astype(int)
        clean_df["RemainingQuantity"] = clean_df["RemainingQuantity"].astype(int)

        return clean_df, warnings

    @classmethod
    def validate_products(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate and sanitize products master DataFrame."""
        warnings: List[str] = []
        missing_cols = [c for c in cls.REQUIRED_PRODUCT_COLS if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Products dataset missing required columns: {missing_cols}")

        clean_df = df.copy()
        clean_df["ProductID"] = clean_df["ProductID"].astype(int)
        clean_df["ProductName"] = clean_df["ProductName"].astype(str).str.strip()
        clean_df["ProductionStages"] = clean_df["ProductionStages"].astype(str).str.strip()
        clean_df["StandardFabricKgPerUnit"] = clean_df["StandardFabricKgPerUnit"].astype(float)

        return clean_df, warnings

    @classmethod
    def validate_machines(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate and sanitize machines master DataFrame."""
        warnings: List[str] = []
        missing_cols = [c for c in cls.REQUIRED_MACHINE_COLS if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Machines dataset missing required columns: {missing_cols}")

        clean_df = df.copy()
        clean_df["MachineID"] = clean_df["MachineID"].astype(int)
        clean_df["MachineCode"] = clean_df["MachineCode"].astype(str).str.strip()
        clean_df["MachineType"] = clean_df["MachineType"].astype(str).str.strip()
        clean_df["ProcessArea"] = clean_df["ProcessArea"].astype(str).str.strip()
        clean_df["CapacityUnitsPerDay"] = clean_df["CapacityUnitsPerDay"].astype(int)
        clean_df["CurrentStatus"] = clean_df["CurrentStatus"].astype(str).str.strip()

        return clean_df, warnings

    @classmethod
    def validate_machine_status(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate and sanitize machine status logs DataFrame."""
        warnings: List[str] = []
        missing_cols = [c for c in cls.REQUIRED_MACHINE_STATUS_COLS if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Machine status dataset missing required columns: {missing_cols}")

        clean_df = df.copy()
        clean_df["MachineStatusID"] = clean_df["MachineStatusID"].astype(int)
        clean_df["MachineID"] = clean_df["MachineID"].astype(int)
        clean_df["SnapshotDate"] = pd.to_datetime(clean_df["SnapshotDate"])
        clean_df["AvailabilityStatus"] = clean_df["AvailabilityStatus"].astype(str).str.strip()
        clean_df["AvailableCapacityUnitsPerDay"] = clean_df["AvailableCapacityUnitsPerDay"].astype(int)

        return clean_df, warnings

    @classmethod
    def validate_production_reports(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate and sanitize production reports DataFrame."""
        warnings: List[str] = []
        missing_cols = [c for c in cls.REQUIRED_PRODUCTION_REPORT_COLS if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Production reports dataset missing required columns: {missing_cols}")

        clean_df = df.copy()
        clean_df["ProductionReportID"] = clean_df["ProductionReportID"].astype(int)
        clean_df["OrderID"] = clean_df["OrderID"].astype(int)
        clean_df["ProcessStage"] = clean_df["ProcessStage"].astype(str).str.strip()
        clean_df["CumulativeProducedQuantity"] = clean_df["CumulativeProducedQuantity"].astype(int)
        clean_df["DefectiveQuantity"] = clean_df["DefectiveQuantity"].astype(int)

        return clean_df, warnings

    @classmethod
    def validate_attendance(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate and sanitize employee attendance DataFrame."""
        warnings: List[str] = []
        missing_cols = [c for c in cls.REQUIRED_ATTENDANCE_COLS if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Attendance dataset missing required columns: {missing_cols}")

        clean_df = df.copy()
        clean_df["AttendanceID"] = clean_df["AttendanceID"].astype(int)
        clean_df["EmployeeID"] = clean_df["EmployeeID"].astype(int)
        clean_df["AttendanceDate"] = pd.to_datetime(clean_df["AttendanceDate"])
        clean_df["AttendanceStatus"] = clean_df["AttendanceStatus"].astype(str).str.strip()
        clean_df["HoursWorked"] = clean_df["HoursWorked"].astype(int)

        return clean_df, warnings

    @classmethod
    def validate_employees(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate and sanitize employee directory DataFrame."""
        warnings: List[str] = []
        missing_cols = [c for c in cls.REQUIRED_EMPLOYEE_COLS if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Employees dataset missing required columns: {missing_cols}")

        clean_df = df.copy()
        clean_df["EmployeeID"] = clean_df["EmployeeID"].astype(int)
        clean_df["EmployeeName"] = clean_df["EmployeeName"].astype(str).str.strip()
        clean_df["SupervisorID"] = clean_df["SupervisorID"].astype(int)
        clean_df["JobRole"] = clean_df["JobRole"].astype(str).str.strip()

        return clean_df, warnings
