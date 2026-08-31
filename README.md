# schwank

A private shared-home dashboard for nutrition, Kanban tasks, spending, organisers, and household chat.

## Data layer

All household records are stored in a durable D1/SQLite database through `db/data.ts`. The browser only keeps temporary interface state; meals, tasks, expenses, organiser items, members, and chat messages survive app and host restarts.

The schema lives in `db/schema.ts`, generated migrations live in `drizzle/`, and the API is exposed at `/api/schwank`.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```
