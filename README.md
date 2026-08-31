# schwank

A local-first shared-home dashboard for nutrition, Kanban tasks, spending, organisers, and household chat.

## Data layer

All household records are stored in a durable local D1/SQLite database through `db/data.ts`. The browser only keeps temporary interface state; meals, tasks, expenses, organiser items, members, and chat messages survive app and host restarts. Local database files live under `.wrangler/state`, which should be preserved or mounted as a volume on the Orange Pi.

The schema lives in `db/schema.ts`, generated migrations live in `drizzle/`, and the API is exposed at `/api/schwank`.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Create and run a production-style local build with:

```bash
npm run build
npm start
```

To expose it to other devices on the LAN:

```bash
npm run build
npm run start:lan
```

The Git remote named `origin` points to `git@github.com:lumen-rsg/schwank.git`. Git is source control only; it is not used to host the running application.
