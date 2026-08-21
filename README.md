# COFEO

Premium coffee machines, coffee, accessories, repair & maintenance —
Next.js (App Router) frontend on a WordPress/WooCommerce backend.

Currently in **Phase 1 — Foundation**. See `docs/development-environment.md`
for full environment details and `docs/adr/` for architecture decisions.

## Quickstart

```bash
cp .env.example .env          # fill in values (or keep generated defaults)
./scripts/setup.sh            # brings up WordPress + WooCommerce + DB

cd frontend
cp .env.example .env.local
pnpm install
pnpm dev                      # http://localhost:3000
```

For a complete installation guide (exact requirements, every environment
variable, WordPress/WooCommerce setup, production build, deployment, and
troubleshooting), see **[INSTALL.md](./INSTALL.md)**.

## Structure

```
cofeo/
├── frontend/              Next.js app (App Router, TS strict, Tailwind, next-intl)
├── wordpress/
│   └── custom-plugin/      COFEO business logic — never modifies WP/WC core
├── docs/
│   ├── development-environment.md
│   └── adr/                Architecture decision records
├── scripts/
│   └── setup.sh             Idempotent local environment bring-up
└── docker-compose.yml       WordPress + MariaDB + Adminer, via Colima
```

## Languages

`/fr` (default), `/ar` (RTL), `/en` — see `frontend/i18n/`.
