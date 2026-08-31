# schwank

A local-first shared-home dashboard for nutrition, hydration, habit reduction, Kanban tasks, spending, organisers, and household chat.

## Data layer

All household records are stored in a durable local D1/SQLite database through `db/data.ts`. The browser only keeps temporary interface state; accounts, sessions, meals, water, habit activity, tasks, expenses, organiser items, and chat messages survive app and host restarts. Local database files live under `.wrangler/state`, which should be preserved or mounted as a volume on the Orange Pi.

The schema lives in `db/schema.ts`, generated migrations live in `drizzle/`, and the API is exposed at `/api/schwank`.

## Accounts and privacy

Open `/register` to create the first account. Passwords are stored as salted PBKDF2-SHA-256 hashes and authentication uses seven-day, HTTP-only, same-site session cookies.

Nutrition entries, tasks, general spending, and organiser items can be private or shared. Nutrition entries are offered as shared when logging a meal, while the server still defaults missing visibility values to private. Water intake is always private to its owner. Vaping and alcohol activity, including money spent on those habits, is always visible to every signed-in housemate and cannot be made private. The API enforces these rules independently of the interface; a housemate can view a shared item but only its owner can change it. Household chat and the household profile are shared by design. No demo or mock records are seeded into the application. All money values are displayed in Russian rubles.

The interface supports English and Russian, with the preference saved in the browser. The Home screen stores a shared household name, address, and photo, plus a private account-controlled avatar for each member. Images are resized in the browser and stored in the local database so they survive restarts.

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
