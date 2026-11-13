# Srinivasa Medical Agencies

This project restores the original Srinivasa Medical Agencies workspace and keeps its design and workflow while moving the implementation to JavaScript, MongoDB, and a Python/SQLite reporting service.

## Compare and port map

| Original project file | This project |
|---|---|
| `index.html` | `index.html` — same agency branding and icon |
| `src/main.tsx` | `src/main.jsx` — JavaScript entry point |
| `src/App.tsx` | `src/App.jsx` — original workspace UI converted from TSX to JSX |
| `src/App.css` | `src/App.css` — original green workspace styling |
| `src/index.css` | `src/index.css` — original base styles |
| `server/index.ts` | `server/index.js` — same API workflows backed by MongoDB |
| SQL.js operational store | MongoDB operational collections |
| — | `reports/service.py` — Python service and SQLite reporting ledger |

The navigation, dashboard, login roles, customers, suppliers, medicines, categories, inventory, warehouse, orders, deliveries, payments, invoices, outstanding balances, sales, reports, notifications, user access, and settings are retained. Purchases and returns remain marked as not implemented, as in the original app.

## Technology

- HTML, CSS, JavaScript, React, and Vite for the browser workspace.
- Node.js, Express, and MongoDB for application data and authentication.
- Python and SQLite for the separate reporting-event ledger.

## Run locally

Requirements: Node.js 20+, Python 3.10+, and MongoDB running locally.

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5174`. The first visit prompts you to create the administrator account. The MongoDB service must be running before the Node API starts.

The browser uses Vite on port 5174; the API listens on `127.0.0.1:4100`; the reports service listens on `127.0.0.1:8001`. Vite proxies `/api` to the Express API. MongoDB stores user accounts, customers, suppliers, products, orders, and payments. The Python service only stores summary events in `reports/data/reports.sqlite`; it is not the source of truth for inventory or orders.

Copy `.env.example` to `.env` to configure the MongoDB connection and persistent signing/report secrets. Local `.env` and SQL report data are ignored by Git.

After first-time setup, **Create admin account** on the Admin Login screen requires `ADMIN_INVITE_CODE` from `.env` (at least 24 characters). Keep this code private; anyone with it can register an administrator. The initial administrator can still be created through first-time setup without an invite code.

## Validate

```powershell
npm run build
```

This is a development foundation, not a complete production medical-distribution system. Review security, backups, HTTPS, and inventory/order consistency before using real business data.
