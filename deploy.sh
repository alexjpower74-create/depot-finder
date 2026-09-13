#!/bin/zsh
# Depot Finder deploy (run from repo root). Needs wrangler auth.
set -e
cd "$(dirname "$0")/worker"
source <(sed 's/^/export /' SECRETS.txt)
npx --yes wrangler d1 migrations apply DB --remote
printf '%s' "$ADMIN_PIN" | npx wrangler secret put ADMIN_PIN
npx wrangler deploy
cd ..
rm -rf dist && mkdir -p dist/data
cp app/*.html app/*.js app/*.css dist/ 2>/dev/null; rm -f dist/hours.test.mjs
cp data/depots.json dist/data/
npx --yes wrangler deploy --config wrangler.app.toml
