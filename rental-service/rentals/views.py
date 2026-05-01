"""
Rental Service Views
Implements: P1, P3, P5, P7, P8, P9, P10, P12
"""
import heapq
import re
from datetime import date, timedelta, datetime
from collections import defaultdict

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from . import central_api


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_date(date_str):
    """Parse YYYY-MM-DD string to date object."""
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


def parse_month(month_str):
    """Parse YYYY-MM string. Returns (year, month) or None."""
    if not month_str or not re.match(r'^\d{4}-\d{2}$', month_str):
        return None
    y, m = int(month_str[:4]), int(month_str[5:7])
    if not (1 <= m <= 12):
        return None
    return y, m


def merge_intervals(intervals):
    """
    Merge overlapping intervals.
    Input: list of (start_date, end_date) tuples
    Output: sorted list of merged (start_date, end_date) tuples
    """
    if not intervals:
        return []
    sorted_ivs = sorted(intervals, key=lambda x: x[0])
    merged = [sorted_ivs[0]]
    for start, end in sorted_ivs[1:]:
        if start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def rentals_to_intervals(rentals):
    """Convert rental dicts to (start, end) date tuples."""
    intervals = []
    for r in rentals:
        try:
            start = parse_date(r['rentalStart'][:10])
            end = parse_date(r['rentalEnd'][:10])
            if start and end:
                intervals.append((start, end))
        except (KeyError, TypeError):
            pass
    return intervals


def find_free_windows(busy_merged, range_start, range_end):
    """Find free windows within [range_start, range_end] given merged busy periods."""
    free = []
    cursor = range_start
    for busy_start, busy_end in busy_merged:
        if busy_start > range_end:
            break
        if busy_start > cursor:
            # Free window before this busy period
            win_end = min(busy_start - timedelta(days=1), range_end)
            if win_end >= cursor:
                free.append((cursor, win_end))
        cursor = max(cursor, busy_end + timedelta(days=1))
    # Check after last busy period
    if cursor <= range_end:
        free.append((cursor, range_end))
    return free


# ── Views ─────────────────────────────────────────────────────────────────────

class StatusView(APIView):
    def get(self, request):
        return Response({"service": "rental-service", "status": "OK"})


class ProductsListView(APIView):
    """P3 + P5: Proxy + filtered product listing with valid category check."""

    def get(self, request):
        params = {}
        for key in ['category', 'page', 'limit', 'owner_id']:
            val = request.query_params.get(key)
            if val is not None:
                params[key] = val

        # P5: Validate category if provided (cached)
        if 'category' in params:
            categories = central_api.get_categories()
            if params['category'].upper() not in [c.upper() for c in categories]:
                return Response({
                    "error": f"Invalid category '{params['category']}'. Valid categories: {categories}"
                }, status=status.HTTP_400_BAD_REQUEST)
            params['category'] = params['category'].upper()

        status_code, data = central_api.get_products(params=params)

        if status_code == 404:
            return Response({"error": "Not found."}, status=404)
        if status_code == 429:
            headers = data.pop('_headers', {}) if isinstance(data, dict) else {}
            return Response({"error": "Rate limit exceeded."}, status=429, headers=headers)
        if status_code != 200:
            return Response({"error": "Central API error.", "detail": data}, status=status_code)

        return Response(data)


class ProductDetailView(APIView):
    """P3: Proxy single product."""

    def get(self, request, product_id):
        status_code, data = central_api.get_product(product_id)

        if status_code == 404:
            return Response({"error": f"Product {product_id} not found."}, status=404)
        if status_code == 429:
            headers = data.pop('_headers', {}) if isinstance(data, dict) else {}
            return Response({"error": "Rate limit exceeded."}, status=429, headers=headers)
        if status_code != 200:
            return Response({"error": "Central API error."}, status=status_code)

        return Response(data)


class ProductAvailabilityView(APIView):
    """
    P7: Is It Available?
    Merges overlapping busy periods and finds free windows.
    """

    def get(self, request, product_id):
        from_str = request.query_params.get('from')
        to_str = request.query_params.get('to')

        if not from_str or not to_str:
            return Response({"error": "'from' and 'to' query parameters are required."}, status=400)

        range_start = parse_date(from_str)
        range_end = parse_date(to_str)

        if not range_start or not range_end:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

        if range_start > range_end:
            return Response({"error": "'from' must not be after 'to'."}, status=400)

        # Fetch all rentals for this product
        rentals = central_api.get_all_rentals_for_product(product_id)
        intervals = rentals_to_intervals(rentals)

        # Merge overlapping intervals
        busy_merged = merge_intervals(intervals)

        # Check availability against requested range
        is_available = True
        conflicting_busy = []
        for start, end in busy_merged:
            # Overlap check: busy overlaps with [range_start, range_end]
            if start <= range_end and end >= range_start:
                is_available = False
                conflicting_busy.append((start, end))

        # Find free windows within range
        free_windows = find_free_windows(busy_merged, range_start, range_end)

        return Response({
            "productId": product_id,
            "from": from_str,
            "to": to_str,
            "available": is_available,
            "busyPeriods": [
                {"start": str(s), "end": str(e)}
                for s, e in conflicting_busy
            ],
            "freeWindows": [
                {"start": str(s), "end": str(e)}
                for s, e in free_windows
            ],
        })


