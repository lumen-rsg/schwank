# schwank

A local-first shared-home server and client suite for food and recipe storage, nutrition, hydration, habit reduction, Kanban tasks, spending, organisers, and household chat.

## Server and clients

The Orange Pi is the household server and the single source of truth. It owns the database, accounts, uploads, AI access, and API while continuing to support ordinary browsers. The Electron desktop client connects to that LAN server and is packaged for Apple Silicon macOS, x86-64 Linux, and x86-64 Windows. Its first-run screen makes selecting the server address a one-time step; afterward it can remain in the system tray, receive privacy-safe live household changes, and deliver native notifications in the background.

Electron does not run on iOS or Android. A future mobile client can reuse the same server API. See [`docs/desktop.md`](docs/desktop.md) for Orange Pi setup, desktop usage, security details, installer commands, and the multi-platform GitHub Actions workflow.

The Pass 8 operations runbook covers versioned health checks, privacy-safe
structured logs, bounded journals, encrypted scheduled backups, and restore
drills in [`docs/operations.md`](docs/operations.md).

## Data layer

All household records are stored in a durable local D1/SQLite database behind the stable `db/data.ts` facade. Reads, household mutations, food-planning mutations, and input validation live in separate repository/service modules. The browser only keeps temporary interface state; accounts, sessions, food batches, recipes, meals, water, habit activity, tasks, expenses, recurring payments, organiser items, and chat messages survive app and host restarts. Local database files live under `.wrangler/state`, which should be preserved or mounted as a volume on the Orange Pi.

The schema lives in `db/schema.ts` and the checked-in SQL history in `drizzle/` is the single migration source of truth. `npm run db:generate` refreshes both that history and the Worker-compatible `db/runtime-migrations.json` bundle. Builds reject stale bundles. Fresh databases replay the versioned SQL; databases from before the runner are baselined once without replaying destructive historical statements. Initial bootstrap remains compatible through `/api/schwank`; successful mutations return only their revalidated privacy-scoped section. Live changes use the same `/api/data` sections, chat uses `/api/chat`, and older spending or health/activity rows use stable date-and-ID cursors through `/api/spending` and `/api/history`.

## Accounts and privacy

Open `/register` to create the first account. Passwords are stored as salted PBKDF2-SHA-256 hashes and authentication uses seven-day, HTTP-only, same-site session cookies.

Nutrition entries, tasks, general spending, recurring payments, and organiser items can be private or shared. Nutrition entries default to private; explicitly shared meals appear in the household's current-day view, while each member's longer history remains owner-only. Private nutrition and water histories load editable records in stable 100-row pages while compact server-side daily summaries keep every 7/30/90-day chart and total exact. Water intake and its 90-day history are always private to the owner. Vaping and alcohol activity, including money spent on those habits, is always visible to every signed-in housemate and cannot be made private, but only the record's author can correct or delete it. Public habit rows and private medication-dose rows load in 24-record pages; compact server-side aggregates keep the complete 12-week heatmaps, habit spending, and 14-day adherence exact before older rows are opened. Nutrition calculator measurements and plans are private and never included in household-member responses. The API enforces these rules independently of the interface; a housemate can view a shared item but only its owner can change it. Food inventory and recipes are household resources, so every signed-in housemate can view and maintain them. Household chat is shared by design, with persistent per-user unread state, 50-message pagination, reconnect recovery, author-only correction/deletion, and a 365-day server retention window. The household profile is shared for viewing and owner-controlled for changes. No demo or mock records are seeded into the application. All money values are displayed in Russian rubles.

Each member can download a private JSON export containing only their profile, records, and contributions. Account deletion requires the current password and typed email confirmation. It erases personal records and public contributions, anonymizes authorship on retained household-global pantry/recipe/menu data, transfers ownership when necessary, and resets all shared data when the final account is deleted. The complete policy matrix and deletion rules live in [`docs/authorization-policy.md`](docs/authorization-policy.md).

## Money tracking

Expenses use stable categories and can be filtered or sorted by date and amount. The spending wheel shows the loaded visible total split by category and doubles as a category filter. The newest 100 authorized expenses load initially; older pages are requested explicitly while the dashboard retains exact server-calculated count and total summaries. Rent, subscriptions, and loan payments can be scheduled monthly or yearly; loans may also include a remaining balance. Recording a scheduled payment creates its expense, advances the due date, and reduces the loan balance. Active yearly commitments are normalized to a monthly amount in the summary.

## Food storage and recipes

Inventory is stored as individual batches, allowing the same product to have different units or expiry dates. Housemates can search stock, adjust quantities, and see expired or soon-to-expire food. Recipes contain servings, instructions, one or more ingredients, and one of six sections: breakfasts, starters, main courses, dinners, salads, or desserts. Recipe cards scale their ingredient lists to three people and compare every ingredient with the combined non-expired household inventory; mass (`g`/`kg`) and volume (`ml`/`l`) units are converted automatically. Ingredient names are matched after whitespace and case normalization, and the recipe editor suggests names already in inventory.

