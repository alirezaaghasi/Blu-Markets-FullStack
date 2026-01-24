#!/bin/bash
# Blu Markets Development Startup Script
# Usage: ./scripts/start-dev.sh [--clean-all]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; }
error() { echo -e "${RED}❌${NC} $1"; exit 1; }
info() { echo -e "${BLUE}ℹ️${NC} $1"; }

# Parse arguments
CLEAN_ALL=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean-all)
            CLEAN_ALL=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

echo ""
echo "================================================"
echo "  Blu Markets Development Environment Setup"
echo "================================================"
echo ""

# Step 1: Start Docker database
info "Starting Docker database..."
cd "$ROOT_DIR/backend"
docker-compose up -d 2>/dev/null || error "Failed to start Docker"

# Wait for database to be healthy
info "Waiting for database..."
for i in {1..30}; do
    if docker exec backend-db-1 pg_isready -U postgres >/dev/null 2>&1; then
        log "Database: Running (backend-db-1 healthy)"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Database failed to start"
    fi
    sleep 1
done

# Step 2: Clean ALL user data if requested
if [ "$CLEAN_ALL" = true ]; then
    info "Cleaning ALL user data..."
    docker exec backend-db-1 psql -U postgres -d blumarkets -c "
    TRUNCATE sessions, action_logs, ledger_entries, holdings, protections, loans, portfolios, otp_codes, users CASCADE;
    " >/dev/null 2>&1 || warn "Could not clean database"

    USER_COUNT=$(docker exec backend-db-1 psql -U postgres -d blumarkets -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
    log "Database: Cleaned ($USER_COUNT users)"
fi

# Step 3: Kill any existing backend/expo processes
info "Cleaning up existing processes..."
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true
sleep 2

# Step 4: Start backend
info "Starting backend..."
cd "$ROOT_DIR/backend"
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
for i in {1..30}; do
    if curl -s http://localhost:3000/docs >/dev/null 2>&1; then
        log "Backend: Running at http://localhost:3000"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Backend failed to start. Check /tmp/backend.log"
    fi
    sleep 1
done

# Step 5: Test API integration
info "Testing API integration..."
API_RESPONSE=$(curl -s http://localhost:3000/api/v1/auth/send-otp \
    -X POST -H "Content-Type: application/json" \
    -d '{"phone": "+989000000000"}' 2>/dev/null || echo "FAILED")

if echo "$API_RESPONSE" | grep -q "success"; then
    log "API Test: OTP endpoint responding"
else
    error "API integration failed: $API_RESPONSE"
fi

# Step 6: Make port public (Codespaces)
if [ -n "$CODESPACE_NAME" ]; then
    info "Making port 3000 public..."
    gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" 2>/dev/null || true

    # Verify public access
    PUBLIC_URL="https://${CODESPACE_NAME}-3000.app.github.dev"
    PUBLIC_TEST=$(curl -s "${PUBLIC_URL}/api/v1/auth/send-otp" \
        -X POST -H "Content-Type: application/json" \
        -d '{"phone": "+989000000001"}' 2>/dev/null || echo "FAILED")

    if echo "$PUBLIC_TEST" | grep -q "success"; then
        log "Port 3000: Public"
    else
        warn "Port may not be public. Verify manually."
    fi
fi

# Step 7: Start Expo
info "Starting Expo with tunnel..."
cd "$ROOT_DIR/blu-markets-mobile"
EXPO_NO_ANSI=1 npx expo start --tunnel --clear > /tmp/expo.log 2>&1 &
EXPO_PID=$!

# Wait for tunnel to be ready
info "Waiting for Expo tunnel (this takes ~20 seconds)..."
sleep 20

# Get Expo URL
EXPO_URL=""
for i in {1..10}; do
    EXPO_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4 | sed 's/https:/exp:/' || echo "")
    if [ -n "$EXPO_URL" ]; then
        break
    fi
    sleep 2
done

if [ -n "$EXPO_URL" ]; then
    log "Expo: Running with tunnel"
else
    warn "Could not get Expo URL. Check http://localhost:4040/api/tunnels"
    EXPO_URL="(check localhost:4040)"
fi

# Final output
echo ""
echo "================================================"
echo -e "  ${GREEN}All Systems Ready${NC}"
echo "================================================"
echo ""
echo -e "📱 Expo URL: ${GREEN}${EXPO_URL}${NC}"
echo -e "📞 Test Phone: ${GREEN}+989123456789${NC}"
echo -e "🔑 OTP Code: ${GREEN}999999${NC}"
echo ""
echo "Expected Flow:"
echo "Phone → OTP → Questionnaire → Profile → Allocation → Funding → Portfolio Home"
echo ""
echo "Logs:"
echo "  Backend: tail -f /tmp/backend.log"
echo "  Expo:    tail -f /tmp/expo.log"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Cleanup function
cleanup() {
    echo ""
    info "Stopping services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $EXPO_PID 2>/dev/null || true
    pkill -f "ngrok" 2>/dev/null || true
    echo "Done."
    exit 0
}

trap cleanup INT TERM

# Keep script running
wait
