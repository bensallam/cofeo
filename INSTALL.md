# COFEO Installation Guide

This guide documents exactly what this repository requires to run, based
on an audit of the actual code (`package.json`, `next.config.ts`,
`config/env.ts`, `lib/woocommerce/*`, `lib/media/*`, the `wordpress/custom-plugin`
source, `docker-compose.yml`, and `scripts/setup.sh`). Where the repository
does not pin or specify something, that is stated explicitly instead of
being guessed.

## 1. Architecture

```
Browser
  │
  ▼
Next.js frontend (App Router, Server Components + Server Actions)
  │  all WooCommerce/WordPress calls happen server-side —
  │  the browser never talks to WordPress directly
  ▼
WordPress + WooCommerce
  ├─ WooCommerce Store API      (public, no auth)   — products, cart, checkout
  ├─ WooCommerce REST API v3    (private, optional) — currently unused by the app
  └─ Custom "cofeo/v1" REST API (public, no auth)   — shipping cities, bank-transfer details
  │
  ▼
WooCommerce data (WordPress database)
```

Key points confirmed by the code:

- The frontend is a **server-to-server integration**. `lib/woocommerce/store-client.ts`,
  `checkout.ts`, `shipping-cities.ts`, and `bank-transfer.ts` all call
  `serverEnv.WORDPRESS_API_URL` from server-only modules (Server Actions /
  Server Components). The browser never receives WooCommerce credentials
  and never calls WordPress directly — there is no browser→WordPress CORS
  boundary to configure (see section 6).
- Guest-cart identity (WooCommerce's `Cart-Token` + `Nonce`) is stored in an
  `httpOnly` cookie on the **Next.js** domain (`cofeo_cart_token`, see
  `lib/cart/cart-cookie.ts`), not on the WordPress domain.
- The homepage's "Featured Machines" section (`app/[locale]/page.tsx`) uses
  hardcoded fictional data from `lib/demo-data/products.ts` — **not** live
  WooCommerce data. The catalogue, product pages, cart, and checkout are
  all live Store API data.

### Product-image processing route

```
WordPress media (wp-content/uploads)
  → GET /api/product-image/[encoded]        (or /card/[encoded])
      → Sharp: trim dead canvas (+ composite onto a fixed canvas for "card" mode)
      → disk cache (OS temp dir)
  → served to next/image in the browser
```

See section 10 for the full behavior of this pipeline.

## 2. Requirements

Only what is actually declared or used in this repository — nothing
inferred beyond that.

| Component | Version | Source |
|---|---|---|
| Node.js | **≥ 20.9.0** | `next@16.3.1`'s own `package.json` `engines` field (this repo's `frontend/package.json` does not itself declare an `engines` field) |
| pnpm | **11.22.0** (pinned) | `frontend/package.json` → `"packageManager": "pnpm@11.22.0"` |
| Next.js | 16.3.1 | `frontend/package.json` |
| React / React DOM | 19.2.8 | `frontend/package.json` |
| Sharp | ^0.35.3 | `frontend/package.json` (native binding — see section 11) |
| TypeScript | ^5 (strict mode) | `frontend/package.json`, `frontend/tsconfig.json` |
| WordPress | Dev stack uses Docker image `wordpress:6-php8.2-apache` (`docker-compose.yml`). The custom plugin header declares a minimum of **`Requires at least: 6.4`**, **`Requires PHP: 8.1`** (`wordpress/custom-plugin/cofeo-core.php`). | `docker-compose.yml`, plugin header |
| WooCommerce | **Not pinned anywhere in this repository.** `scripts/setup.sh` installs it via `wp plugin install woocommerce --activate`, i.e. whatever is latest-stable at install time. Must be compatible with the WordPress version above. | `scripts/setup.sh` |
| MariaDB | 11.4 (dev stack only) | `docker-compose.yml` |
| Docker + Colima | Used for the **reference local dev stack** (`docker-compose.yml`). Not required if WordPress/WooCommerce is hosted elsewhere — see section 9. | `docker-compose.yml` |

## 3. Clone

The repository is **private** — cloning requires an authenticated GitHub
account with access.

```bash
git clone https://github.com/bensallam/cofeo.git
cd cofeo
```

