"""
ml/src/models/base.py
Base forecasting interface.
All forecasting models implement:
forecast(cycle_history, day_t, baseline) -> {final_cost, interval: [low, high], p_exceed}
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Tuple, Optional
import numpy as np


class BaseForecaster(ABC):
    """Abstract base class for SO3 mid-cycle final cost forecasting models."""

    @abstractmethod
    def forecast(
        self,
        cycle_history: Dict[str, Any],
        day_t: int,
        baseline: float,
        category_baselines: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Forecasts final cycle cost given spend up to day_t.
        Returns:
            final_cost: point estimate of final cost (float)
            interval: [lower_bound, upper_bound] (80% conformal or credible interval)
            p_exceed: estimated probability that final_cost > 1.10 * baseline
        """
        pass
