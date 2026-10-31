from typing import List, Optional, Tuple

from app.core.logging import get_logger
from app.schemas.quotation_schema import TaxBreakdownItem

logger = get_logger(__name__)


class TaxService:
    """
    Computes statutory goods & services taxes (GST) for domestic garment & textile transactions.
    Supports split CGST/SGST or IGST based on jurisdiction rules.
    """

    @staticmethod
    def calculate_taxes(
        taxable_amount: Optional[float],
        tax_rate_percentage: Optional[float],
        is_interstate: bool = False,
        currency: str = "INR",
    ) -> Tuple[List[TaxBreakdownItem], Optional[float], Optional[float]]:
        """
        Calculate applicable taxes.
        Returns:
          - List of TaxBreakdownItems
          - Total Tax Amount (or None if taxable amount is unavailable)
          - Final Quotation Amount (taxable_amount + total_tax, or None)
        """
        if taxable_amount is None or tax_rate_percentage is None:
            return [], None, None

        base = float(taxable_amount)
        rate = float(tax_rate_percentage)

        items: List[TaxBreakdownItem] = []

        if is_interstate:
            # Single Integrated GST (IGST)
            igst_amount = round(base * (rate / 100.0), 2)
            items.append(
                TaxBreakdownItem(
                    taxType="IGST (Integrated GST)",
                    taxRatePercentage=rate,
                    taxableAmount=base,
                    taxAmount=igst_amount,
                    currency=currency,
                )
            )
            total_tax = igst_amount
        else:
            # Split Central GST (CGST) and State GST (SGST)
            half_rate = round(rate / 2.0, 2)
            cgst_amount = round(base * (half_rate / 100.0), 2)
            sgst_amount = round(base * (half_rate / 100.0), 2)
            total_tax = round(cgst_amount + sgst_amount, 2)

            items.append(
                TaxBreakdownItem(
                    taxType="CGST (Central GST)",
                    taxRatePercentage=half_rate,
                    taxableAmount=base,
                    taxAmount=cgst_amount,
                    currency=currency,
                )
            )
            items.append(
                TaxBreakdownItem(
                    taxType="SGST (State GST)",
                    taxRatePercentage=half_rate,
                    taxableAmount=base,
                    taxAmount=sgst_amount,
                    currency=currency,
                )
            )

        final_amount = round(base + total_tax, 2)
        return items, total_tax, final_amount

