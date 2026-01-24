#!/bin/bash
# Blu Markets Development Startup Script
# Usage: ./scripts/start-dev.sh [--fresh-user PHONE]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[DEV]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
FRESH_USER=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --fresh-user)
            FRESH_USER="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Step 1: Start Docker database
log "Starting Docker database..."
cd "$ROOT_DIR/backend"
docker-compose up -d 2>/dev/null || true
sleep 3

# Wait for database to be healthy
log "Waiting for database..."
for i in {1..30}; do
    if docker exec backend-db-1 pg_isready -U postgres >/dev/null 2>&1; then
        log "Database is ready"
        break
    fi
    sleep 1
done

# Step 2: Delete fresh user if requested
if [ -n "$FRESH_USER" ]; then
    log "Deleting user $FRESH_USER for fresh onboarding test..."
    docker exec backend-db-1 psql -U postgres -d blumarkets -c "
    DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE phone = '$FRESH_USER');
    DELETE FROM action_logs WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$FRESH_USER'));
    DELETE FROM ledger_entries WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$FRESH_USER'));
    DELETE FROM holdings WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$FRESH_USER'));
    DELETE FROM protections WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$FRESH_USER'));
    DELETE FROM loans WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$FRESH_USER'));
    DELETE FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$FRESH_USER');
    DELETE FROM otp_codes WHERE phone = '$FRESH_USER';
    DELETE FROM users WHERE phone = '$FRESH_USER';
    " 2>/dev/null || warn "Could not delete user (may not exist)"
    log "User $FRESH_USER deleted"
fi

# Step 3: Kill any existing backend/expo processes
log "Cleaning up existing processes..."
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
sleep 2

# Step 4: Start backend
log "Starting backend..."
cd "$ROOT_DIR/backend"
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
log "Waiting for backend..."
for i in {1..30}; do
    if curl -s http://localhost:3000/docs >/dev/null 2>&1; then
        log "Backend is ready at http://localhost:3000"
        break
    fi
    sleep 1
done

# Step 5: Make port public (Codespaces)
if [ -n "$CODESPACE_NAME" ]; then
    log "Making port 3000 public..."
    gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" 2>/dev/null || true
fi

# Step 6: Start Expo
log "Starting Expo..."
cd "$ROOT_DIR/blu-markets-mobile"
npx expo start --tunnel --clear > /tmp/expo.log 2>&1 &
EXPO_PID=$!

# Wait for tunnel to be ready
log "Waiting for Expo tunnel..."
sleep 15

# Get Expo URL
EXPO_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4 | sed 's/https:/exp:/' || echo "")

echo ""
echo "=============================================="
echo -e "${GREEN}Development environment is ready!${NC}"
echo "=============================================="
echo ""
echo "Backend:  http://localhost:3000"
echo "API Docs: http://localhost:3000/docs"
if [ -n "$CODESPACE_NAME" ]; then
    echo "Public:   https://${CODESPACE_NAME}-3000.app.github.dev"
fi
echo ""
if [ -n "$EXPO_URL" ]; then
    echo -e "Expo URL: ${GREEN}${EXPO_URL}${NC}"
else
    echo "Expo URL: Check http://localhost:4040/api/tunnels"
fi
echo ""
echo "OTP bypass code: 999999"
if [ -n "$FRESH_USER" ]; then
    echo -e "Fresh user ready: ${GREEN}${FRESH_USER}${NC}"
fi
echo ""
echo "Logs:"
echo "  Backend: tail -f /tmp/backend.log"
echo "  Expo:    tail -f /tmp/expo.log"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "log 'Stopping services...'; kill $BACKEND_PID $EXPO_PID 2>/dev/null; exit 0" INT TERM
wait
