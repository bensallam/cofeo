#!/usr/bin/env bash
# COFEO local environment bring-up. Idempotent — safe to re-run.
# Does NOT create WooCommerce REST API keys; generate those manually via
# wp-admin (WooCommerce > Settings > Advanced > REST API) when needed.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env — copy .env.example and fill in values first." >&2
  exit 1
fi

set -a; source .env; set +a

echo "==> Starting containers (db, wordpress, adminer)"
docker compose up -d db wordpress adminer

echo "==> Waiting for WordPress to be reachable"
until curl -sf -o /dev/null http://localhost:8080 || curl -s -o /dev/null -w '%{http_code}' http://localhost:8080 | grep -q '^3'; do
  sleep 2
done

if docker compose run --rm wpcli core is-installed 2>/dev/null; then
  echo "==> WordPress already installed, skipping core install"
else
  echo "==> Installing WordPress core"
  docker compose run --rm wpcli core install \
    --url="${WORDPRESS_URL}" \
    --title="COFEO (dev)" \
    --admin_user="${WP_ADMIN_USER}" \
    --admin_password="${WP_ADMIN_PASSWORD}" \
    --admin_email="${WP_ADMIN_EMAIL}" \
    --skip-email
fi

echo "==> Ensuring wp-content is writable (apache uid 33 / wp-cli uid 82 share the volume)"
docker compose exec -T --user root wordpress sh -c "chmod -R 777 /var/www/html/wp-content"

echo "==> Setting pretty permalinks (required for WC REST/Store API routing)"
docker compose run --rm wpcli rewrite structure '/%postname%/' --hard

echo "==> Installing/activating WooCommerce"
docker compose run --rm wpcli plugin install woocommerce --activate || \
  docker compose run --rm wpcli plugin activate woocommerce

echo "==> Activating the COFEO custom plugin"
docker compose run --rm wpcli plugin activate cofeo

echo "==> Done. WordPress: ${WORDPRESS_URL} | Adminer: http://localhost:${ADMINER_PORT:-8081}"
