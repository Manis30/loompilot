import math
from typing import List, Optional, Tuple
import numpy as np
from scipy import stats


def safe_round(value: Optional[float], decimals: int = 2) -> Optional[float]:
    """Round a float safely, returning None if value is None or NaN."""
    if value is None:
        return None
    try:
        val = float(value)
        if math.isnan(val) or math.isinf(val):
            return None
        return round(val, decimals)
    except (ValueError, TypeError):
        return None


def calculate_volatility_cv(prices: List[float]) -> float:
    """
    Calculate the Coefficient of Variation (CV) as percentage: (standard_deviation / mean) * 100.
    Measures price-level dispersion across observations.
    Returns 0.0 if prices has fewer than 2 elements or mean is near zero.
    """
    if len(prices) < 2:
        return 0.0
    arr = np.array(prices, dtype=np.float64)
    mean_val = np.mean(arr)
    if abs(mean_val) < 1e-9:
        return 0.0
    std_val = np.std(arr, ddof=1)
    cv = (std_val / mean_val) * 100.0
    return float(cv)


def calculate_return_volatility(prices: List[float], interval_days: float = 7.0) -> Tuple[float, float, List[float]]:
    """
    Calculate return-based volatility using percentage price changes between consecutive observations.
    Returns:
        (weekly_return_volatility, daily_return_volatility, returns_list)
        where weekly_return_volatility is the sample standard deviation of periodic percentage returns,
        and daily_return_volatility scales the periodic volatility to a daily basis (dividing by sqrt(interval_days)).
    """
    if len(prices) < 2:
        return 0.0, 0.0, []

    returns = [
        ((prices[i] - prices[i - 1]) / prices[i - 1]) * 100.0
        for i in range(1, len(prices))
        if abs(prices[i - 1]) > 1e-9
    ]

    if len(returns) < 2:
        return 0.0, 0.0, returns

    weekly_vol = float(np.std(returns, ddof=1))
    scale_factor = math.sqrt(max(1.0, interval_days))
    daily_vol = float(weekly_vol / scale_factor)

    return weekly_vol, daily_vol, returns


def calculate_linear_regression(x: List[float], y: List[float]) -> Tuple[float, float, float, float, float]:
    """
    Calculate ordinary least squares regression.
    Returns: (slope, intercept, r_squared, p_value, std_err)
    """
    if len(x) < 2 or len(y) < 2 or len(x) != len(y):
        return 0.0, 0.0, 0.0, 1.0, 0.0

    res = stats.linregress(x, y)
    r_squared = float(res.rvalue ** 2) if not math.isnan(res.rvalue) else 0.0
    return float(res.slope), float(res.intercept), r_squared, float(res.pvalue), float(res.stderr)


def detect_price_anomaly(prices: List[float], threshold_z: float = 2.0, min_pct_jump: float = 3.0) -> Tuple[bool, bool, float]:
    """
    Detect whether the latest price observation represents a sudden surge or sudden decline.
    Returns: (is_surge, is_decline, step_pct_change)
    """
    if len(prices) < 3:
        if len(prices) == 2:
            pct = ((prices[-1] - prices[-2]) / prices[-2]) * 100.0
            return (pct >= min_pct_jump), (pct <= -min_pct_jump), pct
        return False, False, 0.0

    # Calculate step percentage changes
    step_pcts = [((prices[i] - prices[i-1]) / prices[i-1]) * 100.0 for i in range(1, len(prices))]
    latest_pct = step_pcts[-1]
    historical_pcts = step_pcts[:-1]

    mean_step = float(np.mean(historical_pcts))
    std_step = float(np.std(historical_pcts, ddof=1)) if len(historical_pcts) > 1 else 0.0

    is_surge = False
    is_decline = False

    if std_step > 1e-6:
        z_score = (latest_pct - mean_step) / std_step
        if z_score >= threshold_z and latest_pct >= min_pct_jump:
            is_surge = True
        elif z_score <= -threshold_z and latest_pct <= -min_pct_jump:
            is_decline = True
    else:
        # If historical std is 0, use simple magnitude
        if latest_pct >= min_pct_jump:
            is_surge = True
        elif latest_pct <= -min_pct_jump:
            is_decline = True

    return is_surge, is_decline, float(latest_pct)

