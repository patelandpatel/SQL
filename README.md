# SQL Practice Lab

A local dataset library with SQL exercises, an editor, optional solutions, query plans, and executable test cases. Open **http://localhost:3000** and choose a dataset.

## Start and stop

```sh
cd /Users/parthpatel/Downloads/sql-practice
npm start
```

Stop with Ctrl+C. PostgreSQL must be running (`brew services start postgresql@17`). If port 3000 is occupied, stop the previous app or use `PORT=3001 npm start`. Refresh the browser after updating the app. After changing client.js, run `npm run build`; server changes require a restart. All dependencies and assets are local; there is no CDN or account requirement.

The original `/Users/parthpatel/Downloads/spotify` folder is preserved. Its original app can be restarted separately using `npm start` in `spotify/sql-lab` after freeing port 3000. The new app has its own dependency installation and copied exercise definitions; it does not depend on files in the old folder.

## Datasets and storage

| Dataset | PostgreSQL database | Schema | Role | Contents |
|---|---|---|---|---|
| Spotify | spotify | public | spotify_practice | Existing 953-row table, 37 exercises |
| Danny’s Diner | dannys_diner | dannys_diner | diner_practice | 15 sales, 3 menu rows, 2 members; 12 exercises |
| Diner edge tests | dannys_diner_test | dannys_diner | diner_practice | 20 synthetic sales, same menu and members |

The Diner sample is from [Danny Ma’s case study](https://8weeksqlchallenge.com/case-study-1/). The reference SQL, walkthroughs and edge fixture were written for this app; they are not the paid official solutions. The missing members are A joining 2021-01-07 and B joining 2021-01-09. Setup scripts intentionally fail on an existing schema rather than dropping data.

Each dataset has its own browser-local drafts, submissions and progress. The new Spotify storage key copies the old `spotify-sql-lab-v1` state on first access, preserving the original key. This migration works on the same browser and origin; localhost and 127.0.0.1 are different origins. Clearing browser storage deletes drafts. The homepage always opens first unless the URL explicitly selects a dataset.

## Practice and tests

Run query executes selected text, otherwise the whole editor. Cmd/Ctrl+Enter does the same. Check answer submits the whole editor against all configured fixtures. Each fixture’s submission and reference execute in the same read-only, repeatable-read snapshot. The Test cases tab displays pass/fail details and lets you run a single fixture or reveal its expected output. Query results show which non-default fixture was used. Revealing solutions or outputs never replaces the editor draft.

Comparison checks column names/order, NULLs, numeric values without bigint precision loss, duplicate multiplicities, and row order. Match requested rounding and ORDER BY. A match on these fixtures is evidence, not proof of correctness on all possible data. Q05 and Q37 in Spotify require a written schema explanation; the app validates their metadata query but does not automatically mark those questions solved.

Diner rules are explicit: joining day counts as membership; day 0 through day 6 gets welcome double points; sushi multipliers do not stack. For the January points exercise, earlier January purchases earn ordinary points and February is excluded. All ties are retained as specified; the bonus uses RANK, not DENSE_RANK. Duplicate sales remain separate purchases. If your business policy differs, the expected answers differ.

EXPLAIN ANALYZE runs the query and exposes its full plan. Node memory figures are not total query RAM, and timing differences on these small datasets are noisy. CSV exports use `\N` for NULL.

## Adding another dataset

1. Create its PostgreSQL database and a non-superuser read-only role with SELECT grants on the teaching tables. Optional edge fixtures use separate databases with identical schemas and table names, so the same SQL runs unchanged.
2. Add `datasets/<id>/questions.json`. Each question has a unique integer `id` (contiguous from 1), `title`, `task`, `sql`, `steps` array, `note`, `category`, `difficulty`, and `schemaReasoning` boolean. Specify columns, sorting, ties, missing-data rules and rounding in the task.
3. Add an entry to `datasets/registry.json` with `id`, `name`, `subtitle`, `description`, `database`, `user`, `schema`, `tables`, `icon`, `color`, `tags`, `source`, `about`, and `tests`. Each test has `id`, `name`, `description`, and a server-side `database`. The default test ID is `sample`. Existing visual colors are green and orange. Database connection details never come from the submitted query request.
4. Run the references, verify their results independently, and restart the server. No page or API changes are needed. Prefer fully qualified table names or the configured search path. Small datasets expose up to 30 input rows per table; Spotify starts schema-only.

New connections receive the selected schema as search_path. Never allow end users to upload arbitrary dataset registries; these are trusted local server configuration.

## APIs

- `GET /api/datasets`: public descriptions, question counts and test descriptions.
- `GET /api/datasets/:id/questions`: questions without solutions.
- `GET /api/datasets/:id/schema`: table schemas, counts and small input samples.
- `POST /api/datasets/:id/run`, `/explain`, `/expected`: `{id, sql?, fixture?}`. Default fixture is `sample`; expected uses the stored reference rather than submitted SQL.
- `POST /api/datasets/:id/check`: `{id, sql}`; returns primary result plus per-fixture checks.
- `POST /api/datasets/:id/solution`: `{id}`; returns the SQL, steps and review note.

Dataset and fixture IDs resolve through the server registry. Unknown IDs are rejected. Reference SQL is returned only through explicit solution requests.

## Verification

```sh
npm test
npm run verify
TEST_URL=http://localhost:3000 npm run test:browser
```

Database tests cover all 61 reference executions (37 Spotify + 12 Diner × 2), dataset isolation, write rejection, stacked queries, timeouts, result limits, comparison behavior, and incorrect rank/date-boundary detection. `verify-diner.py` independently calculates all 24 Diner results using Python rather than reference SQL. Regenerating outputs writes only `datasets/*/expected/results.json`.

Browser tests require Google Chrome and use an isolated profile. They cover the library, both datasets, legacy migration, draft isolation/persistence, solution reveal, test cases, CSV export, query plans, history, errors and mobile layout. Screenshots are saved in `screenshots/`. These tests do not modify your actual browser drafts.

## Local execution limits

The app binds to 127.0.0.1 with Host/Origin checks and uses restricted PostgreSQL roles. Sessions are read-only, with a five-second statement timeout, a 12-second connection deadline and 8 MB work_mem. Results are capped at 1,000 rows; four query requests may execute concurrently. Connections are fresh per request/fixture, preventing session settings from leaking across practice attempts. PostgreSQL’s extended protocol rejects stacked statements.

This is a personal local learning app, not a hostile-code sandbox or an internet service. Standard PostgreSQL metadata/functions remain accessible under the role’s permissions. No table editor or data-reset endpoint is exposed.