class KthBusiestDateView(APIView):
    """
    P8: The Record Day
    Uses a min-heap of size k for O(n log k) — better than O(n log n) full sort.
    """

    def get(self, request):
        from_str = request.query_params.get('from')
        to_str = request.query_params.get('to')
        k_str = request.query_params.get('k', '1')

        # Validate
        if not from_str or not re.match(r'^\d{4}-\d{2}$', from_str):
            return Response({"error": "Invalid 'from'. Use YYYY-MM format."}, status=400)
        if not to_str or not re.match(r'^\d{4}-\d{2}$', to_str):
            return Response({"error": "Invalid 'to'. Use YYYY-MM format."}, status=400)

        from_parsed = parse_month(from_str)
        to_parsed = parse_month(to_str)
        if not from_parsed or not to_parsed:
            return Response({"error": "Invalid month format."}, status=400)
        if from_parsed > to_parsed:
            return Response({"error": "'from' must not be after 'to'."}, status=400)

        # Max range 12 months
        from_date = date(from_parsed[0], from_parsed[1], 1)
        to_y, to_m = to_parsed
        import calendar
        last_day = calendar.monthrange(to_y, to_m)[1]
        to_date = date(to_y, to_m, last_day)
        months_diff = (to_y - from_parsed[0]) * 12 + (to_m - from_parsed[1])
        if months_diff > 11:
            return Response({"error": "Max range is 12 months."}, status=400)

        try:
            k = int(k_str)
            if k <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({"error": "'k' must be a positive integer."}, status=400)

        # Fetch stats for all months
        all_stats = central_api.get_all_rentals_stats_by_date(from_str, to_str)

        # Build a dict: date_str -> count
        date_counts = {item['date']: item['count'] for item in all_stats}

        if not date_counts:
            return Response({"error": f"No data found for the given range."}, status=404)

        # O(n log k) min-heap approach: maintain heap of size k
        # heap contains (count, date_str)
        heap = []
        for d_str, cnt in date_counts.items():
            if len(heap) < k:
                heapq.heappush(heap, (cnt, d_str))
            elif cnt > heap[0][0]:
                heapq.heapreplace(heap, (cnt, d_str))

        if len(heap) < k:
            return Response({"error": f"k={k} exceeds the number of distinct dates ({len(heap)})."}, status=404)

        # The root of min-heap is the kth largest
        kth_count, kth_date = heap[0]

        return Response({
            "from": from_str,
            "to": to_str,
            "k": k,
            "date": kth_date,
            "rentalCount": kth_count,
        })


class TopCategoriesView(APIView):
    """
    P9: What Does This Renter Love?
    Uses min-heap of size k for O(n log k) — optimized approach.
    """

    def get(self, request, user_id):
        k_str = request.query_params.get('k', '5')
        try:
            k = int(k_str)
            if k <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({"error": "'k' must be a positive integer."}, status=400)

        # Fetch all rentals for this user
        rentals = central_api.get_all_rentals_for_user(user_id)

        if not rentals:
            return Response({"userId": user_id, "topCategories": []})

        # Get unique product IDs from rentals
        product_ids = list({r['productId'] for r in rentals})

        # Batch fetch product details (max 50 per call)
        product_map = central_api.get_products_batch(product_ids)

        # Count rentals per category
        category_counts = defaultdict(int)
        for r in rentals:
            pid = r['productId']
            product = product_map.get(pid)
            if product:
                cat = product.get('category', 'UNKNOWN')
                category_counts[cat] += 1

        if not category_counts:
            return Response({"userId": user_id, "topCategories": []})

        # O(n log k) min-heap for top-k categories
        actual_k = min(k, len(category_counts))
        heap = []
        for cat, cnt in category_counts.items():
            if len(heap) < actual_k:
                heapq.heappush(heap, (cnt, cat))
            elif cnt > heap[0][0]:
                heapq.heapreplace(heap, (cnt, cat))

        # Sort descending
        result = sorted(heap, key=lambda x: -x[0])

        return Response({
            "userId": user_id,
            "topCategories": [
                {"category": cat, "rentalCount": cnt}
                for cnt, cat in result
            ]
        })


