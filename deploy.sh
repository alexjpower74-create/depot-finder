#!/bin/zsh
# Depot Finder deploy (run from repo root). Needs wrangler auth.
set -e
cd "$(dirname "$0")/worker"
source <(sed 's/^/export /' SECRETS.txt)
npx --yes wrangler d1 migrations apply DB --remote
printf '%s' "$ADMIN_PIN" | npx wrangler secret put ADMIN_PIN
npx wrangler deploy
cd ..
npx --yes wrangler deploy --config wrangler.app.toml
