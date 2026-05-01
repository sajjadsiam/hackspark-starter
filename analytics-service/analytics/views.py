"""
Analytics Service Views
Implements: P1 (status), P11 (peak-window), P13 (surge-days), P14 (recommendations)
"""
import re
import heapq
import calendar
from datetime import date, timedelta, datetime
from collections import defaultdict

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as http_status

from . import central_api


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_month(month_str):
    """Returns (year, month) or None."""
    if not month_str or not re.match(r'^\d{4}-\d{2}$', month_str):
        return None
    y, m = int(month_str[:4]), int(month_str[5:7])
    if not (1 <= m <= 12):
        return None
    return y, m


def months_between(from_ym, to_ym):
    """Number of months between two (year, month) tuples (inclusive)."""
    return (to_ym[0] - from_ym[0]) * 12 + (to_ym[1] - from_ym[1])


def build_full_date_map(from_date, to_date, stats_dict):
    """
    Build an ordered list of (date_str, count) for every calendar day
    in [from_date, to_date], filling missing dates with 0.
    """
    result = []
    current = from_date
    while current <= to_date:
        d_str = str(current)
        result.append((d_str, stats_dict.get(d_str, 0)))
        current += timedelta(days=1)
    return result


# ── Views ─────────────────────────────────────────────────────────────────────

class StatusView(APIView):
    def get(self, request):
        return Response({"service": "analytics-service", "status": "OK"})


class PeakWindowView(APIView):
    """
    P11: The Seven-Day Rush
    Sliding window O(n) approach — no inner-loop sum recalculation.
    """

    def get(self, request):
        from_str = request.query_params.get('from')
        to_str = request.query_params.get('to')

        if not from_str or not to_str:
            return Response({"error": "'from' and 'to' are required."}, http_status.HTTP_400_BAD_REQUEST)

        from_ym = parse_month(from_str)
        to_ym = parse_month(to_str)

        if not from_ym:
            return Response({"error": f"Invalid 'from': '{from_str}'. Use YYYY-MM."}, http_status.HTTP_400_BAD_REQUEST)
        if not to_ym:
            return Response({"error": f"Invalid 'to': '{to_str}'. Use YYYY-MM."}, http_status.HTTP_400_BAD_REQUEST)
        if from_ym > to_ym:
            return Response({"error": "'from' must not be after 'to'."}, http_status.HTTP_400_BAD_REQUEST)
        if months_between(from_ym, to_ym) > 11:
            return Response({"error": "Max range is 12 months."}, http_status.HTTP_400_BAD_REQUEST)

        # Build date range
        from_date = date(from_ym[0], from_ym[1], 1)
        to_y, to_m = to_ym
        last_day = calendar.monthrange(to_y, to_m)[1]
        to_date = date(to_y, to_m, last_day)

        total_days = (to_date - from_date).days + 1
        if total_days < 7:
            return Response({"error": "Not enough data for a 7-day window (need at least 7 days)."}, http_status.HTTP_400_BAD_REQUEST)

        # Fetch stats
        stats_dict = central_api.get_all_rentals_stats_range(from_str, to_str)

        # Fill all days with counts (0 if missing)
        daily = build_full_date_map(from_date, to_date, stats_dict)
        counts = [c for _, c in daily]
        dates = [d for d, _ in daily]
        n = len(counts)

        # Sliding window of size 7 — O(n)
        # Initialize first window
        window_sum = sum(counts[:7])
        best_sum = window_sum
        best_start = 0

        for i in range(1, n - 6):
            window_sum = window_sum - counts[i - 1] + counts[i + 6]
            if window_sum > best_sum:
                best_sum = window_sum
                best_start = i

        return Response({
            "from": from_str,
            "to": to_str,
            "peakWindow": {
                "from": dates[best_start],
                "to": dates[best_start + 6],
                "totalRentals": best_sum,
            }
        })


