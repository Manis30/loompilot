import pytest
from app.data.data_repository import DataRepository, MaterialNotFoundError


def test_repository_load(real_repository: DataRepository):
    assert real_repository._is_loaded
    materials = real_repository.get_all_materials()
    assert len(materials) == 9
    assert len(real_repository.get_all_material_ids()) == 9


def test_resolve_material_id(real_repository: DataRepository):
    # Numeric
    assert real_repository.resolve_material_id(1) == 1
    assert real_repository.resolve_material_id("1") == 1

    # Code pattern
    assert real_repository.resolve_material_id("MAT_01") == 1
    assert real_repository.resolve_material_id("MAT_1") == 1
    assert real_repository.resolve_material_id("MAT_07") == 7

    # Name matching
    assert real_repository.resolve_material_id("Cotton Fabric") == 1
    assert real_repository.resolve_material_id("cotton fabric") == 1
    assert real_repository.resolve_material_id("Linen Fabric") == 7


def test_resolve_material_id_invalid(real_repository: DataRepository):
    with pytest.raises(MaterialNotFoundError):
        real_repository.resolve_material_id(999)

    with pytest.raises(MaterialNotFoundError):
        real_repository.resolve_material_id("NonExistentMaterialXYZ")


def test_get_material(real_repository: DataRepository):
    mat = real_repository.get_material(1)
    assert mat["MaterialID"] == 1
    assert mat["MaterialName"] == "Cotton Fabric"
    assert mat["Unit"] == "kg"
    assert "supplier" in mat
    assert mat["supplier"]["SupplierName"] == "South Loom Supplies"


def test_get_price_history(real_repository: DataRepository):
    history = real_repository.get_price_history(1)
    assert len(history) == 22
    assert "UnitPriceINR" in history.columns
    assert "ObservationDate" in history.columns
    # Check chronologically sorted
    assert history["ObservationDate"].is_monotonic_increasing


def test_get_price_history_as_of_date(real_repository: DataRepository):
    # Filter to mid-point
    history = real_repository.get_price_history(1, as_of_date="2026-07-27")
    assert len(history) == 9
    assert history["ObservationDate"].max().strftime("%Y-%m-%d") == "2026-07-27"


def test_get_dataset_metadata(real_repository: DataRepository):
    meta = real_repository.get_dataset_metadata()
    assert meta["totalMaterialsAvailable"] == 9
    assert meta["totalObservations"] == 198
    assert meta["primaryMarketDataset"] == "LoomPilot_MarketPrices.xlsx"
    assert meta["dateRange"]["startDate"] == "2026-06-01"
    assert meta["dateRange"]["endDate"] == "2026-10-26"

