# 1. Local environment: Colima + Docker Compose, not Local.app or Docker Desktop

## Status

Accepted

## Context

COFEO needs a reproducible, terminal-controlled local WordPress +
WooCommerce + MySQL/MariaDB environment. The host already had Local by
Flywheel installed, and Docker Desktop is the default Docker option on
macOS.

## Decision

Use **Colima** (CLI-only Docker runtime) with `docker` CLI and Docker
Compose, defined in a single `docker-compose.yml` at the project root.

## Rationale

- Local by Flywheel: site creation is GUI-wizard only, not scriptable.
- Docker Desktop: GUI app with its own daemon, first-run privileged-helper
  prompt, and licensing terms for commercial use — heavier than needed
  for a CLI-only requirement.
- Colima: no GUI component at all; the entire environment definition
  lives in version control (`docker-compose.yml`), is reproducible with
  `docker compose up`, and disposable with `docker compose down -v`.

## Consequences

- Colima requires a **native arm64 Homebrew** — it cannot run under
  Rosetta. The host had both an Intel Homebrew (`/usr/local`, on `PATH`)
  and an existing-but-unused native arm64 Homebrew (`/opt/homebrew`).
  Colima/docker/docker-compose were installed under `/opt/homebrew`,
  which was appended (not prepended) to `PATH` to avoid shadowing any
  existing Intel-Homebrew tooling.
- WordPress core and `wp-content` (other than the custom plugin) live in
  a Docker named volume, not the git repo — core is never hand-modified,
  matching the project's WordPress-core policy by construction.
- The official `wordpress:cli` and `wordpress:*-apache` images have
  different base OSes (and thus different `www-data` uids: 82 vs 33).
  Sharing a volume between them requires either matching images or a
  permission fix — documented in `docs/development-environment.md`.
