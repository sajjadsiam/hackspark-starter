"""
Central API client with:
- Automatic Bearer token injection
- Response caching (categories)
- Rate limit tracking
- Exponential backoff with jitter on 429 (B2)
"""
import time
import random
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Simple in-memory cache for categories
_categories_cache = None
_categories_cache_ts = 0
CATEGORIES_TTL = 300  # 5 minutes


def _get_headers():
    return {"Authorization": f"Bearer {settings.CENTRAL_API_TOKEN}"}


def central_get(path, params=None, retries=3):
    """
    GET from the Central API with exponential backoff on 429.
    Returns (status_code, data_dict)
    """
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
            if attempt >= retries:
                return 503, {
                    "error": f"Central API unavailable after {retries} retries",
                    "lastRetryAfter": retry_after,
                    "suggestion": "Try again in ~2 minutes"
                }
            body = {}
            try:
                body = resp.json()
            except Exception:
                pass
            retry_after = body.get('retryAfterSeconds', 60)
            # Exponential backoff with ±20% jitter
            wait = retry_after * (2 ** attempt)
            jitter = wait * 0.2 * random.uniform(-1, 1)
            wait = max(1, wait + jitter)
            attempt += 1
            logger.info(f"[retry {attempt}/{retries}] waiting {wait:.1f}s before retrying GET {path}")
            time.sleep(wait)
            continue

        try:
            data = resp.json()
        except Exception:
            data = {}

        return resp.status_code, data

    return 503, {"error": "Central API unavailable after retries."}


def get_categories(force=False):
    """Cached categories fetch."""
    global _categories_cache, _categories_cache_ts
    now = time.time()
    if not force and _categories_cache is not None and (now - _categories_cache_ts) < CATEGORIES_TTL:
        return _categories_cache

    status_code, data = central_get('/api/data/categories')
    if status_code == 200:
        _categories_cache = data.get('categories', [])
        _categories_cache_ts = now
        return _categories_cache
    return _categories_cache or []


def get_products(params=None):
    return central_get('/api/data/products', params=params)


def get_product(product_id):
    return central_get(f'/api/data/products/{product_id}')


def get_products_batch(ids):
    """Fetch multiple products by ID. Max 50 per call."""
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


def get_rentals(params=None):
    return central_get('/api/data/rentals', params=params)


def get_rentals_stats(params=None):
    return central_get('/api/data/rentals/stats', params=params)


def get_all_rentals_for_product(product_id):
    """Paginate through all rentals for a product."""
    rentals = []
    page = 1
    while True:
        status_code, data = central_get('/api/data/rentals', params={
            'product_id': product_id,
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


def get_all_rentals_for_user(user_id):
    """Paginate through all rentals for a renter."""
    rentals = []
    page = 1
    while True:
        status_code, data = central_get('/api/data/rentals', params={
            'renter_id': user_id,
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


def get_all_rentals_stats_by_date(from_month, to_month):
    """
    Fetch rental stats grouped by date for a range of months.
    Returns list of {date, count} dicts for all days in range.
    """
    from datetime import date, timedelta
    import calendar

    # Parse range
    from_year, from_m = int(from_month[:4]), int(from_month[5:7])
    to_year, to_m = int(to_month[:4]), int(to_month[5:7])

    all_stats = []
    cur_year, cur_m = from_year, from_m

    while (cur_year, cur_m) <= (to_year, to_m):
        month_str = f"{cur_year}-{cur_m:02d}"
        status_code, data = central_get('/api/data/rentals/stats', params={
            'group_by': 'date',
            'month': month_str
        })
        if status_code == 200:
            all_stats.extend(data.get('data', []))
        # Advance month
        if cur_m == 12:
            cur_year += 1
            cur_m = 1
        else:
            cur_m += 1

    return all_stats