class SurgeDaysView(APIView):
    """
    P13: Chasing the Surge
    Monotonic stack approach — O(n), no nested loop.
    For each day, finds the next day with strictly higher count.
    """

    def get(self, request):
        month_str = request.query_params.get('month')

        if not month_str or not re.match(r'^\d{4}-\d{2}$', month_str):
            return Response({"error": "Invalid 'month'. Use YYYY-MM."}, http_status.HTTP_400_BAD_REQUEST)

        month_ym = parse_month(month_str)
        if not month_ym:
            return Response({"error": "Invalid 'month'."}, http_status.HTTP_400_BAD_REQUEST)

        m_y, m_m = month_ym
        last_day = calendar.monthrange(m_y, m_m)[1]
        from_date = date(m_y, m_m, 1)
        to_date = date(m_y, m_m, last_day)

        # Fetch stats for this month
        status_code, data = central_api.get_rentals_stats_by_date(month_str)
        if status_code != 200:
            return Response({"error": "Failed to fetch rental stats."}, http_status.HTTP_502_BAD_GATEWAY)

        stats_dict = {item['date']: item['count'] for item in data.get('data', [])}

        # Build full daily list with 0-fill for missing dates
        daily = build_full_date_map(from_date, to_date, stats_dict)
        n = len(daily)

        # Monotonic stack (decreasing): O(n) single left-to-right pass
        # Stack holds indices waiting to find their "next surge"
        next_higher = [None] * n
        stack = []  # indices

        for i in range(n):
            date_str, count = daily[i]
            # Pop all indices whose count is less than current
            while stack and daily[stack[-1]][1] < count:
                idx = stack.pop()
                next_higher[idx] = i
            stack.append(i)

        # Build result
        result_data = []
        for i, (d_str, cnt) in enumerate(daily):
            nh = next_higher[i]
            if nh is not None:
                next_date = daily[nh][0]
                days_until = nh - i
            else:
                next_date = None
                days_until = None

            result_data.append({
                "date": d_str,
                "count": cnt,
                "nextSurgeDate": next_date,
                "daysUntil": days_until,
            })

        return Response({
            "month": month_str,
            "data": result_data,
        })


class RecommendationsView(APIView):
    """
    P14: What's In Season?
    Finds products most frequently rented in a ±7 day seasonal window across past 2 years.
    """

    def get(self, request):
        date_str = request.query_params.get('date')
        limit_str = request.query_params.get('limit', '10')

        if not date_str:
            return Response({"error": "'date' is required."}, http_status.HTTP_400_BAD_REQUEST)

        # Parse date
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"error": "Invalid 'date'. Use YYYY-MM-DD."}, http_status.HTTP_400_BAD_REQUEST)

        # Validate limit
        try:
            limit = int(limit_str)
            if limit <= 0 or limit > 50:
                raise ValueError
        except (ValueError, TypeError):
            return Response({"error": "'limit' must be a positive integer, max 50."}, http_status.HTTP_400_BAD_REQUEST)

        # 15-day seasonal window: 7 days before and after
        window_start_base = target_date - timedelta(days=7)
        window_end_base = target_date + timedelta(days=7)

        # Look back 2 years
        target_year = target_date.year
        look_back_years = [target_year - 1, target_year - 2]

        # Count rentals per product across past 2 years
        product_counts = defaultdict(int)

        for past_year in look_back_years:
            # Shift the window to the past year
            try:
                w_start = window_start_base.replace(year=past_year)
                w_end = window_end_base.replace(year=past_year)
            except ValueError:
                # Handle Feb 29 edge case
                w_start = window_start_base.replace(year=past_year, day=28)
                w_end = window_end_base.replace(year=past_year, day=28)

            # Handle year boundary (e.g. Jan 3 → Dec 27 - Jan 10)
            if w_start > w_end:
                # Crosses year boundary — split into two ranges
                ranges = [
                    (w_start, date(past_year, 12, 31)),
                    (date(past_year + 1, 1, 1), w_end.replace(year=past_year + 1)),
                ]
            else:
                ranges = [(w_start, w_end)]

            for r_start, r_end in ranges:
                rentals = central_api.get_rentals_for_date_range(r_start, r_end)
                for rental in rentals:
                    product_counts[rental['productId']] += 1

        if not product_counts:
            return Response({
                "date": date_str,
                "recommendations": [],
            })

        # Top k products using min-heap: O(n log k)
        actual_k = min(limit, len(product_counts))
        heap = []
        for pid, cnt in product_counts.items():
            if len(heap) < actual_k:
                heapq.heappush(heap, (cnt, pid))
            elif cnt > heap[0][0]:
                heapq.heapreplace(heap, (cnt, pid))

        # Sort descending
        top_products = sorted(heap, key=lambda x: -x[0])
        top_ids = [pid for _, pid in top_products]
        top_scores = {pid: cnt for cnt, pid in top_products}

        # Batch fetch product details
        product_details = central_api.get_products_batch(top_ids)

        recommendations = []
        for pid in top_ids:
            product = product_details.get(pid, {})
            recommendations.append({
                "productId": pid,
                "name": product.get('name', f'Product #{pid}'),
                "category": product.get('category', 'UNKNOWN'),
                "score": top_scores[pid],
            })

        return Response({
            "date": date_str,
            "recommendations": recommendations,
        })
