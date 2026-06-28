# Performance

Performance characteristics, the observability endpoints, and tuning guidance for
**Solaris Health / LUCA Passport**.

## Table of Contents

- [Observability endpoints](#observability-endpoints)
- [Metrics reference](#metrics-reference)
- [Prometheus & Grafana](#prometheus--grafana)
- [Backend performance](#backend-performance)
- [Database tuning](#database-tuning)
- [Frontend performance](#frontend-performance)
- [Web3 caching](#web3-caching)
- [Load testing](#load-testing)
- [Performance checklist](#performance-checklist)

---

## Observability endpoints

The backend exposes two unauthenticated operational endpoints (added in Phase 6):

### `GET /api/health`
JSON liveness probe with an active database check. Returns `503` when the DB is
unreachable, making it suitable for load-balancer and orchestrator health checks.

```json
{ "status": "ok", "uptime": 12345, "database": "ok", "timestamp": "2026-06-28T00:00:00.000Z" }
```

### `GET /api/metrics`
Prometheus text-format metrics for scraping.

```bash
curl https://solaris-health.abacusai.cloud/api/metrics
```

---

## Metrics reference

| Metric | Type | Meaning |
|--------|------|---------|
| `luca_up` | gauge | `1` if the API process is serving |
| `luca_database_up` | gauge | `1` if the DB responded to the probe |
| `luca_uptime_seconds` | gauge | Seconds since process start |
| `luca_process_resident_memory_bytes` | gauge | RSS memory |
| `luca_process_heap_used_bytes` | gauge | V8 heap used |

---

## Prometheus & Grafana

Scrape config:

```yaml
scrape_configs:
  - job_name: luca-passport
    metrics_path: /api/metrics
    static_configs:
      - targets: ['solaris-health.abacusai.cloud']
```

Recommended alerts:
- `luca_up == 0` for > 1m → **API down**.
- `luca_database_up == 0` for > 1m → **DB down**.
- `luca_process_heap_used_bytes` trending toward the heap limit → **memory pressure**.

---

## Backend performance

- **Connection pooling** — a single `pg` pool (`db.js`) is reused across requests;
  avoid opening ad-hoc clients.
- **Stateless auth** — JWT verification is in-process (no session store round-trip).
- **Pagination** — list endpoints (timeline) accept `limit`/`offset`; always paginate
  large result sets.
- **Graceful degradation** — the AI concierge falls back to the offline mock on
  provider errors, so latency spikes upstream never fail the request.

---

## Database tuning

- Index the hot paths (see [DATABASE.md → Indexing](./DATABASE.md#indexing)) — composite
  indexes matching `WHERE` + `ORDER BY` for timeline/trends range scans.
- Use `EXPLAIN ANALYZE` to validate query plans as data grows.
- Keep transactions short; the hosted Postgres kills queries > 5s and idle
  transactions > 30s.
- Consider partitioning `luca_messages` / `wallet_transactions` by time at scale.

```sql
EXPLAIN ANALYZE
SELECT * FROM daily_checkins WHERE user_id = $1 AND checkin_date >= $2 ORDER BY checkin_date;
```

---

## Frontend performance

- **Vite production build** — minified, tree-shaken, hashed assets.
- **Code splitting** — heavy, route-specific views can be lazy-loaded with
  `React.lazy` to shrink the initial bundle.
- **Recharts** uses `ResizeObserver`; avoid unnecessary re-renders by memoizing chart
  data (`useMemo`).
- Serve static assets with long-lived cache headers behind Nginx.

```bash
npm run build       # produces dist/
npm run preview     # serve the production build locally
```

---

## Web3 caching

`lib/web3.js` includes a small **in-memory TTL cache**:
- Balances cached ~5 minutes.
- Transaction lists cached ~2 minutes.

This shields public RPC/explorer endpoints from redundant calls and keeps wallet
views snappy. For multi-instance deployments, consider a shared cache (e.g. Redis).

---

## Load testing

Quick smoke with [`autocannon`](https://github.com/mcollina/autocannon):

```bash
npx autocannon -c 50 -d 20 https://solaris-health.abacusai.cloud/api/health
```

For authenticated endpoints, pass a token header:

```bash
npx autocannon -c 20 -d 20 \
  -H "Authorization=Bearer $TOKEN" \
  https://solaris-health.abacusai.cloud/api/timeline/me?limit=50
```

Watch `/api/metrics` (memory, uptime) during the run.

---

## Performance checklist

- [ ] Indexes cover timeline/trends range queries.
- [ ] List endpoints are paginated.
- [ ] Frontend built with `npm run build`; assets cached at the proxy.
- [ ] Heavy routes lazy-loaded where practical.
- [ ] `/api/metrics` scraped; alerts configured.
- [ ] Web3 caching enabled (shared cache for multi-instance).
- [ ] Load tested at expected peak concurrency.
- [ ] DB connection pool sized appropriately (respect hosted limits).
