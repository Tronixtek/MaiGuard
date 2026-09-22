#!/usr/bin/env bash
# Deploy MaiGuard: API to a server (Docker behind nginx), web app to Firebase Hosting.
# Usage: deploy/deploy.sh [api|web|all]   (default: all)
# Settings come from deploy/deploy.env (git-ignored); see deploy/deploy.env.example.
set -euo pipefail
cd "$(dirname "$0")/.."
WHAT=${1:-all}

if [[ -f deploy/deploy.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source deploy/deploy.env
  set +a
fi
: "${DEPLOY_DIR:=/opt/maiguard}"
: "${FIREBASE_TARGET:=maiguard}"

if [[ $WHAT == api || $WHAT == all ]]; then
  : "${DEPLOY_HOST:?Set DEPLOY_HOST in deploy/deploy.env}"
  rsync -az --delete --exclude node_modules --exclude dist server/ "$DEPLOY_HOST:$DEPLOY_DIR/src/server/"
  rsync -az package.json package-lock.json Dockerfile .dockerignore "$DEPLOY_HOST:$DEPLOY_DIR/src/"
  rsync -az client/package.json "$DEPLOY_HOST:$DEPLOY_DIR/src/client/"
  rsync -az deploy/docker-compose.yml "$DEPLOY_HOST:$DEPLOY_DIR/"
  ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR && docker compose up -d --build && for i in \$(seq 1 30); do curl -sf http://127.0.0.1:8787/api/health && exit 0; sleep 1; done; exit 1"
  echo " API deployed"
fi

if [[ $WHAT == web || $WHAT == all ]]; then
  : "${VITE_API_BASE:?Set VITE_API_BASE in deploy/deploy.env}"
  export VITE_API_BASE VITE_WHATSAPP_NUMBER
  npm run build -w @maiguard/client
  firebase deploy --only "hosting:$FIREBASE_TARGET" --non-interactive
fi
