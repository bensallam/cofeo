# 2. WooCommerce REST API client uses OAuth 1.0a one-legged signing

## Status

Accepted

## Context

The COFEO frontend needs a server-only client for the private WooCommerce
REST API (`/wp-json/wc/v3/...`) for admin/private operations, per the
project's API strategy (customer-facing commerce goes through the public
Store API instead, which needs no credentials).

WooCommerce's REST API requires HTTPS for its simple Basic Auth /
query-string `consumer_key`+`consumer_secret` authentication. Requests
made over plain HTTP (as in local development, and potentially some
deployment targets) are rejected with a generic 401
`woocommerce_rest_cannot_view`, regardless of whether the credentials
are valid — confirmed directly against WooCommerce's `is_ssl()` check
during Phase 1 setup.

## Decision

Implement OAuth 1.0a one-legged signing (HMAC-SHA1) directly in
`lib/woocommerce/rest-client.ts`, with no external OAuth1 dependency —
it's ~40 lines using Node's built-in `crypto` module.

## Rationale

- This is WooCommerce's own documented mechanism for authenticating
  over non-HTTPS connections; it isn't a workaround, it's the correct
  path.
- The same signed-request code works over HTTPS too, so there's no
  environment-specific branching in application code — only the
  transport differs.
- No new dependency: signing is a well-defined, small algorithm and
  Node's `crypto` module is sufficient.

## Consequences

- `lib/woocommerce/rest-client.ts` is the only place this logic lives;
  nothing else should hand-roll WooCommerce REST authentication.
- If COFEO's production deployment always terminates HTTPS at the edge,
  this code still works unchanged — no follow-up migration needed.
- Real WooCommerce REST API keys are not yet configured in any `.env`
  file (see `docs/development-environment.md` — a previously generated
  key was treated as compromised and discarded). `rest-client.ts` fails
  with a clear `SERVER_ERROR` rather than crashing at import time when
  credentials are absent; the Store API client is unaffected.
