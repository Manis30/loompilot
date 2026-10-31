import pytest
from pathlib import Path
from app.data.excel_loader import ExcelDataLoader
from app.core.config import settings


def test_excel_loader_initialization():
    loader = ExcelDataLoader()
    assert loader.dataset_dir.exists()
    assert loader.dataset_dir.is_dir()


def test_excel_loader_list_available_files():
    loader = ExcelDataLoader()
    files = loader.list_available_files()
    assert len(files) >= 15
    assert "LoomPilot_MarketPrices.xlsx" in files
    assert "LoomPilot_Materials.xlsx" in files
    assert "LoomPilot_Suppliers.xlsx" in files


def test_load_market_prices_actual():
    loader = ExcelDataLoader()
    df = loader.load_market_prices()
    assert not df.empty
    assert len(df) == 198
    expected_cols = {"PriceObservationID", "MaterialID", "ObservationDate", "UnitPriceINR", "PriceSource", "VerificationStatus"}
    assert expected_cols.issubset(set(df.columns))


def test_load_materials_actual():
    loader = ExcelDataLoader()
    df = loader.load_materials()
    assert not df.empty
    assert len(df) == 9
    expected_cols = {"MaterialID", "MaterialName", "Unit", "CurrentStock", "CurrentUnitRateINR", "PreferredSupplierID"}
    assert expected_cols.issubset(set(df.columns))


def test_load_suppliers_actual():
    loader = ExcelDataLoader()
    df = loader.load_suppliers()
    assert not df.empty
    assert len(df) == 9
    expected_cols = {"SupplierID", "SupplierName", "City", "LeadTimeDays"}
    assert expected_cols.issubset(set(df.columns))


def test_file_not_found_handling():
    loader = ExcelDataLoader()
    with pytest.raises(FileNotFoundError):
        loader.load_sheet("NonExistent_File_12345.xlsx")


def test_dataset_inspection_summary():
    loader = ExcelDataLoader()
    inspection = loader.get_dataset_inspection_summary()
    assert isinstance(inspection, dict)
    assert "LoomPilot_MarketPrices.xlsx" in inspection
    sheets = inspection["LoomPilot_MarketPrices.xlsx"]
    assert len(sheets) >= 1
    assert sheets[0]["sheetName"] == "MarketPrices"
    assert sheets[0]["rowCount"] == 198

