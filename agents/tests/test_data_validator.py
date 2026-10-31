from datetime import datetime
import pandas as pd
import pytest

from app.data.data_validator import DataValidator


def test_validate_market_prices_clean():
    df = pd.DataFrame([
        {
            "PriceObservationID": 1,
            "MaterialID": 1,
            "ObservationDate": "2026-06-01",
            "UnitPriceINR": 182.0,
            "PriceSource": "Source A",
            "VerificationStatus": "Verified",
        },
        {
            "PriceObservationID": 2,
            "MaterialID": 1,
            "ObservationDate": "2026-06-08",
            "UnitPriceINR": 185.0,
            "PriceSource": "Source A",
            "VerificationStatus": "Verified",
        },
    ])
    clean_df, warnings = DataValidator.validate_market_prices(df)
    assert len(clean_df) == 2
    assert len(warnings) == 0
    assert clean_df["MaterialID"].dtype == int


def test_validate_market_prices_missing_columns():
    df = pd.DataFrame({"MaterialID": [1], "UnitPriceINR": [100.0]})
    with pytest.raises(ValueError, match="missing required columns"):
        DataValidator.validate_market_prices(df)


def test_validate_market_prices_handles_duplicates():
    df = pd.DataFrame([
        {
            "PriceObservationID": 1,
            "MaterialID": 1,
            "ObservationDate": "2026-06-01",
            "UnitPriceINR": 182.0,
            "PriceSource": "Source A",
            "VerificationStatus": "Verified",
        },
        {
            "PriceObservationID": 2,
            "MaterialID": 1,
            "ObservationDate": "2026-06-01",
            "UnitPriceINR": 183.5,
            "PriceSource": "Source B",
            "VerificationStatus": "Verified",
        },
    ])
    clean_df, warnings = DataValidator.validate_market_prices(df)
    assert len(clean_df) == 1
    assert any("duplicate" in w.lower() for w in warnings)
    # Kept last observation
    assert clean_df.iloc[0]["UnitPriceINR"] == 183.5


def test_validate_market_prices_drops_invalid_prices():
    df = pd.DataFrame([
        {
            "PriceObservationID": 1,
            "MaterialID": 1,
            "ObservationDate": "2026-06-01",
            "UnitPriceINR": -50.0,
            "PriceSource": "Source A",
            "VerificationStatus": "Verified",
        },
        {
            "PriceObservationID": 2,
            "MaterialID": 1,
            "ObservationDate": "2026-06-08",
            "UnitPriceINR": 185.0,
            "PriceSource": "Source A",
            "VerificationStatus": "Verified",
        },
    ])
    clean_df, warnings = DataValidator.validate_market_prices(df)
    assert len(clean_df) == 1
    assert clean_df.iloc[0]["UnitPriceINR"] == 185.0
    assert any("non-positive" in w.lower() for w in warnings)


def test_validate_materials():
    df = pd.DataFrame([
        {
            "MaterialID": 1,
            "MaterialName": " Cotton Fabric  ",
            "Unit": " kg ",
            "CurrentStock": 1000,
            "CurrentUnitRateINR": 180.0,
            "PreferredSupplierID": 1,
        }
    ])
    clean_df, warnings = DataValidator.validate_materials(df)
    assert clean_df.iloc[0]["MaterialName"] == "Cotton Fabric"
    assert clean_df.iloc[0]["Unit"] == "kg"

