# The Daily Web

## About the Project

The Daily Web is a student news website with public news browsing, a Reporter workflow for preparing articles, and an Editor workflow for reviewing and publishing them. It includes user management, authentication, and shared MongoDB logging and analytics infrastructure.

This README describes the code currently in this branch. The `/stats` page currently displays sample data; it is not yet a live monitoring dashboard. Team members should complete their sections below with details from the final merged implementation.

## Main Technologies

- Node.js and Express 5
- MongoDB and Mongoose
- EJS, HTML, CSS, and browser JavaScript
- `express-session` and `connect-mongo`
- `bcrypt` for password hashing
- `nodemon` for development
- Node.js built-in test runner (`node:test`)

# Getting Started

## Prerequisites

- Node.js with npm. The locked Mongoose dependency requires Node.js **20.19.0 or newer**; the application also uses the built-in `process.loadEnvFile()` API. No project-specific runtime version is pinned.
- A running MongoDB server, such as MongoDB Community Server.
- Git to clone the repository.

## Installation and First Demo Run (Lecturer Guide)

Follow these steps from the project root (the directory containing `package.json`). These instructions prepare a **new local demo database with articles and login accounts**. Internet access is needed to download dependencies and, optionally, retrieve live weather.

### 1. Get the project and install dependencies

Clone the repository, or open the project folder if you received an extracted project archive:

```sh
git clone https://github.com/omer0528754928-prog/the-daily-web.git
cd the-daily-web
npm install
```

Check your prerequisites with `node --version` and `npm --version`. Install development dependencies too if you plan to use `npm run dev`; `nodemon` is a development dependency. No frontend build command is required.

### 2. Start MongoDB

Make sure your local MongoDB server is running and accepting connections on port `27017`. On Windows, if MongoDB was installed as a service, open **Services**, locate the MongoDB service, and start it if stopped. MongoDB Compass is an optional database viewer; opening Compass alone does not start the MongoDB server.

### 3. Create your local configuration

For a fresh checkout, copy the example file in PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env`. If you already have a configured `.env`, edit it instead of overwriting it. Ensure the filename is exactly `.env`, not `.env.txt`.

Set the following values:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/the-daily-web
SESSION_SECRET=replace_with_your_own_random_value
WEATHER_API_KEY=
```

Replace the session-secret placeholder before starting. You can generate a value locally with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy that output into `SESSION_SECRET` and keep it private. Keep the same secret between restarts if you want existing sessions to remain usable. Weather can remain blank for the initial run; see the optional setup below.

### 4. Prepare demo articles and login accounts

**Check the database name in `MONGODB_URI` before running either command.** For a first demonstration, use a fresh local demo database, not a database containing articles you want to preserve.

Run these commands separately, in this order, and wait for each to finish successfully:

```sh
npm run seed
npm run seed:users
```

- `seed` creates/updates the article demo data from `articlesDB/articles.json` and the five base demo users, linking articles to their authors. It does not prepare login password hashes.
- `seed:users` prepares all seven demo/test accounts and adds bcrypt password hashes where missing. It preserves existing IDs, so the article-author links remain valid, and does not reset existing passwords.

Both steps are needed to reproduce the supplied article-and-login demo on an empty database. Running only `seed:users` gives you accounts but no demo articles. Running only `seed` does not prepare usable demo passwords for newly created users.

**Do not repeat the general seed on every startup.** It can overwrite existing demo article edits and workflow states. It also synchronizes indexes and removes the legacy top-level `publishedAt` field. See the script table below for details. Neither a Stats seed nor a monitoring test-log command is required to start the application.

### 5. Start and open the application

```sh
npm start
```

Wait for:

```text
MongoDB connected
Server running on http://localhost:3000
```

