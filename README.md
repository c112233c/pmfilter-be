# PM Filter Backend

Node.js 20+ / Express API for PM Filter. MariaDB database: `tdms_pmfilter`.

## Local development

1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set the database password.
3. Configure Keycloak Realm `OMD` to use the existing frontend client `pmfilter-fe` for both login and API token validation. Ensure access tokens contain `aud: pmfilter-fe` and client roles `pmfilter-viewer`, `pmfilter-editor`, `pmfilter-admin` under `resource_access.pmfilter-fe.roles`. For the Event Agent, use a separate confidential service-account client with the `pmfilter-checker` role only; its token must also include `aud: pmfilter-fe` for this configuration, or the audience validation strategy must be adjusted before integration.
4. Run `npm install`, `npm test`, then `npm run dev`.
5. API listens on port 3001. Health endpoints: `GET /health/live` and `GET /health/ready`.

## API

All `/api/v1/*` endpoints require `Authorization: Bearer <Keycloak access token>`, except `POST /api/v1/pm/check` which also supports the dedicated `cbevent` API Key.

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/pm?search=&status=&page=&limit=`
- `POST /api/v1/pm`
- `GET /api/v1/pm/:id`
- `PUT /api/v1/pm/:id`
- `POST /api/v1/pm/:id/cancel`
- `POST /api/v1/pm/check`
- `GET /api/v1/audit?limit=50`

Create/update payload:

```json
{
  "title": "PM October",
  "description": "ตรวจสอบอุปกรณ์",
  "devices": ["BDH_115_LINE01", "BDH_115_LINE02"],
  "time_windows": [{
    "start_time": "2026-10-22T08:00:00+07:00",
    "end_time": "2026-10-22T12:00:00+07:00"
  }]
}
```

Time windows are shared across all devices. Device names are trimmed; duplicates are rejected case-insensitively. Windows may be adjacent but must not overlap. Date-times must include a timezone and are stored as UTC in MariaDB `DATETIME(3)`. Matching uses `start_time <= event_time AND event_time < end_time`.

## Authorization

- Viewer: dashboard, PM list/detail, PM check, audit.
- Editor: viewer + create/update PM.
- Admin: editor + cancel PM.
- `pmfilter-checker`: PM check endpoint only.

Errors return JSON with `error`, `code`, `message`, and `request_id`. Backend failures are never converted to `in_pm: false`.

## Database

Expected existing tables in `tdms_pmfilter`: `pm_list`, `pm_devices`, `pm_time_windows`, `audit_logs` (`actor_name`, `actor_id`). `migrations/001_initial_schema.sql` is a reference for other environments and does not alter existing tables.
