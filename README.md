# NEXORA

Laravel 12 API + React/TypeScript/Vite frontend. The local Docker architecture uses MariaDB, Apache/PHP 8.2, and NGINX.

## Requirements

- Docker Engine and Docker Compose plugin
- OpenSSL
- For non-Docker development: PHP 8.2+, Composer, Node.js 22.6+, npm and MariaDB

## Local setup

Keep any existing `.env` file. Do not overwrite it if it already contains local database credentials or an `APP_KEY`.

```sh
cp -n .env.example .env
openssl rand -hex 24
openssl rand -hex 24
```

Use the two distinct generated values for `DB_PASSWORD` and `DB_ROOT_PASSWORD` in `.env`. Do not paste them into logs or chat. The local root `.env` is ignored by Git and excluded from Docker build contexts.

Build and validate the Compose config without printing resolved environment values:

```sh
docker compose config --quiet
docker compose build
```

Generate a Laravel key without writing it into the image, then store it in `.env` and keep it stable for the lifetime of the installation:

```sh
docker compose run --rm --no-deps backend php artisan key:generate --show
```

The example intentionally leaves `APP_KEY` empty. Do not start a deployment with an empty key. If this is an existing installation, preserve its existing key; changing it invalidates data encrypted with the old one.

Start and wait for the actual health checks:

```sh
docker compose up -d --wait --wait-timeout 120
docker compose ps
curl --fail http://127.0.0.1:8080/
curl --fail http://127.0.0.1:8080/up
curl --fail http://127.0.0.1:8080/api/health
```

Open `http://127.0.0.1:8080`. Only NGINX is bound to the host, on loopback port 8080. MariaDB and the Laravel HTTP server are internal services. The frontend and backend health checks call `/api/health`, which performs a database query; the Compose startup dependencies wait for MariaDB and then backend health. NGINX forwards `/up` to Laravel's process-level health endpoint; it does not replace the database-backed API check.

Logs and service state:

```sh
docker compose logs --tail=100 mysql backend frontend
docker compose ps
```

Do not share raw environment dumps or logs before checking that they contain no local data or secrets.

## Database and tests

Review migrations before applying them. Compose never runs migrations implicitly. Do not run `migrate:fresh`, `db:wipe`, or delete `mysql_data`.

```sh
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan test
```

Frontend unit tests and production build:

```sh
cd frontend
npm test
npm run build
```

The PHPUnit environment forces `APP_ENV=testing`, SQLite `:memory:`, and the array cache even when the parent Compose service is configured for MariaDB; the test base class also overrides cached Laravel configuration before database test traits run. This validates application tests, not MariaDB-specific migration behavior. Running `migrate --force` against an existing database applies pending migrations; it does not prove that an upgrade is safe for every existing data shape. Back up first and review each pending migration.

To run the feature suite in the dedicated Compose test container, which includes the SQLite PDO driver and uses an in-memory database:

```sh
docker compose --profile test run --build --rm backend-test
```

This test service runs on a separate internal network, does not receive the root `.env`, and cannot reach MariaDB. It uses an in-memory SQLite database and disposable test key/cache/session settings. `--rm` removes only the completed test container; it does not remove the application containers or named volumes. Do not use `migrate:fresh` against the development MariaDB database.

The included `DemoSeeder` creates accounts with documented demo credentials. Its seeded productivity challenge has a separate participant account, matching the API rule that creators cannot join their own challenge. The seeder refuses to run in `production`. Only run it in disposable local/test environments after reviewing its effects:

```sh
docker compose exec backend php artisan db:seed --class=DemoSeeder
```

The frontend uses real API calls. Task forms obtain project choices from the authenticated API instead of assuming project/user ID `1`. Frontend unit tests use Node's built-in test runner and TypeScript type stripping, without adding a test dependency.

Projects support reversible archiving through `POST /api/projects/{project}/archive` and `POST /api/projects/{project}/restore`; archived projects are listed with `GET /api/projects/archived` and are excluded from active project/task lists. The existing `DELETE /api/projects/{project}` endpoint is retained for compatibility but now returns `409 Conflict` and never deletes the project or cascaded tasks. This behavior is covered by feature tests.

Project owners can edit project details and link a project to a group where they are a member. Tasks support create, edit, assignment to an eligible project member, filtering, and deletion by their creator; assignees can update task details but cannot delete tasks. The task API accepts the assignee's public identifier so the frontend does not need another user's internal database ID.

Project and task due dates are calendar dates. Their API representation and dashboard comparisons preserve that date without converting it to a previous day through timezone serialization.

Group owners and administrators can update group details and review pending invitations. Owners manage member roles; invitees can accept or reject invitations, and the inviter or a group owner/administrator can cancel them. Cancellation creates a notification for the invitee.

Daily now shows the signed-in user's own and assigned tasks due today or overdue, using the task API and calendar-date semantics. It does not claim to track habits or goals; those still need their own product scope and persistence.

