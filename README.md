# schwank

A local-first shared-home server and client suite for food and recipe storage, nutrition, hydration, habit reduction, Kanban tasks, spending, organisers, and household chat.

## Server and clients

The Orange Pi is the household server and the single source of truth. It owns the database, accounts, uploads, AI access, and API while continuing to support ordinary browsers. The Electron desktop client connects to that LAN server and is packaged for Apple Silicon macOS, x86-64 Linux, and x86-64 Windows. Its first-run screen makes selecting the server address a one-time step, and new chat messages can use native desktop notifications.

Electron does not run on iOS or Android. A future mobile client can reuse the same server API. See [`docs/desktop.md`](docs/desktop.md) for Orange Pi setup, desktop usage, security details, installer commands, and the multi-platform GitHub Actions workflow.

## Data layer

All household records are stored in a durable local D1/SQLite database through `db/data.ts`. The browser only keeps temporary interface state; accounts, sessions, food batches, recipes, meals, water, habit activity, tasks, expenses, organiser items, and chat messages survive app and host restarts. Local database files live under `.wrangler/state`, which should be preserved or mounted as a volume on the Orange Pi.

The schema lives in `db/schema.ts`, generated migrations live in `drizzle/`, and the API is exposed at `/api/schwank`.

## Accounts and privacy

Open `/register` to create the first account. Passwords are stored as salted PBKDF2-SHA-256 hashes and authentication uses seven-day, HTTP-only, same-site session cookies.

Nutrition entries, tasks, general spending, and organiser items can be private or shared. Nutrition entries are offered as shared when logging a meal, while the server still defaults missing visibility values to private. Water intake is always private to its owner. Vaping and alcohol activity, including money spent on those habits, is always visible to every signed-in housemate and cannot be made private. Nutrition calculator measurements and plans are private and never included in household-member responses. The API enforces these rules independently of the interface; a housemate can view a shared item but only its owner can change it. Food inventory and recipes are household resources, so every signed-in housemate can view and maintain them. Household chat and the household profile are shared by design. No demo or mock records are seeded into the application. All money values are displayed in Russian rubles.

## Food storage and recipes

Inventory is stored as individual batches, allowing the same product to have different units or expiry dates. Housemates can search stock, adjust quantities, and see expired or soon-to-expire food. Recipes contain servings, instructions, one or more ingredients, and one of six sections: breakfasts, starters, main courses, dinners, salads, or desserts. Recipe cards scale their ingredient lists to three people and compare every ingredient with the combined non-expired household inventory; mass (`g`/`kg`) and volume (`ml`/`l`) units are converted automatically. Ingredient names are matched after whitespace and case normalization, and the recipe editor suggests names already in inventory.

The shared weekly planner uses adjustable per-course frequencies, with defaults of seven breakfasts, three starters, three main courses, seven dinners, seven salads, and two desserts. Its randomiser spaces less-frequent courses across the week, saves the resulting plan for the household, and scales every meal to three portions. The complete shopping list combines matching ingredients across the entire plan and subtracts usable food already in storage.

## AI weekly planner

The optional AI planner generates a reviewable weekly menu from non-expired household inventory, saved recipes, course frequencies, cuisine ideas, explicit inclusions/exclusions, and the cook's notes. Applying a proposal stores its new recipes and weekly schedule in the local database, after which the regular shopping-list calculator handles the result.

AI calls are explicit and server-side. No request is made until a signed-in cook presses the generate button, the API key is never sent to the browser, and provider-side response storage is disabled for these requests. Inventory and shared recipes are household data. Private nutrition is opt-in per person and is sent without names, email addresses, age, sex, height, or weight; only calorie/macronutrient goals, diet/plan, and seven-day daily totals are included. A cook may include their own data for one request without enabling ongoing consent for housemates' future plans.

Copy the example and add a server-side API key:

```bash
cp .dev.vars.example .dev.vars
```

`AI_PROVIDER` supports `deepseek` and `openai`. The checked-in example selects DeepSeek with `deepseek-v4-pro`; use the provider's corresponding model name when selecting OpenAI. Restart the local server after changing `.dev.vars`. Keep `.dev.vars` private when moving the app to the Orange Pi; it is ignored by Git.

## Nutrition calculator

The calculator uses the 2023 National Academies adult Estimated Energy Requirement equations with age, formula sex, height, weight, and activity level. Lose/gain plans apply a modest 10% starting adjustment, and protein/fat/carbohydrate targets stay within the adult Acceptable Macronutrient Distribution Ranges. Suggested products are adapted to the selected weight plan and omnivore, vegetarian, or vegan preference. Results are estimates for adults and are not a substitute for medical or dietetic advice.

The interface supports English and Russian, with the preference saved in the browser. The Home screen stores a shared household name, address, and photo, plus a private account-controlled avatar for each member. Images are resized in the browser and stored in the local database so they survive restarts.

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
