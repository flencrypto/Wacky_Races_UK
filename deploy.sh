#!/usr/bin/env bash
set -euo pipefail

echo "🏁 Wacky Races UK – Deploy Script"

# 1. Build all images
docker compose build

# 2. Run DB migrations
docker compose run --rm api npm run migrate

# 3. Start all services
docker compose --profile prod up -d

echo "✅ Deployed. API at http://localhost:3000/health"