## 4. Install dependencies

The Next.js app lives in `frontend/` and uses **pnpm** with the committed
`frontend/pnpm-lock.yaml`. The exact pnpm version is pinned via
`packageManager` in `frontend/package.json`.

```bash
cd frontend
corepack enable
corepack prepare pnpm@11.22.0 --activate
pnpm install
```

(`corepack` ships with Node ≥ 16.9; it reads the `packageManager` field
automatically. If you don't use corepack, install pnpm 11.22.0 by any
other means — the lockfile format requires a compatible pnpm.)

## 5. Environment variables

These are read by the Next.js app via `frontend/config/env.ts` (validated
with Zod — the app fails fast at startup if a required one is missing or
malformed).

| Variable | Required | Scope | Purpose |
|---|---|---|---|
| `WORDPRESS_API_URL` | **Yes** | Server only | Base URL of the WordPress/WooCommerce instance (e.g. `https://cms.example.com`). Every Store API, REST API v3, and `cofeo/v1` call is built from this. Must be a valid URL (`z.url()`). |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | Public (bundled into the client) | Canonical public URL of the Next.js frontend itself (e.g. `https://www.cofeo.ma`). Must be a valid URL (`z.url()`). |
| `WC_CONSUMER_KEY` | No | Server only | WooCommerce REST API v3 OAuth1.0a consumer key (`lib/woocommerce/rest-client.ts`). **Not currently called from anywhere in the app** — the client that uses it (`wcRestFetch`) exists for future private/admin operations but has no caller today. Leave empty unless you specifically need it. |
| `WC_CONSUMER_SECRET` | No | Server only | Paired secret for `WC_CONSUMER_KEY`. Same "no current caller" note applies. |

Example values (placeholders only):

```bash
# frontend/.env.local
WORDPRESS_API_URL=http://localhost:8080
NEXT_PUBLIC_SITE_URL=http://localhost:3000
WC_CONSUMER_KEY=
WC_CONSUMER_SECRET=
```

This file already exists as `frontend/.env.example` in the repository and
was verified to match `config/env.ts` exactly — no changes were needed.

### Separate: the repo-root `.env` (Docker stack only)

