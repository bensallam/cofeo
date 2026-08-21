# COFEO local development environment

## Detected host

- macOS 26.5.2 (Tahoe), Apple Silicon (arm64)
- Two Homebrew installs present: `/usr/local` (Intel, runs under Rosetta) and
  `/opt/homebrew` (native arm64). Docker/Colima are installed under the
  native arm64 Homebrew only — Colima cannot run under Rosetta.
- An unrelated, pre-existing local WordPress site runs on this machine at
  `~/Desktop/folder/app/public`, served by a long-running Homebrew MySQL
  (port 3306) and php-fpm (port 9000). COFEO's stack deliberately avoids
  those ports (see below) and never touches that site.

## Architecture

Docker containers, orchestrated by `docker-compose.yml` at the project root,
run via **Colima** (a CLI-only Docker runtime — no Docker Desktop, no GUI).

```
┌─────────────┐   ┌──────────────────────┐   ┌───────────┐
│  db          │   │  wordpress            │   │  adminer   │
│  MariaDB 11.4│◄──┤  wordpress:6-php8.2   │   │  DB UI     │
│  :3307→3306  │   │  -apache, :8080→80    │   │  :8081     │
└─────────────┘   └──────────────────────┘   └───────────┘
        ▲                    ▲
        │                    │
        └────────┬───────────┘
                  │
           ┌─────────────┐
           │  wpcli        │  one-off runner (docker compose run),
           │  wordpress:cli│  not a long-running service
           └─────────────┘
```

- `db`: MariaDB, host port **3307** (not 3306 — already taken locally),
  named volume `db_data`.
- `wordpress`: official `wordpress:6-php8.2-apache` image, host port
  **8080**. WordPress core lives inside the `wp_data` named volume —
  never committed, never hand-edited. Only the custom plugin directory
  is bind-mounted from the repo into `wp-content/plugins/cofeo`.
- `wpcli`: official `wordpress:cli` image (**not** `wordpress:cli-php8.2`,
  which is Alpine-based — its `www-data` is uid 82, vs. uid 33 on the
  Debian-based `wordpress:apache` image; mixing the two on the same
  volume causes permission errors on plugin install). Run via
  `docker compose run --rm wpcli <command>`.
- `adminer`: lightweight DB browser UI, host port **8081**.

## Why Colima instead of Docker Desktop or Local by Flywheel

- **Not Local by Flywheel**: site creation is a GUI wizard, not
  scriptable from the terminal.
- **Not Docker Desktop**: GUI app, background daemon, first-run
  privileged-helper prompt, licensing terms for commercial use.
- **Colima**: CLI-only Docker runtime. The whole backend is defined in
  `docker-compose.yml`, reproducible with one command, disposable with
  `docker compose down -v`.

Colima needed the native arm64 Homebrew (`/opt/homebrew`) — it refuses to
run under Rosetta. `/opt/homebrew/bin` was appended (not prepended) to
`PATH` in `~/.zshrc` so it never shadows the existing Intel Homebrew tools.

## Node.js

Node was upgraded from an EOL v14 (system install) to **v22 LTS** via
`nvm` (installed through Homebrew). `~/.zshrc` sources nvm and runs
`nvm use default` on every new shell. The old system Node at
`/usr/local/bin/node` is untouched, just shadowed on `PATH`.

## Environment variables

Two separate env files, both gitignored, both with a committed
`.env.example` sibling:

- `/.env` — read by `docker-compose.yml` (DB credentials, WP admin
  credentials, WordPress URL).
- `/frontend/.env.local` — read by Next.js (`WORDPRESS_API_URL`,
  `WC_CONSUMER_KEY`/`WC_CONSUMER_SECRET`, `NEXT_PUBLIC_SITE_URL`).

**WooCommerce REST API credentials are currently unset.** A key was
generated once during initial setup and is treated as compromised (it
appeared in terminal/tool output) — it was never used, and both env
files now carry empty values for it. `lib/woocommerce/rest-client.ts`
detects the missing credentials and throws a clear `SERVER_ERROR`
instead of attempting a request. The public Store API
(`lib/woocommerce/store-client.ts`) needs no credentials and is fully
functional. To generate a real key for later phases: wp-admin →
WooCommerce → Settings → Advanced → REST API → Add key. Do not
regenerate one via `wp eval` / direct DB access — treat that path as
off-limits going forward.

### WooCommerce REST API auth over local HTTP

WooCommerce requires HTTPS for simple Basic Auth / query-string
key+secret auth. Over plain HTTP (this local environment), it instead
requires **OAuth 1.0a one-legged signing** — implemented from scratch in
`lib/woocommerce/rest-client.ts` (HMAC-SHA1, no extra dependency). This
same code path also works over HTTPS, so there's no per-environment
branching needed once a production WooCommerce instance is HTTPS.

## Start / stop

```bash
./scripts/setup.sh          # idempotent: brings up containers, installs
                             # WP+WooCommerce core on first run, activates
                             # the cofeo plugin every run
docker compose down          # stop containers, keep data
docker compose down -v       # stop containers AND delete volumes (destructive)
```

## Day to day

```bash
# Frontend
cd frontend
pnpm dev                     # http://localhost:3000
pnpm lint
pnpm typecheck
pnpm test                    # pnpm test:watch for watch mode
pnpm build && pnpm start     # production build + serve

# WordPress / WooCommerce
docker compose exec wordpress bash          # shell inside the WP container
docker compose run --rm wpcli <command>     # any wp-cli command
open http://localhost:8080/wp-admin         # admin credentials: see .env
open http://localhost:8081                  # Adminer (server: db, see .env)
```

## Access points

| Service | URL |
|---|---|
| WordPress site | http://localhost:8080 |
| WordPress admin | http://localhost:8080/wp-admin |
| WP REST API | http://localhost:8080/wp-json/ |
| WooCommerce Store API (public) | http://localhost:8080/wp-json/wc/store/v1/ |
| WooCommerce REST API (private, needs keys) | http://localhost:8080/wp-json/wc/v3/ |
| Adminer | http://localhost:8081 (server: `db`, see `.env` for credentials) |
| Next.js dev | http://localhost:3000 |

## Reset

```bash
docker compose down -v   # deletes db_data and wp_data volumes — irreversible
./scripts/setup.sh       # rebuilds from scratch
```

## Troubleshooting

- **`docker` / `colima` command not found in a new terminal**: confirm
  `/opt/homebrew/bin` is in `PATH` (`echo $PATH`); it's appended in
  `~/.zshrc`.
- **Colima won't start**: `colima status`, then `colima start` again.
  If it references Rosetta/x86_64, something is invoking the Intel
  Homebrew's `colima` — check `which colima` resolves to
  `/opt/homebrew/bin/colima`.
- **wp-cli "could not create directory" errors**: wp-content permission
  drift between the two container images' `www-data` uid. Re-run
  `docker compose exec -T --user root wordpress sh -c "chmod -R 777 /var/www/html/wp-content"`
  (also the first thing `scripts/setup.sh` does after core install).
- **Port conflicts**: this machine already runs an unrelated MySQL on
  3306 and php-fpm on 9000 — COFEO intentionally uses 3307/8080/8081/3000
  instead. If those are also taken, change the host-side port in
  `docker-compose.yml` / `.env`.