Keep this terminal open and visit [http://localhost:3000](http://localhost:3000). If you set a different `PORT`, use that port in the browser.

### 6. Verify the demo

- Open the home page and a published demo article without logging in.
- Open [the login page](http://localhost:3000/login).
- For Reporter access, use username `reporter01` and initial password `reporter01`.
- Log out, then use username `editor01` and initial password `editor01` for Editor access.
- These passwords apply to freshly prepared accounts; rerunning `seed:users` does not reset an existing password.
- The Weather Widget may display an unavailable message without a key. The rest of the site should still work.
- The current Stats page contains sample data; a live analytics dashboard is not a prerequisite for this demo.

### Later runs and stopping the server

After the first setup, ensure MongoDB is running, open the project directory, and run `npm start`. You do not need to reinstall unchanged dependencies or run the seeds again. Stop the application with `Ctrl+C` in its terminal. Do not start another copy on the same port.

## Environment Variables

The application loads `.env` using `process.loadEnvFile()`.

| Variable | Description |
| --- | --- |
| `MONGODB_URI` | MongoDB connection URI used by the application and session store. The example uses `mongodb://127.0.0.1:27017/the-daily-web`. |
| `SESSION_SECRET` | Private signing secret for session cookies. Set a strong value locally; never commit it. |
| `WEATHER_API_KEY` | Optional OpenWeather API key for Oz's (Member 2) Weather Widget. See the setup below; the rest of the site runs without it. |
| `PORT` | Optional server port read by `app.js`; defaults to `3000`. Supported in code but not listed in `.env.example`. |

Do not copy actual credentials into documentation. `.env` is ignored by Git; `.env.example` is the shared configuration template.

## Optional: Enable Live Weather

The current code calls OpenWeather's **Current Weather Data** and **5 Day / 3 Hour Forecast** APIs at `/data/2.5/weather` and `/data/2.5/forecast`. It uses fixed coordinates in Tel Aviv, metric units, and Hebrew descriptions; browser location permission is not required.

1. [Create an OpenWeather account](https://home.openweathermap.org/users/sign_up) and verify your email.
2. Open your account's [API Keys page](https://home.openweathermap.org/api_keys) and copy your personal API key. Ensure your account has access to the two APIs above. Follow the provider's [getting-started instructions](https://openweathermap.org/appid) and [FAQ](https://openweathermap.org/faq) for activation/account issues.
3. In your local `.env`, replace the empty value:

   ```env
   WEATHER_API_KEY=your_actual_api_key
   ```

4. Save the file. Stop the application with `Ctrl+C`, then start it again with `npm start` (or `npm run dev`). Restart explicitly after changing `.env`; do not rely on automatic file watching.
5. Refresh the home page to check the Weather Widget. This needs an internet connection and a working key; the database seeds do not configure weather.

If the team provides a demo key privately, enter it in the same place instead of creating a new account. Do not assume a working key is included in the repository. Leave `.env.example` empty and never commit an actual key. OpenWeather applies usage limits at the account level: separate keys under one account still share its quota ([provider documentation](https://openweathermap.org/appid)).

Without a key, the service returns no weather/forecast and the widget displays its unavailable state. A provider/network failure also has a fallback rather than making weather a startup requirement. Successful data is cached in server memory for about 14.5 minutes to reduce requests; a recent failed request has a one-minute retry delay. Restarting clears that cache. More details are in [Oz's section](#member-2--oz--home-feed--weather).

## Startup Troubleshooting

| Symptom | What to check |
| --- | --- |
| `node` or `npm` is not recognized | Install the required Node.js version with npm, then open a new terminal. |
| Missing module/dependency | Run `npm install` from the directory containing `package.json`. |
| `nodemon` is missing | Run `npm install --include=dev`, or use `npm start`, which does not need nodemon. |
| Missing `.env` or session-secret error | Create the local file and replace the secret placeholder with a non-empty private value. Run commands from the project root. |
| MongoDB connection error | Check that the MongoDB server is running, the port is correct, and `MONGODB_URI` targets the intended database. |
| Port already in use (`EADDRINUSE`) | Stop your previous application process, or add e.g. `PORT=3001` to `.env` and open `http://localhost:3001`. |
| Empty article feed on a new database | Confirm the intended database was seeded using both commands in step 4. Do not overwrite an existing working database just to populate the feed. |
| Demo login fails | Confirm `seed:users` completed on the same database used by the server. Existing passwords are preserved and soft-deleted users are skipped. |
| Weather is unavailable | Check the key, account activation/API access, internet connection, and provider quota. Restart after changing `.env`; do not share the key in screenshots. The rest of the demo can continue without weather. |

## Database Setup

The project uses MongoDB through Mongoose. The default local example is:

```text
mongodb://127.0.0.1:27017/the-daily-web
```

MongoDB must be running before starting the application or database utility scripts. Collections are created by the application libraries as needed; there is no manual collection setup step.

Users, articles, comments, sessions, operational logs, and usage events use the same application database. Monitoring does not require a separate database or server.

## Running the Application

```sh
npm start
```

Starts `app.js` with Node.js.

```sh
npm run dev
```

Starts the same application with `nodemon`, which restarts the server after code changes.

# Available npm Scripts

| Command | Purpose and database effects |
| --- | --- |
| `npm start` | Start the server. Normal application requests can write data and sessions. |
| `npm run dev` | Start the server with automatic restarts during development. |
| `npm run seed:users` | Write/update the seven predefined users. Preserve existing IDs and password hashes; skip soft-deleted users. Does not seed articles. |
| `npm run seed` | Write/update demo users and articles from `articlesDB/articles.json`. Existing articles matched by `legacyId` can be overwritten, including content, status, timestamps, public versions, and parent links. Also synchronizes User/Article indexes and removes the old top-level `publishedAt` field. Use only on an intended demo database. |
| `npm test` | Run the automated test suite using Node.js's built-in test runner. |
| `npm run monitor:users` | Read-only count of distinct active authenticated users. Does not create collections/indexes through this command. |
| `npm run monitor:test-log` | Intentionally add one manual test OperationalLog document on each successful run. Prints `Log saved: true` or a failure result. |

`seed:stats` is **not available in this branch**. Do not run it based on documentation from another branch. The general seed does not replace `seed:users` for preparing password hashes.

# Demo Users

Run `npm run seed:users` to prepare these accounts:

| Username | Name | Role | Initial password |
| --- | --- | --- | --- |
| `reporter01` | דנה לוי | reporter | `reporter01` |
| `reporter02` | עומר שגב | reporter | `reporter02` |
| `reporter03` | רותם אבן | reporter | `reporter03` |
| `reporter04` | נועה גל | reporter | `reporter04` |
| `editor01` | איתן ברק | editor | `editor01` |
| `test_reporter` | Test Reporter | reporter | `test_reporter` |
| `test_editor` | Test Editor | editor | `test_editor` |

These are development/test credentials. New users, or users missing a hash, receive `bcrypt.hash(username, 10)`; plaintext passwords are not stored.

For existing active users, the script updates the demo name/role while preserving `_id`, `createdAt`, and any existing password hash. It does not reset a changed password. Soft-deleted users are skipped without reactivation. The script always attempts to disconnect from Mongoose.

# User Roles

## Guest

A guest is an unauthenticated visitor, not a stored User role. Public routes allow reading the feed and published articles and submitting comments. In the current code, `/stats` is also a public sample-data page.

## Reporter

An authenticated Reporter can access the Reporter area and its API. Ownership and editable-state middleware restrict article operations. Detailed workflow documentation belongs to Member 4.

## Editor

An authenticated Editor can access the Editor review/actions and User CRUD API. Reporter routes currently also allow Editors, while article ownership checks still apply. Detailed review/publishing behavior belongs to Member 5.

TODO – Final permissions review after all team features are integrated.

# Authentication and Sessions

Member 1's authentication flow is:

```text
POST /login -> validate input -> find active User -> bcrypt verification
-> regenerate session -> save session in MongoDB -> record login event -> redirect
```

- `GET /login` renders the login form. `POST /login` checks credentials through `authService` and `authValidator`.
- Soft-deleted users and users without a valid password hash cannot authenticate. Passwords are checked with `bcrypt.compare`.
- Successful login redirects Editors to `/editor` and Reporters to `/reporter`.
- `POST /logout` destroys the session, clears the `connect.sid` cookie, and redirects to `/login`. The shared header offers a confirmation dialog before submitting this form.
- `express-session` uses `connect-mongo` to persist sessions in the `sessions` collection. An unexpired session can survive a server restart when the database, cookie, and signing secret remain available and unchanged.

The session's application user data is:

```js
{ id, name, username, role }
```

It contains no password or hash. `loadSessionUser` reloads the active user from MongoDB before application routes, refreshes session fields, and sets `res.locals.currentUser`. Role changes therefore apply on subsequent requests. A missing or soft-deleted user loses the authenticated session user; a database lookup failure goes to error handling instead of allowing stale permissions.

Sessions use `resave: false`, `saveUninitialized: false`, and `rolling: true`. Cookies have a **10-minute** `maxAge`, `httpOnly: true`, and `sameSite: 'lax'`.

For logged-in users, the shared header sends `POST /session/keep-alive` every four minutes only while `document.visibilityState === 'visible'`. An authenticated request returns 204; an unauthenticated request returns 401 and the browser redirects to login. Guests do not run this timer. Activity renews the session; a visible page can keep it alive even without clicks. Without requests, the session expires after the inactivity window. This is not precise presence tracking, and browser/network suspension can prevent keep-alive requests.

# User Management

`models/User.js` defines `name`, a unique normalized `username`, `passwordHash`, `role`, `isDeleted`, and automatic `createdAt`/`updatedAt` timestamps. `passwordHash` is excluded from normal queries with `select: false`; older documents may lack it. Supported stored roles are `reporter` and `editor`.

All User CRUD endpoints require Editor authorization:

| Method and path | Behavior |
| --- | --- |
| `POST /api/users` | Create a user; return 201. |
| `GET /api/users` | List active users with pagination; supports partial username search through `?username=...`. |
| `GET /api/users/:id` | Read one active user. |
| `PATCH /api/users/:id` | Update supplied user fields; hash a supplied new password. |
| `DELETE /api/users/:id` | Soft-delete the user; return 204 with no response body. |

Create accepts `name`, `username`, `password`, and `role`; update accepts a non-empty subset. Validation rejects unknown fields, invalid roles/IDs, and passwords exceeding bcrypt's 72-byte limit. Duplicate usernames return 409. Missing or soft-deleted users return 404 on individual CRUD operations; invalid IDs return 400.

Soft delete sets `isDeleted: true`, preserving the document and its ID. Active queries use `isDeleted: { $ne: true }`, so legacy users without this field remain active. Deleted users disappear from active lists and authentication.

The flow is `usersRoutes -> usersController -> userService -> userValidator/User -> userApiPresenter`. The presenter exposes only `id`, `name`, `username`, `role`, `isDeleted`, `createdAt`, and `updatedAt`; it never returns passwords or hashes.

# Authorization

`requireLogin` enforces authentication. `requireRole(...roles)` additionally checks allowed roles. For API requests they use 401 for unauthenticated access and 403 for disallowed roles; HTML guests are redirected to login. The shared role middleware returns a forbidden message for unauthorized HTML access.

Critical User, Reporter, and Editor operations are protected on the server, independently of navigation visibility. Editor routes currently use their own `requireEditorPage` guard to render the designed 403 page. `loadSessionUser` runs before these routes. The legacy `devAuth.js` file is not mounted in `app.js`.

TODO – Final permissions review after all team features are integrated, including the currently public sample Stats route.

# Monitoring and Logging

## Operational Logging

`OperationalLog` stores operational errors and selected events in the existing MongoDB database (`operationallogs`). Its fields are `level`, `source`, `event`, `message`, optional `userId`, `method`, `path`, `statusCode`, and `createdAt`.

`recordLog(values)` in `services/loggingService.js` accepts these explicit fields. It returns true on success or false on failure, with a minimal console fallback. Callers must supply controlled messages and paths, never secrets, full requests, bodies, headers, cookies, or session contents.

The global error handler automatically records normalized server errors with status 500 or higher, using the fixed message `Unexpected server error`, a valid user ID when available, the request method, and a route pattern when available. Normal 4xx errors are not automatically recorded. Logging is not awaited before the HTTP response. The handler separately prints the original server error to the developer console, so console output should also be treated carefully.

Editor actions already call this shared service for edit, approve, return, and delete events. Errors handled locally by screen controllers are not automatically collected by the global handler; each screen owner should integrate appropriate logging.

## Usage Analytics Infrastructure

`recordUsageEvent(values)` in `services/analyticsService.js` writes `UsageEvent` documents to `usageevents`. Supported fields are `type`, `source`, optional `userId`, `articleId`, and a small controlled `value`; `createdAt` defaults to the current time. Source/value limits are 100/200 characters.

| Event type | Infrastructure support | Current integration in this branch |
| --- | --- | --- |
| `login` | Supported | Recorded once after successful authentication and session save. Failed login does not record it. |
| `article_view` | Supported | Not yet connected to the article controller. |
| `comment_created` | Supported | Not yet connected. |

The service whitelists event types and explicit fields. Invalid input or storage failure returns false without throwing into the business flow; failures use a minimal console message. It is not an automatic sanitizer for secrets placed inside allowed strings: callers must pass controlled values only. Successful login does not wait for analytics storage before redirecting.

Screen owners should add their own event calls when their features are ready. Infrastructure support alone does not mean an event is already being recorded.

## Active Authenticated Users

`getActiveAuthenticatedUserCount()` in `services/sessionMonitoringService.js` reads the existing `sessions` collection through the current Mongoose connection. It:

- Selects sessions whose expiration is in the future.
- Safely reads/parses session data and ignores malformed records or invalid user IDs.
- Counts distinct authenticated user IDs, so multiple sessions for one user count once.
- Excludes missing and soft-deleted users while accepting legacy users without `isDeleted`.

It does not create a model/collection, expose session contents, or change expiry. Database/query failures propagate to the caller rather than appearing as a misleading zero. This count means **users with valid authenticated sessions**, not users visibly looking at a tab at this instant. Run `npm run monitor:users` for the read-only utility.

# Error Handling

`utils/HttpError.js` carries HTTP status/details. Controllers and services can throw errors for the central `middleware/errorHandler.js` to handle. Mongoose validation/cast errors are normalized to 400; unmatched routes return 404.

API errors return JSON with `error` and optional `details`; server errors use a generic client-facing message. HTML errors use Hebrew messages, including a form-problem page when validation details exist. Unexpected server errors integrate with OperationalLog as described above. Some controllers handle expected errors locally, such as failed login and Editor form validation.

# Project Architecture

The usual flow is:

```text
Routes -> Middleware -> Controllers -> Services -> Validators / Models
                                  -> Presenters -> Views or JSON responses
```

Routes select handlers and access checks. Controllers read requests and send responses; services implement application operations. Validators check input, models define MongoDB data, and presenters shape output. Not every endpoint needs every layer; there is no separate monitoring server.

# Project Structure

```text
config/       Database connection, categories, and shared article constants
controllers/  HTTP handlers for pages and APIs
middleware/   Authentication, authorization, parsing, filters, and error handling
models/       Mongoose schemas
presenters/   Data shaping for views and API output
validators/   Input validation
routes/       Page and API route definitions
services/     Business operations and shared infrastructure
scripts/      Database seeds and monitoring utilities
articlesDB/   Source JSON used by the general article seed
public/       CSS, browser JavaScript, images, and uploaded assets
views/        EJS pages and shared partials
tests/       Automated tests
utils/        Shared helpers such as HttpError
app.js        Express setup, session store, middleware, and startup
package.json  Dependencies and npm commands
```

# Testing

```sh
npm test
```

This runs `node --test "tests/**/*.test.js"`. The currently saved suite covers the weather service, weather widget browser behavior, and EJS rendering, using test doubles where needed. It is not a complete Auth/User/Monitoring integration suite. The monitoring utilities above are separate manual checks; `monitor:test-log` writes to the configured database.

TODO – Each member should document their final automated/manual coverage and remaining integration checks without relying on a fixed test count.

# Team Responsibilities

## Member 1 – Omer

The shared infrastructure responsibility assigned to Omer includes these implemented components:

- Core Express setup and MongoDB/Mongoose connection configuration.
- Environment configuration and the shared setup template.
- User schema, role definitions, User CRUD, validation, and safe API presentation.
- Demo-user seed with bcrypt hashes and preservation of existing identities/passwords.
- Login/logout, bcrypt verification, and session regeneration on login.
- MongoDB-backed sessions with connect-mongo, restart persistence, inactivity timeout, and visible-page keep-alive.
- Session-user reloading, soft-delete handling, and shared login/role authorization middleware.
- OperationalLog model/service and integration into central server-error handling.
- UsageEvent model/service and successful-login recording.
- Read-only active authenticated-user monitoring and the two monitoring utility scripts.

These shared services are available to screen owners; their screen-specific integrations and documentation remain their responsibility.

## Member 2 – Oz – Home Feed & Weather

### Home Feed

The home page (`GET /`) shows articles an Editor has approved at least once, with a lead story, side stories, and a grid. It also has a ticker of the four newest articles and a "הנצפות ביותר" sidebar (top five by views). The server renders the first 20 cards; `public/js/feed.js` loads more from `/api/feed` as the reader scrolls (infinite scroll), with a retry button if a batch fails.

Filters are query parameters, applied without a page reload and kept in the URL (Back/Forward and shared links work):

- `category`: one of `config/categories.js`.
- `q`: case-insensitive partial-word search in the title or summary (up to 100 characters).
- `sort`: `date` (default) or `popular`.
- `view=unseen`: hides articles already opened in this browser. `public/js/readArticles.js` keeps the last 200 opened article IDs in `localStorage`; nothing is stored on the server.

Invalid values return 400.

### Weather Widget

The home page shows the current weather in Tel Aviv plus a four-day forecast; the article page shows a small current-weather widget. `services/weatherService.js` calls OpenWeather (needs `WEATHER_API_KEY`, see [Optional: Enable Live Weather](#optional-enable-live-weather)).

- Responses are cached in server memory for 14.5 minutes, and simultaneous requests share one API call.
- Calls time out after 2.5 seconds; after a failure the API is not called again for a minute.
- Expired data is never shown: the widget says the weather is unavailable, and the page still renders.
- `public/js/weather.js` refreshes the widget in the browser when the cache expires, and pauses while the tab is hidden.

### Routes

All public:

| Route | Returns |
| --- | --- |
| `GET /` | Home page. |
| `GET /api/feed` | Next batch of feed cards as JSON. Same filters, plus `limit` and `skip`. |
| `GET /weather-widget` | Home page widget HTML, for the browser refresh. |
| `GET /weather-widget/small` | Article page widget HTML. |

### Monitoring

Weather failures are only logged to the console, not to `OperationalLog`.

### Tests

`npm test` runs the weather tests: the service's caching and failure handling (`weatherService.test.js`), the browser refresh (`weatherWidgetClient.test.js`), and the widget rendering (`weatherWidgetPartial.test.js`). The feed, search and filters have no automated tests.

### Limitations

- Weather is for one fixed location (Tel Aviv).
- The weather cache is in server memory, so a restart clears it.
- The "unseen" list is per browser and is lost when browser data is cleared.

## Member 3 – Article Page & Comments

> TODO – Member 3: Add final Article Page & Comments documentation.

Document the article route/display, comments and validation, view counting, `article_view` integration, guest/authenticated behavior, relevant routes/tests, error handling, and limitations. Distinguish existing article fields from events actually recorded by monitoring.

## Member 4 – Reporter Area

> TODO – Member 4: Add final Reporter Area documentation.

Document the dashboard, article creation/editing, autosave, validation, statuses/workflow, published-article updates, routes/tests, Reporter permissions, and limitations.

## Member 5 – Editor Area & Impact Analytics

> TODO – Member 5: Add final Editor Area & Analytics documentation.

Document the dashboard/review queue, pending-article editing, approve/publish, return to Reporter, deletion, permissions, Impact Analytics, article selector, view analytics, monitoring data sources, graphs/KPIs, routes/tests, and limitations. Clearly distinguish the current sample Stats page from any final live-data implementation.

# Adding Your Team Section

Each member should:

1. Update only their own section.
2. Describe only final merged functionality.
3. Mention important routes/API endpoints.
4. Mention required environment variables.
5. Mention relevant tests.
6. Explain integration with shared authentication/monitoring services.
7. Avoid large code blocks.
8. Keep the description concise and understandable.

# Current Project Status

## Completed

The current code includes shared User CRUD, authentication and MongoDB sessions, role middleware, operational logging, usage-event storage with login integration, and active-session counting utilities. Public browsing/comments and Reporter/Editor routes are present. These statements describe implementation presence, not a claim that every integration scenario has passed final acceptance testing.

## In Progress / Needs Final Verification

- TODO – Final permissions review after all team features are integrated.
- TODO – Team members' final feature documentation and end-to-end acceptance checks.
- TODO – Screen-owned usage-event integrations beyond login.
- TODO – Confirm the final live Stats/Impact Analytics integration; this branch still uses sample data.
- Needs confirmation – Final responsive/browser testing and overall release readiness are not established by the repository alone.

# Security Notes

- Passwords created by User CRUD and the demo-user seed are stored as bcrypt hashes.
- Keep secrets/API keys in local configuration; never commit `.env` or copy credentials into logs.
- Sensitive operations use server-side authorization; hidden buttons alone are not access control.
- Demo passwords are for development/testing and should not be used for real accounts.

# Final Notes

This README follows the current branch, not unmerged features from other branches. TODO sections identify information that needs the owning member's confirmation. Update the relevant documentation after integrations merge, especially monitoring events, Stats behavior, and final permissions.
