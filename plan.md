# HACKSPARK — RentPi Build Plan & Status

## Architecture Summary

```
Browser → frontend:3000 → api-gateway:8000 → [user-service:8001, rental-service:8002, analytics-service:8003, agentic-service:8004]
```

---

## Services Built

### ✅ user-service (Django + PostgreSQL) — Port 8001
| Problem | Endpoint | Status |
|---------|----------|--------|
| P1 | `GET /status` | ✅ Done |
| P2 | `POST /users/register` — argon2 hashed password, JWT | ✅ Done |
| P2 | `POST /users/login` — validates, returns JWT | ✅ Done |
| P2 | `GET /users/me` — JWT-protected | ✅ Done |
| P6 | `GET /users/:id/discount` — security score tier | ✅ Done |

**Stack:** Django 4.2, DRF, djangorestframework-simplejwt, argon2-cffi, psycopg2  
**Dockerfile:** Multistage alpine (builder + runtime)

---

### ✅ rental-service (Django) — Port 8002
| Problem | Endpoint | Algorithm | Status |
|---------|----------|-----------|--------|
| P1 | `GET /status` | — | ✅ Done |
| P3 | `GET /rentals/products` | Transparent proxy | ✅ Done |
| P3 | `GET /rentals/products/:id` | Transparent proxy | ✅ Done |
| P5 | `GET /rentals/products?category=` | Cached categories validation | ✅ Done |
| P7 | `GET /rentals/products/:id/availability` | Interval merge algorithm | ✅ Done |
| P8 | `GET /rentals/kth-busiest-date` | **Min-heap O(n log k)** | ✅ Done |
| P9 | `GET /rentals/users/:id/top-categories` | **Min-heap O(n log k)** | ✅ Done |
| P10 | `GET /rentals/products/:id/free-streak` | Interval merge + scan | ✅ Done |
| P12 | `GET /rentals/merged-feed` | **K-way merge with min-heap** | ✅ Done |

**Bonus:** B2 rate-limit backoff with jitter in `central_api.py`  
**Stack:** Django 4.2, DRF (no DB — pure proxy)  
**Dockerfile:** Multistage alpine

---

### ✅ analytics-service (Django) — Port 8003
| Problem | Endpoint | Algorithm | Status |
|---------|----------|-----------|--------|
| P1 | `GET /status` | — | ✅ Done |
| P11 | `GET /analytics/peak-window` | **O(n) Sliding Window** | ✅ Done |
| P13 | `GET /analytics/surge-days` | **O(n) Monotonic Stack** | ✅ Done |
| P14 | `GET /analytics/recommendations` | **Min-heap O(n log k)** | ✅ Done |

**Stack:** Django 4.2, DRF (no DB — pure analytics)  
**Dockerfile:** Multistage alpine

---

### ✅ api-gateway (Node.js/Express) — Port 8000
| Problem | Feature | Status |
|---------|---------|--------|
| P1 | `GET /status` — parallel downstream health check | ✅ Done |
| P4 | Routes: `/users`, `/rentals`, `/analytics`, `/chat` | ✅ Done |

**Stack:** Express.js, http-proxy-middleware  
**Dockerfile:** Multistage alpine (<150MB)

---

### ✅ agentic-service (Node.js + MongoDB + Gemini) — Port 8004
| Problem | Feature | Status |
|---------|---------|--------|
| P1 | `GET /status` | ✅ Done |
| P15 | `POST /chat` — keyword guard, data grounding, Gemini 2.0 Flash | ✅ Done |
| P16 | `GET /chat/sessions` — sorted by lastMessageAt | ✅ Done |
| P16 | `GET /chat/:sessionId/history` | ✅ Done |
| P16 | `DELETE /chat/:sessionId` | ✅ Done |
| P16 | Session name auto-generation via LLM | ✅ Done |

**Stack:** Express.js, Mongoose, Gemini 2.0 Flash API  
**Dockerfile:** Multistage alpine

---

### ✅ frontend (Next.js 14 + Tailwind + Framer Motion) — Port 3000
| Problem | Page | Status |
|---------|------|--------|
| P17 | `/login` | ✅ Done |
| P17 | `/register` | ✅ Done |
| P17 | `/products` — paginated catalog with category filter | ✅ Done |
| P17 | `/availability` — date range picker + busy/free display | ✅ Done |
| P17 | `/chat` — full chatbot UI with session sidebar | ✅ Done |
| P17+ | `/trending` — seasonal picks (extra page) | ✅ Done |
| P17+ | `/analytics` — peak window + surge calendar (extra page) | ✅ Done |
| P17+ | `/profile` — user info + discount + top categories (extra page) | ✅ Done |
| P18 | Trending widget on homepage | ✅ Done |

**Stack:** Next.js 14, Tailwind CSS, Framer Motion, Axios

---

## Algorithm Verification (Required for P7–P14 Full Points)

| Problem | Algorithm | Complexity |
|---------|-----------|-----------|
| P7 | Sort intervals → merge overlaps → scan free windows | O(n log n) |
| P8 | **Min-heap of size k** — never sort all dates | **O(n log k)** |
| P9 | **Min-heap of size k** — batch product fetch | **O(n log k)** |
| P10 | Clip intervals to year → merge → find max gap | O(n log n) |
| P11 | **Sliding window** — one running sum, no inner loop | **O(n)** |
| P12 | **Min-heap K-way merge** — index-pointer approach | **O(N·log K)** |
| P13 | **Monotonic stack** — single left-to-right pass, no nested loop | **O(n)** |
| P14 | **Min-heap of size k** across 2-year window | **O(n log k)** |

---

## Docker Setup

```bash
# Copy env and set your token
cp .env.example .env
# Edit CENTRAL_API_TOKEN=your_token_here
# Edit JWT_SECRET=your_secret

# Build and run everything
docker-compose up --build
```

> [!IMPORTANT]
> You MUST set `CENTRAL_API_TOKEN` in `.env` before running. Without it, all Central API calls will fail.

---

## Next Steps (Remaining Work)

1. **Set your `CENTRAL_API_TOKEN`** in `.env`
2. **Build and test:** `docker-compose up --build`
3. Frontend polish + additional page refinements
4. Test all endpoints against the judge's test suite
5. Optional: Add B1 (gRPC) for bonus 50pts

---

## Bonus Points Status

| Bonus | Description | Status |
|-------|-------------|--------|
| B2 | Exponential backoff with jitter on 429 | ✅ Implemented in central_api.py |
| B1 | gRPC internal communication | ⏳ Not yet |
