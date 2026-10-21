# NEXORA

Laravel 12 API + React/TypeScript/Vite frontend. The local Docker architecture uses MariaDB, Apache/PHP 8.2, and NGINX.

## Requirements

- Docker Engine and Docker Compose plugin
- OpenSSL
- For non-Docker development: PHP 8.2+, Composer, Node.js 22+, npm and MariaDB

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

The Laravel test configuration uses SQLite in memory. This validates application tests, not MariaDB-specific migration behavior. Running `migrate --force` against an existing database applies pending migrations; it does not prove that an upgrade is safe for every existing data shape. Back up first and review each pending migration.

The included `DemoSeeder` creates accounts with documented demo credentials. It now refuses to run in `production`. Only run it in disposable local/test environments after reviewing its effects:

```sh
docker compose exec backend php artisan db:seed --class=DemoSeeder
```

The frontend uses real API calls. Task forms obtain project choices from the authenticated API instead of assuming project/user ID `1`.

Projects support reversible archiving through `POST /api/projects/{project}/archive` and `POST /api/projects/{project}/restore`; archived projects are listed with `GET /api/projects/archived` and are excluded from active project/task lists. The existing `DELETE /api/projects/{project}` endpoint is retained for compatibility but now returns `409 Conflict` and never deletes the project or cascaded tasks. This behavior is covered by feature tests.

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
- Authentication currently uses Sanctum personal access tokens in the `Authorization: Bearer` header. The frontend holds its token in session storage. Sanctum stateful cookie authentication, CSRF-cookie initialization, and credentialed CORS are not in use or claimed as validated.
- Same-origin deployment uses `/api` through NGINX. For separate frontend/backend origins, build with the real backend API base URL ending in `/api` and set `CORS_ALLOWED_ORIGINS` to exact trusted frontend origins. Do not enable wildcard credentialed CORS.
- Local Compose binds only to `127.0.0.1`. Public deployment requires an HTTPS reverse proxy or a provider's HTTPS routing, exact production origins, persistent compatible MariaDB, backups, and platform-managed secrets.
- `docker-compose.yml` is for local/single-host validation, not a universal deployment manifest. Verify the provider's Docker HTTP support, MariaDB compatibility, persistent storage/backup behavior, networking, resource limits, and current free-tier restrictions before selecting a service.

## Dependency reproducibility

No Composer or npm lockfile was present at the time of this audit. The current Docker builds therefore resolve dependency versions without committed lockfiles. Before a repeatable release, generate and commit `backend/composer.lock` and `frontend/package-lock.json` in a compatible environment, then use the lockfile-based install commands (`composer install` and `npm ci`). The current environment could not generate or verify these lockfiles.

## Current verification status

See [AUDITORIA_DESPLIEGUE.md](./AUDITORIA_DESPLIEGUE.md). Backend and frontend builds succeeded, and the user started all three Compose services with healthy status. Host HTTP checks, migrations, Laravel tests, and persistence-after-restart remain pending.
