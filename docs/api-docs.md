# Stock Service — API Documentation

Base URL: `http://localhost:3000`  
Swagger UI: `http://localhost:3000/api`

## Authentication

Every endpoint requires the header:

```
x-api-key: <your-api-key>
```

Set `API_KEY` in the `.env` file. If `API_KEY` is not set, the guard is disabled (development mode).

---

## Settings

Manage application configuration stored in MongoDB. All stock-alert parameters are configurable at runtime without redeploying.

### System Setting Keys

| Key | Description | Default |
|-----|-------------|---------|
| `stock.apiBaseUrl` | URL of the stock-alert FastAPI service | `http://localhost:8000` |
| `stock.apiSource` | Default data source (`KBS`, `VCI`) | `KBS` |
| `stock.alertThresholdPercent` | % price change that triggers a Discord alert | `3` |
| `discord.alertChannelId` | Discord channel ID to send alerts to | — |

---

### `GET /settings`

Returns all settings stored in MongoDB.

**Response** `200 OK`

```json
[
  { "key": "stock.alertThresholdPercent", "value": 3, "description": "Alert threshold" },
  { "key": "discord.alertChannelId", "value": "123456789", "description": "Alert channel" }
]
```

---

### `GET /settings/:key`

Returns a single setting by key.

**Path params**

| Param | Description | Example |
|-------|-------------|---------|
| `key` | Setting key | `stock.alertThresholdPercent` |

**Response** `200 OK` — setting object  
**Response** `404 Not Found` — key does not exist

---

### `PUT /settings`

Creates or updates a setting (upsert).

**Request body**

```json
{
  "key": "stock.alertThresholdPercent",
  "value": 5,
  "description": "Alert when price moves ±5%"
}
```

**Response** `200 OK` — updated setting object

---

### `DELETE /settings/:key`

Deletes a setting permanently.

**Path params**

| Param | Description | Example |
|-------|-------------|---------|
| `key` | Setting key to delete | `stock.alertThresholdPercent` |

**Response** `204 No Content`  
**Response** `404 Not Found`

---

## Stock — Watched Symbols

Manage the list of stock symbols that the price-alert cron job monitors.

---

### `GET /stock/watched`

Returns all watched symbols (including inactive ones).

**Response** `200 OK`

```json
[
  { "symbol": "VCB", "active": true, "note": "Vietcombank" },
  { "symbol": "ACB", "active": false, "note": null }
]
```

---

### `POST /stock/watched`

Adds a symbol to the watchlist. If the symbol already exists, updates its fields (upsert).

**Request body**

```json
{
  "symbol": "VCB",
  "active": true,
  "note": "Vietcombank"
}
```

**Response** `201 Created` — the symbol document

---

### `PATCH /stock/watched/:symbol/active`

Toggles the active state of a watched symbol. Inactive symbols are excluded from cron-job checks.

**Path params**

| Param | Description | Example |
|-------|-------------|---------|
| `symbol` | Stock symbol | `VCB` |

**Query params**

| Param | Description | Default |
|-------|-------------|---------|
| `value` | `true` or `false` | `true` |

**Example**

```
PATCH /stock/watched/VCB/active?value=false
```

**Response** `200 OK` — updated symbol document  
**Response** `404 Not Found`

---

### `DELETE /stock/watched/:symbol`

Removes a symbol from the watchlist permanently.

**Path params**

| Param | Description | Example |
|-------|-------------|---------|
| `symbol` | Stock symbol to remove | `VCB` |

**Response** `204 No Content`

---

### `POST /stock/check-prices`

Manually triggers the price-alert check for all active symbols immediately. Useful for testing Discord alerts without waiting for the scheduled cron.

**Response** `200 OK`

```json
{ "triggered": true }
```

---

## Stock — Market Data (Proxy)

These endpoints proxy requests to the stock-alert FastAPI service. The base URL and default source are controlled by the settings `stock.apiBaseUrl` and `stock.apiSource`.

---

### `GET /stock/price-board`

Real-time price board snapshot for multiple symbols.

**Query params**

| Param | Required | Description | Example |
|-------|----------|-------------|---------|
| `symbols` | Yes | Comma-separated stock symbols | `VCB,ACB,TCB` |
| `source` | No | Data source | `KBS` |

**Example**

```
GET /stock/price-board?symbols=VCB,ACB,TCB
```

**Response** `200 OK` — price board data from vnstock

---

### `GET /stock/intraday/:symbol`

Intraday matched-order data for a single symbol.

**Path params**

| Param | Description | Example |
|-------|-------------|---------|
| `symbol` | Stock symbol | `VCB` |

**Query params**

| Param | Required | Description | Default |
|-------|----------|-------------|---------|
| `page_size` | No | Max records (max 10 000) | `100` |
| `source` | No | Data source | `KBS` |

**Example**

```
GET /stock/intraday/VCB?page_size=200
```

---

### `GET /stock/history/:symbol`

Historical OHLCV prices by day, week, or month.

**Path params**

| Param | Description | Example |
|-------|-------------|---------|
| `symbol` | Stock symbol | `VCB` |

**Query params**

| Param | Required | Description | Example |
|-------|----------|-------------|---------|
| `start` | No | Start date `YYYY-MM-DD` | `2026-01-01` |
| `end` | No | End date `YYYY-MM-DD` | `2026-04-01` |
| `length` | No | Latest N sessions | `30` |
| `interval` | No | `d` / `w` / `m` | `d` |
| `source` | No | Data source | `KBS` |

**Parameter priority:**
1. `length` — latest N sessions
2. `start` + `end` — date range
3. `start` only — from start to today
4. Nothing — latest 90 sessions

**Examples**

```
GET /stock/history/VCB?start=2026-01-01&end=2026-04-01&interval=d
GET /stock/history/VCB?length=30&interval=w
```

---

### `GET /stock/listing`

Full list of all currently listed stock symbols.

**Query params**

| Param | Required | Description | Default |
|-------|----------|-------------|---------|
| `source` | No | Data source | `KBS` |

**Example**

```
GET /stock/listing
```

---

### `GET /stock/company/:symbol`

Company overview data for a listed symbol.

**Path params**

| Param | Description | Example |
|-------|-------------|---------|
| `symbol` | Stock symbol | `FPT` |

**Query params**

| Param | Required | Description | Default |
|-------|----------|-------------|---------|
| `source` | No | Data source | `KBS` |

**Example**

```
GET /stock/company/FPT
```

---

## Price Alert — How It Works

1. **Cron job** runs every minute, Monday–Friday, 09:00–15:30 ICT.
2. Fetches the price board for all `active: true` watched symbols.
3. For each symbol, calculates the `%` price change from the last known price.
4. If `|Δ%| ≥ stock.alertThresholdPercent`, sends an embed to `discord.alertChannelId`.

**Discord embed fields:**

| Field | Description |
|-------|-------------|
| Giá hiện tại | Current price (VND) |
| % Thay đổi | Signed percentage change |
| Ngưỡng cảnh báo | Configured threshold |
| Giá trước | Previous snapshot price (if available) |

**Colours:** Green (`📈 TĂNG`) for gains, Red (`📉 GIẢM`) for losses.
