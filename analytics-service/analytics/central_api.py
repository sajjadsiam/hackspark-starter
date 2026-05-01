"""
Central API client for analytics-service.
Same backoff logic as rental-service.
"""
import time
import random
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_headers():
    return {"Authorization": f"Bearer {settings.CENTRAL_API_TOKEN}"}

_request_cache = {}

def central_get(path, params=None, retries=3):
    cache_key = (path, frozenset(params.items()) if params else None)
    if cache_key in _request_cache:
        return 200, _request_cache[cache_key]

    url = f"{settings.CENTRAL_API_URL}{path}"
    attempt = 0
    retry_after = 0

    while attempt <= retries:
        try:
            resp = requests.get(url, headers=_get_headers(), params=params, timeout=15)
        except requests.RequestException as e:
            logger.error(f"Central API request failed: {e}")
            return 503, {"error": "Central API unreachable."}

        if resp.status_code == 429:
            body = {}
            try:
                body = resp.json()
            except Exception:
                pass
            retry_after = body.get('retryAfterSeconds', 60)
            wait = retry_after * (2 ** attempt)
            jitter = wait * 0.2 * random.uniform(-1, 1)
            wait = max(1, wait + jitter)
            
            if wait > 5 or attempt >= retries:
                body['_headers'] = dict(resp.headers)
                return 429, body
                
            attempt += 1
            logger.info(f"[retry {attempt}/{retries}] waiting {wait:.1f}s before retrying GET {path}")
            time.sleep(wait)
            continue

        try:
            data = resp.json()
        except Exception:
            data = {}

        if resp.status_code == 200:
            _request_cache[cache_key] = data
        elif resp.status_code == 429:
            data['_headers'] = dict(resp.headers)

        return resp.status_code, data

    return 503, {"error": "Central API unavailable after retries."}

_stats_cache = {}

def get_rentals_stats_by_date(month_str):
    """Fetch rental stats grouped by date for a single month."""
    if month_str in _stats_cache:
        return 200, _stats_cache[month_str]
    
    status_code, data = central_get('/api/data/rentals/stats', params={'group_by': 'date', 'month': month_str})
    if status_code == 200:
        _stats_cache[month_str] = data
    return status_code, data


def get_rentals_stats_by_category():
    """Fetch rental stats grouped by category."""
    return central_get('/api/data/rentals/stats', params={'group_by': 'category'})


def get_all_rentals_stats_range(from_month, to_month):
    """Fetch stats for multiple months. Returns dict: date_str -> count."""
    import re
    import calendar

    from_y, from_m = int(from_month[:4]), int(from_month[5:7])
    to_y, to_m = int(to_month[:4]), int(to_month[5:7])

    date_counts = {}
    cur_y, cur_m = from_y, from_m

    while (cur_y, cur_m) <= (to_y, to_m):
        month_str = f"{cur_y}-{cur_m:02d}"
        status_code, data = get_rentals_stats_by_date(month_str)
        if status_code == 200:
            for item in data.get('data', []):
                date_counts[item['date']] = item['count']
        if cur_m == 12:
            cur_y += 1
            cur_m = 1
        else:
            cur_m += 1

    return date_counts


def get_rentals_for_date_range(from_date, to_date):
    """Fetch all rentals in a date range, paginated."""
    rentals = []
    page = 1
    while True:
        status_code, data = central_get('/api/data/rentals', params={
            'from': str(from_date),
            'to': str(to_date),
            'page': page,
            'limit': 100
        })
        if status_code != 200:
            break
        batch = data.get('data', [])
        rentals.extend(batch)
        total = data.get('total', 0)
        if len(rentals) >= total or not batch:
            break
        page += 1
    return rentals


def get_products_batch(ids):
    """Batch fetch product details. Returns dict: id -> product."""
    results = {}
    id_list = list(ids)
    for i in range(0, len(id_list), 50):
        chunk = id_list[i:i+50]
        ids_str = ','.join(str(x) for x in chunk)
        status_code, data = central_get('/api/data/products/batch', params={'ids': ids_str})
        if status_code == 200:
            for p in data.get('data', []):
                results[p['id']] = p
    return results
