# Vaakku Admin Guide

## Dashboard Access

Navigate to `/admin` to access the admin dashboard. This page provides:

1. **Overview** — Real-time metrics (total queries, avg confidence, latency, escalation rate)
2. **Query Logs** — Searchable/filterable log of all user queries with confidence scores
3. **Content Sync** — Trigger re-indexing of data sources (voter rolls, booth data, FAQ, ECI circulars)
4. **Audit Log** — Chronological record of all admin actions and system events

## Content Sync

### Data Sources

| Source | Description | Sync Frequency |
|--------|------------|---------------|
| Voter Roll | Electoral roll data from CEO Kerala | Daily |
| Booth Locations | Polling station locations + accessibility | Weekly |
| FAQ Content | Frequently asked questions | On update |
| ECI Circulars | Election Commission of India circulars | On publish |

### Triggering a Sync

1. Go to **Admin → Content Sync** tab
2. Click **Sync** next to the desired source
3. The system will queue a background job
4. Monitor status in the Audit Log

### API Endpoint

```
POST /api/sync_sources
Content-Type: application/json

{
  "source_type": "voter_roll" | "booth_data" | "faq" | "circular",
  "force": false
}
```

## Monitoring

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Response Latency (p95) | < 500ms | > 1000ms |
| Confidence Score (avg) | > 0.8 | < 0.7 |
| Escalation Rate | < 5% | > 10% |
| Error Rate | < 1% | > 5% |

### Escalation Review

Queries with confidence < 0.6 or safety flags are automatically escalated. Review these in the Query Logs tab (look for "Escalated" status badges).

## Privacy & Data Access

### GDPR-style Requests

Users can request data export or deletion via `/settings`:

```
POST /api/data-access
Content-Type: application/json

{
  "type": "export" | "delete",
  "session_id": "uuid"
}
```

### Audit Trail

All data access events are logged with:
- Action type
- Actor (admin ID or "system")
- Timestamp
- Details

### PII Handling

- All user identifiers are SHA-256 hashed before storage
- PII (Aadhaar, PAN, email, phone) is automatically redacted from query logs
- No raw PII is stored in any log or database

## Security Checklist

- [ ] Set strong `HASH_SALT` in environment variables
- [ ] Restrict `/admin` route with authentication (not included in PoC)
- [ ] Enable HTTPS in production
- [ ] Set up rate limiting on API endpoints
- [ ] Configure CORS for production domain
- [ ] Review and rotate API keys regularly