Gaming uses the existing quest and participant schema for community productivity challenges: authenticated users can create challenges, join other users' active challenges, self-report progress, and receive the configured XP once when they mark a challenge complete. Completion is not independently verified. The `xp_total` migration adds a zero-default balance for existing accounts. This is gamification inside NEXORA, not an external game-library or gaming-account integration.

Project, task, and group API responses serialize related people with public identifiers and required profile fields. Internal user foreign keys are omitted from those responses; project and task IDs needed to navigate their own relationships remain available. Notification responses include only their display fields and timestamps, omitting the owning user's database ID.

The dashboard's upcoming-delivery statistic counts all matching assigned tasks independently from the five-task preview list.

## Stop, update, and backups

Stop services while preserving the named MariaDB volume:

```sh
docker compose down
```

Never add `--volumes`/`-v` when preserving data. To update, review changes and backups, then rebuild and restart:

```sh
docker compose build
docker compose up -d --wait --wait-timeout 120
```

Back up MariaDB regularly to storage outside the project directory, protect the backup with appropriate access controls/encryption, and test restoration in a separate disposable database or host before relying on it. The named Docker volume is persistence, not a backup.

## Environment and security

- `.env.example` is a local Compose template; `backend/.env.example` is for separate local Laravel development. Keep `.env` files out of Git and images.
- In production set `APP_ENV=production`, `APP_DEBUG=false`, a stable Laravel-generated `APP_KEY`, real HTTPS `APP_URL`, unique database credentials, and SMTP secrets in the platform secret manager. Never set secrets in `VITE_*`; those values are compiled into browser code.
- `APP_TIMEZONE` controls server-side calendar-day calculations and defaults to `America/Bogota` for this project. Set it to the primary users' timezone in another deployment; the frontend formats calendar dates in each browser's local timezone.
- Authentication currently uses Sanctum personal access tokens in the `Authorization: Bearer` header. The frontend holds its token in session storage. Sanctum stateful cookie authentication, CSRF-cookie initialization, and credentialed CORS are not in use or claimed as validated.
- Login and registration have IP and credential/IP rate limits; password changes also limit failed current-password checks by account and IP.
- Registration prevents duplicate submissions while pending and validates email length against the database column.
- NGINX overwrites `X-Forwarded-For` with the address of its immediate peer before forwarding to Laravel, so a client-supplied forwarding header cannot select its own rate-limit IP. The Compose backend is not published to the host. If an upstream load balancer sits before NGINX, configure NGINX's real-IP module for only that proxy's exact addresses/CIDRs and set the backend `TRUSTED_PROXIES` to the NGINX peer/network; without that NGINX configuration, requests share the upstream proxy's address for rate limiting. Never expose the backend publicly while trusting arbitrary proxy addresses.
- Same-origin deployment uses `/api` through NGINX. For separate frontend/backend origins, build with the real backend API base URL ending in `/api` and set `CORS_ALLOWED_ORIGINS` to exact trusted frontend origins. Do not enable wildcard credentialed CORS.
- Local Compose binds only to `127.0.0.1`. Public deployment requires an HTTPS reverse proxy or a provider's HTTPS routing, exact production origins, persistent compatible MariaDB, backups, and platform-managed secrets.
- `docker-compose.yml` is for local/single-host validation, not a universal deployment manifest. Verify the provider's Docker HTTP support, MariaDB compatibility, persistent storage/backup behavior, networking, resource limits, and current free-tier restrictions before selecting a service.

## Dependency reproducibility

`backend/composer.lock` is tracked. The local `frontend/package-lock.json` has been checked against `package.json` and resolves the installed top-level dependency tree, but it is still untracked and is not in repository history. The frontend Docker build uses `npm ci`, so include that lockfile in any source handoff or clean checkout used for a Docker build. The manifest permits only the lockfile-pinned `esbuild@0.25.12` install script, which prepares and validates its platform binary. Use `composer install` and `npm ci` with their corresponding lockfiles for repeatable installs.

## Current verification status

See [AUDITORIA_DESPLIEGUE.md](./AUDITORIA_DESPLIEGUE.md) for the historical deployment audit and [AUDITORIA_NEXORA_COMPLETA.md](./AUDITORIA_NEXORA_COMPLETA.md) for the current review. Current workspace checks: PHPUnit passes all 64 tests (381 assertions) on SQLite in memory; the preinstalled `pdo_sqlite` module was enabled only for the PHP CLI process. The eight frontend unit tests and `npm run build` pass. Docker runtime checks were completed on this host: backend, frontend and MariaDB are healthy, migration `000018` is applied, `/api/health` returns `200`, and an authenticated end-to-end flow against MariaDB passed. Daily uses real task data; Gaming uses persisted NEXORA quests; Discord remains an external integration that is not connected. A public production deployment has not been performed.

On this host, backend tests can be run without changing PHP configuration:

```sh
cd backend
APP_ENV=testing DB_CONNECTION=sqlite DB_DATABASE=:memory: CACHE_STORE=array php -d extension=/usr/lib/php/modules/pdo_sqlite.so vendor/bin/phpunit
```