`docker-compose.yml` and `scripts/setup.sh` read a **different**,
repo-root `.env` (see `.env.example` at the repository root) for the
*optional local WordPress/MariaDB stack* — `MYSQL_ROOT_PASSWORD`,
`MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `WORDPRESS_DB_HOST`,
`WORDPRESS_DB_NAME`, `WORDPRESS_DB_USER`, `WORDPRESS_DB_PASSWORD`,
`WORDPRESS_URL`, `WP_ADMIN_USER`, `WP_ADMIN_PASSWORD`, `WP_ADMIN_EMAIL`,
`ADMINER_PORT`. **The Next.js app itself never reads these** — they only
matter if you use `docker-compose.yml` to run WordPress locally. A
production WordPress/WooCommerce host managed outside this repo doesn't
need this file at all.

## 6. WordPress / WooCommerce setup

Only what is confirmed by the frontend code and the bundled
`wordpress/custom-plugin`.

**Endpoints the frontend calls** (all under `WORDPRESS_API_URL`):

- `GET/POST /wp-json/wc/store/v1/*` — products, cart (`/cart`, `/cart/add-item`,
  `/cart/update-item`, `/cart/remove-item`, `/cart/update-customer`),
  checkout (`/checkout`). **Public, no authentication.**
- `GET /wp-json/wc/v3/*` — WooCommerce REST API v3, OAuth1.0a-signed.
  Present in the code (`rest-client.ts`) but **not currently called by any
  feature** (see section 5).
- `GET /wp-json/cofeo/v1/shipping-cities` — city master list, served by the
  bundled `wordpress/custom-plugin`. **Public, no authentication.**
- `GET /wp-json/cofeo/v1/bank-transfer` — bank-transfer payment details,
  served by the same plugin. **Public, no authentication.** Returns
  `enabled: false` and empty fields unless the gateway below is configured.

**Required WordPress/WooCommerce configuration:**

1. **Pretty permalinks** must be enabled (`scripts/setup.sh` sets
   `/%postname%/`) — the Store API and the custom `cofeo/v1` namespace both
   depend on WordPress rewrite rules being active.
2. **WooCommerce Brands** must be available — `lib/woocommerce/products.ts`
   reads `product.brands[0].name` from the Store API response (the
   `product_brand` taxonomy). Without it, every product's brand renders
   empty.
3. A **`pa_condition` global product attribute** (taxonomy `pa_condition`)
   with terms whose **slugs** are exactly: `neuf`, `excellent-etat`,
   `tres-bon-etat`, `bon-etat` (`lib/woocommerce/products.ts`,
   `CONDITION_SLUG_TO_KEY`). Any product without this attribute simply
   renders with no condition badge — not a hard failure, but the
   catalogue's condition filter/badges depend on it.
4. **The `wordpress/custom-plugin` (COFEO Core) must be installed and
   active**, and requires WooCommerce to already be active (it self-disables
   with an admin notice otherwise — `cofeo-core.php`).
5. **Shipping rates must be seeded once, manually** — `scripts/setup.sh`
   does **not** do this. Run inside the WordPress container/host:
   ```bash
   wp cofeo-shipping seed-rates
   ```
   This creates the `cofeo_shipping_rates` option (a default rate plus
   Mohammedia/Casablanca overrides — see
   `wordpress/custom-plugin/shipping/class-cofeo-shipping-cli.php` for the
   exact values). Without this step, shipping cost resolution has nothing
   to read. City names themselves need no seeding — they're read directly
   from the bundled `wordpress/custom-plugin/shipping/data/cities.txt` at
   runtime.
6. **Bank-transfer payment method** (`cofeo_bank_transfer` gateway) **ships
   disabled by default** (`class-cofeo-bank-transfer-gateway.php` /
   `-settings.php`). Enable and fill in its details from wp-admin →
   WooCommerce → Settings → Payments if you want this payment option to
   appear at checkout; leave disabled otherwise (the frontend already
   handles "not enabled" gracefully — `getBankTransferDetails()` fails
   closed to a disabled/empty state).
7. **Product images** must be reachable at a URL matching the allowlist in
   `frontend/lib/media/product-image-source.ts`
   (`ALLOWED_PRODUCT_IMAGE_HOSTS`) — see section 9/10, this is a
   **hardcoded** allowlist, not environment-variable driven.

**CORS / cookies:** none required. The browser never calls WordPress
directly (section 1), so there is no cross-origin browser request to
configure CORS for. Cart identity is a cookie scoped to the Next.js
domain, not WordPress's.

## 7. Development

Commands that actually exist in `frontend/package.json`:

```bash
cd frontend
pnpm install
pnpm dev          # http://localhost:3000 (Turbopack dev server)
```

Other available scripts:

```bash
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run
pnpm test:watch   # vitest, watch mode
```

If you also want a local WordPress/WooCommerce backend (Docker/Colima),
the repository ships one:

```bash
cd ..                          # repository root
cp .env.example .env           # fill in values
./scripts/setup.sh             # idempotent: brings up db + wordpress + adminer,
                                # installs WP core + WooCommerce on first run,
                                # activates the cofeo plugin every run
```

This is only required if you don't already have a WordPress/WooCommerce
instance to point `WORDPRESS_API_URL` at.

## 8. Production build

The exact commands defined in `frontend/package.json`:

```bash
cd frontend
pnpm build        # next build
pnpm start        # next start — serves the build on port 3000 by default
```

`next start` respects the standard `PORT` env var or a `-p` flag if you
need a different port, e.g. `pnpm start -- -p 4000`.

There is no `output: "export"` or `output: "standalone"` set in
`next.config.ts` — this is a standard Next.js Node.js server build, not a
static export.

## 9. Deployment

No Dockerfile or deployment-specific config exists in this repository for
the **frontend** — `docker-compose.yml` here only defines the local
WordPress/MariaDB/Adminer dev stack, not a way to run the Next.js app
itself. Deployment of the Next.js app is therefore not assumed to be
Docker-based; it's whatever Node.js hosting you choose to run
`pnpm build && pnpm start` on.

**Minimum steps for any target:**

1. Provision a WordPress/WooCommerce instance reachable over HTTPS,
   configured per section 6.
2. **Update the hardcoded image-host allowlist** in
   `frontend/lib/media/product-image-source.ts`
   (`ALLOWED_PRODUCT_IMAGE_HOSTS`) to your production WordPress media host
   — it currently only allows `http://localhost:8080/wp-content/uploads/**`.
   This is a source-code change (not an env var) and the same list also
   feeds `next.config.ts`'s `images.remotePatterns`, so both the trim route
   and `next/image` need it updated together. `dangerouslyAllowLocalIP` in
   `next.config.ts` exists only for the local dev host and is not relevant
   once the media host is a real domain.
3. Set `WORDPRESS_API_URL` and `NEXT_PUBLIC_SITE_URL` to their real HTTPS
   values (section 5).
4. Build and run: `pnpm install --frozen-lockfile && pnpm build && pnpm start`.
5. Put a reverse proxy in front of `next start` (which listens on plain
   HTTP) to terminate HTTPS and handle the public domain. An example Nginx
   config, based on the actual app (single Node process on port 3000, no
   other services to route to from the frontend side):

   ```nginx
   server {
       listen 443 ssl http2;
       server_name www.cofeo.ma;

       ssl_certificate     /etc/letsencrypt/live/www.cofeo.ma/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/www.cofeo.ma/privkey.pem;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }

   server {
       listen 80;
       server_name www.cofeo.ma;
       return 301 https://$host$request_uri;
   }
   ```

   Run the Next.js process itself under a supervisor (systemd, pm2, etc.)
   so it restarts on crash/reboot — no such config exists in this repo, so
   choose whatever your hosting environment already standardizes on.
6. Keep the Next.js process's `PORT`/proxy target and the WordPress host's
   HTTPS domain consistent with what you configured in steps 2–3.

## 10. Image processing

The actual pipeline, from `frontend/lib/media/product-image-pipeline.ts`
and the two routes under `frontend/app/api/product-image/`:

```
WordPress original (wp-content/uploads/...)
  → GET /api/product-image/[encoded]            (natural ratio — ProductGallery, cart, etc.)
     or /api/product-image/card/[encoded]        (fixed 4:5 canvas — catalogue grid, related products)
      → Sharp .trim({ threshold: 20 })           strips flat-color dead margins only
      → "card" mode additionally: resize to fit inside a 1000×1250 canvas,
        composite centered onto a fixed #f5f5f2 background — never crops,
        never stretches, never upscales past native resolution
      → cached to disk ($TMPDIR/cofeo-product-image-trim-cache), keyed by
        a SHA-256 hash of the source URL (+ canvas params for "card" mode)
      → served with Cache-Control: public, max-age=86400, stale-while-revalidate=604800
      → consumed by next/image in the browser
```

- **What gets processed:** only the *trim* (dead-canvas removal) and, for
  card mode, a resize+composite onto a fixed canvas. The **original file in
  WordPress is never modified** — the route only ever reads it.
- **Where the cache is:** `os.tmpdir()/cofeo-product-image-trim-cache`
  (two files per cached image: `.bin` + `.json`). This is local disk on
  whatever machine runs the Next.js process — it is **not** shared across
  multiple server instances/containers, and it is cleared whenever the
  OS/container clears its temp directory.
- **What happens if processing fails:** if the trim/composite step itself
  throws, the pipeline falls back to the untrimmed original bytes rather
  than failing. If the upstream WordPress fetch fails entirely, the
  `/api/product-image/[encoded]` route redirects to the original source URL
  instead of returning an error. Either way, the visitor still sees an
  image, never a broken one.
- **Security:** `/api/product-image/*` only proxies URLs matching
  `ALLOWED_PRODUCT_IMAGE_HOSTS` (section 9) — it is not an open image
  proxy.

## 11. Troubleshooting

**Missing/invalid environment variables** — the app throws a Zod
validation error at startup (server) or build time if `WORDPRESS_API_URL`
or `NEXT_PUBLIC_SITE_URL` is missing or not a valid URL. Check
`frontend/.env.local` (dev) or your process manager's env config
(production).

**Can't reach WordPress / "Failed to reach the Store API"** — this is
`AppError("NETWORK_ERROR", ...)` from `store-client.ts` / `checkout.ts` /
`shipping-cities.ts`. Confirm `WORDPRESS_API_URL` is correct and reachable
from wherever the Next.js process runs (not just from your own machine —
this is a server-to-server call).

**Store API responds with 404 on cart/checkout/products** — almost always
missing pretty permalinks (section 6, step 1); WooCommerce's Store API
routes depend on WordPress rewrite rules.

**Product brand/condition missing on the frontend** — WooCommerce Brands
not installed, or the `pa_condition` attribute/terms don't match the exact
slugs the code expects (section 6, steps 2–3). Not a crash — the field
just renders empty/undefined.

**Shipping cost never resolves / always "unknown"** — the
`cofeo_shipping_rates` option was never seeded. Run
`wp cofeo-shipping seed-rates` (section 6, step 5).

**Images fail to load / 400 "Invalid image source"** — the WordPress media
URL doesn't match `ALLOWED_PRODUCT_IMAGE_HOSTS` in
`frontend/lib/media/product-image-source.ts`. This must be updated in
source for any host other than the local dev default (section 9).

**Sharp install/build errors** — Sharp ships prebuilt native binaries per
platform/architecture; install failures are almost always a
platform/Node-version mismatch. Re-run `pnpm install` on the actual target
machine/architecture (don't copy a `node_modules` built elsewhere); ensure
Node ≥ 20.9.0 (section 2).

**CORS errors in the browser console** — should not happen in this
architecture (section 1/6: the browser never calls WordPress directly). If
you see one, something is calling WordPress from client code, which is a
deviation from how this app is built — check for an accidental
client-side fetch to `WORDPRESS_API_URL`.

**`pnpm build` fails** — run `pnpm typecheck` and `pnpm lint` first
(both are separate from `next build`'s own type-checking pass) to isolate
whether it's a type error, a lint error enforced at build time, or a
genuine build/runtime issue.

**App starts but checkout/cart cookie doesn't persist** — `cofeo_cart_token`
is set with `secure: true` whenever `NODE_ENV === "production"`
(`lib/cart/cart-cookie.ts`). Serving production over plain HTTP (no
reverse-proxy HTTPS) means browsers will refuse to store this cookie —
confirm HTTPS termination is actually in front of the app (section 9).

## 12. Updating the application

No CI/CD or deployment automation exists in this repository — the
following is a manual workflow consistent with the deployment approach in
section 9 (a single Node.js process, no containers for the frontend
itself):

```bash
git pull
cd frontend
pnpm install --frozen-lockfile
pnpm build
# restart the Next.js process (however your process manager does it,
# e.g.: pm2 restart cofeo-frontend / systemctl restart cofeo-frontend)
```

If the update touches `frontend/lib/media/product-image-source.ts`
(the image-host allowlist) or environment variables, re-verify section 5/9
still match your deployment before restarting.

## 13. Security

- **Never commit `.env`, `.env.local`, or any `.env.*` file that isn't
  `.env.example`.** Both `.gitignore` (repo root) and `frontend/.gitignore`
  already exclude these — verified against the actual tracked file list.
- **Never expose `WC_CONSUMER_KEY` / `WC_CONSUMER_SECRET`, WordPress admin
  credentials, or database credentials** in client code, logs, or commit
  history. `WC_CONSUMER_KEY`/`SECRET` are read only from `config/env.ts`'s
  server-only `serverEnv`, which cannot be imported from a Client
  Component (build error by design — see the comment at the top of
  `frontend/config/env.ts`).
- **Required production secrets** (must be set outside of any committed
  file): `WORDPRESS_API_URL`, `NEXT_PUBLIC_SITE_URL` (not secret, but
  environment-specific), and — only if/when a feature actually calls the
  WooCommerce REST API v3 — `WC_CONSUMER_KEY` / `WC_CONSUMER_SECRET`. The
  root-level Docker `.env` (MySQL/WordPress admin passwords) matters only
  if you use this repo's own `docker-compose.yml` to host WordPress.
- **This GitHub repository (`bensallam/cofeo`) is private.** Keep it that
  way — it contains the full WooCommerce/WordPress integration logic
  (though no live credentials, per the audit in this document).