The shared weekly planner uses adjustable per-course frequencies, with defaults of seven breakfasts, three starters, three main courses, seven dinners, seven salads, and two desserts. Its randomiser spaces less-frequent courses across the week, saves the resulting plan for the household, and scales every meal to three portions. The complete shopping list combines matching ingredients across the entire plan and subtracts usable food already in storage.

## AI weekly planner

The optional AI planner generates a reviewable weekly menu from non-expired household inventory, saved recipes, course frequencies, cuisine ideas, explicit inclusions/exclusions, and the cook's notes. A compact live-output window shows connection, context, provider, and validation stages plus the structured response as it streams in; private model reasoning is never displayed. Applying a validated proposal stores its new recipes and weekly schedule in the local database, after which the regular shopping-list calculator handles the result.

AI calls are explicit and server-side. No request is made until a signed-in cook presses the generate button, the API key is never sent to the browser, and provider-side response storage is disabled for these requests. Inventory and shared recipes are household data. Private nutrition is opt-in per person and is sent without names, email addresses, age, sex, height, or weight; only calorie/macronutrient goals, diet/plan, and seven-day daily totals are included. A cook may include their own data for one request without enabling ongoing consent for housemates' future plans.

Copy the example and add a server-side API key:

```bash
cp .dev.vars.example .dev.vars
```

`AI_PROVIDER` supports `deepseek` and `openai`. The checked-in example selects DeepSeek with `deepseek-v4-pro`; use the provider's corresponding model name when selecting OpenAI. DeepSeek generation uses the provider's full 384K output-token ceiling and a longer streaming window so large structured plans are not cut off at the former 16K limit. Restart the local server after changing `.dev.vars`. Keep `.dev.vars` private when moving the app to the Orange Pi; it is ignored by Git.

## Nutrition calculator

The calculator uses the 2023 National Academies adult Estimated Energy Requirement equations with age, formula sex, height, weight, and activity level. Lose/gain plans apply a modest 10% starting adjustment, and protein/fat/carbohydrate targets stay within the adult Acceptable Macronutrient Distribution Ranges. Suggested products are adapted to the selected weight plan and omnivore, vegetarian, or vegan preference. Results are estimates for adults and are not a substitute for medical or dietetic advice.

The interface supports English and Russian, with the preference saved in the browser. The Home screen stores an owner-managed household name, address, and photo, plus a private account-controlled avatar for each member. Owners can rotate or close invitations, transfer ownership, and remove a member with password and typed-name confirmation. JPEG, PNG, and WebP images are resized through a browser canvas to strip metadata, then the server independently verifies decoded size, file signature, container structure, and dimensions before storing them locally.

The medication tracker is private by default and supports explicit household sharing, editable daily schedules and treatment dates, optional dose-supply and refill thresholds, pausing, deletion, dose undo, and a private 14-day adherence summary backed by 90 days of recorded history. Sharing a medication exposes its schedule, instructions, supply state, and today's taken state to housemates; the owner's longer dose archive and adherence remain private. It records schedules and user actions only; it does not diagnose or recommend treatment. General reminders follow the same privacy rule. The notification bell combines medication doses, low refill supply, reminders, dated Kanban tasks, scheduled payments, and unread chat. Each user privately controls categories, advance notice, and timezone-aware quiet hours, can snooze an individual event, and gets duplicate-safe delivery state persisted in SQLite across restarts. Notification clicks open and focus the exact record. A five-second privacy-scoped change feed replaces unconditional full-dataset polling; chat-only changes use a smaller snapshot, reconnect and tab visibility perform a safe full catch-up, and a separate 30-second local clock activates newly due events without rereading household data. Electron remains active in the tray with background throttling disabled, while secure browser contexts can opt into browser notifications and the in-app bell remains available on plain LAN HTTP. Native alerts for private records use generic text so medication, task, reminder, and payment details are not exposed on a lock screen.

The household wishlist is always shared. Any member can suggest a purchase with an optional description and estimated price, cast one vote for or against it, change or withdraw that vote, and see how everyone voted. Ideas can be sorted by support, recency, or price. The person who suggested an item can edit it, mark it bought, archive it, or return it to voting; archived ideas remain in household history.

Organiser items and reminders are private by default and can be shared explicitly. Their creator can correct or delete them. Reminders support one-time, daily, weekly, and monthly schedules, bounded snooze choices, chronological active/completed views, and duplicate-safe conversion of a one-time reminder into a Kanban task. Converted tasks keep the reminder's privacy and remain after the reminder is deleted.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run server:dev
```

Create and run a production-style local build with:

```bash
npm run server:build
npm run server:start
```

To expose it to other devices on the LAN:

```bash
npm run server:build
npm run server:start:lan
```

The Git remote named `origin` points to `git@github.com:lumen-rsg/schwank.git`. Git is source control only; it is not used to host the running application.

The current clean Fedora-family ARM64 board uses the deployment profile in
[`deploy/fedora/README.md`](deploy/fedora/README.md). The older Ubuntu profile
is retained for portability but must not be used for the `lumina` account.