class FreeStreakView(APIView):
    """
    P10: The Long Vacation
    Finds longest free streak in a given year.
    """

    def get(self, request, product_id):
        year_str = request.query_params.get('year')
        if not year_str:
            return Response({"error": "'year' is required."}, status=400)
        try:
            year = int(year_str)
            if year < 2000 or year > 2100:
                raise ValueError
        except ValueError:
            return Response({"error": "Invalid year."}, status=400)

        year_start = date(year, 1, 1)
        year_end = date(year, 12, 31)

        # Fetch all rentals for this product
        rentals = central_api.get_all_rentals_for_product(product_id)
        intervals = rentals_to_intervals(rentals)

        # Clip intervals to the year and merge
        clipped = []
        for start, end in intervals:
            cs = max(start, year_start)
            ce = min(end, year_end)
            if cs <= ce:
                clipped.append((cs, ce))

        busy_merged = merge_intervals(clipped)

        # Find free windows within the year
        free_windows = find_free_windows(busy_merged, year_start, year_end)

        if not free_windows:
            # Entire year is busy
            return Response({
                "productId": product_id,
                "year": year,
                "longestFreeStreak": None
            })

        # Find longest free window
        best = max(free_windows, key=lambda w: (w[1] - w[0]).days + 1)
        days = (best[1] - best[0]).days + 1

        return Response({
            "productId": product_id,
            "year": year,
            "longestFreeStreak": {
                "from": str(best[0]),
                "to": str(best[1]),
                "days": days,
            }
        })


class MergedFeedView(APIView):
    """
    P12: The Unified Feed
    K-way merge using recursive merge-sort approach: O(N·K·log K)
    """

    def get(self, request):
        product_ids_str = request.query_params.get('productIds', '')
        limit_str = request.query_params.get('limit', '30')

        # Validate productIds
        if not product_ids_str:
            return Response({"error": "'productIds' is required."}, status=400)

        try:
            product_ids = list({int(x.strip()) for x in product_ids_str.split(',') if x.strip()})
        except ValueError:
            return Response({"error": "'productIds' must be comma-separated integers."}, status=400)

        if len(product_ids) < 1 or len(product_ids) > 10:
            return Response({"error": "'productIds' must have 1–10 unique integers."}, status=400)

        # Validate limit
        try:
            limit = int(limit_str)
            if limit <= 0 or limit > 100:
                raise ValueError
        except (ValueError, TypeError):
            return Response({"error": "'limit' must be a positive integer, max 100."}, status=400)

        # Fetch rentals per product
        streams = []
        for pid in product_ids:
            rentals = central_api.get_all_rentals_for_product(pid)
            # Sort by rentalStart (should already be sorted but ensure it)
            sorted_rentals = sorted(rentals, key=lambda r: r.get('rentalStart', ''))
            if sorted_rentals:
                streams.append(sorted_rentals)

        if not streams:
            return Response({"productIds": product_ids, "limit": limit, "feed": []})

        # K-way merge using min-heap
        # Heap entry: (rentalStart, stream_index, item_index, rental_dict)
        heap = []
        # Iterators for each stream
        iters = [iter(s) for s in streams]
        stream_nexts = []
        for i, it in enumerate(iters):
            try:
                item = next(it)
                start_key = item.get('rentalStart', '')
                heapq.heappush(heap, (start_key, i, item))
            except StopIteration:
                pass

        feed = []
        # For tracking iterators
        stream_iters = {i: iters[i] for i in range(len(iters))}
        # Reset - use index-based approach
        heap = []
        for i, stream in enumerate(streams):
            if stream:
                item = stream[0]
                heapq.heappush(heap, (item.get('rentalStart', ''), i, 0))

        while heap and len(feed) < limit:
            start_key, si, idx = heapq.heappop(heap)
            item = streams[si][idx]
            feed.append({
                "rentalId": item.get('id'),
                "productId": item.get('productId'),
                "rentalStart": item.get('rentalStart', '')[:10],
                "rentalEnd": item.get('rentalEnd', '')[:10],
            })
            next_idx = idx + 1
            if next_idx < len(streams[si]):
                next_item = streams[si][next_idx]
                heapq.heappush(heap, (next_item.get('rentalStart', ''), si, next_idx))

        return Response({
            "productIds": product_ids,
            "limit": limit,
            "feed": feed,
        })
