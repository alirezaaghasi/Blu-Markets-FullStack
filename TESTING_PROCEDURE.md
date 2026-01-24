# Blu Markets Testing Procedure

## Pre-Test Checklist (MANDATORY)

Before every Expo Go test, Claude must verify:

- [ ] **Database**: Docker PostgreSQL is running and healthy
- [ ] **Backend**: API server running at port 3000
- [ ] **API Integration**: Backend can connect to database, prices are updating
- [ ] **Ports Public**: Port 3000 is public (Codespaces)
- [ ] **Clean Database**: ALL user records deleted for fresh test
- [ ] **Expo Running**: Tunnel is active and URL is available

## Expected User Flow

```
Phone Number → OTP → Questionnaire → Risk Profile → Asset Allocation → Initial Funding → Portfolio Home (Chat UI)
```

**This flow must complete without skipping any step.**

---

## Quick Start

```bash
./scripts/start-dev.sh --clean-all
```

This command:
1. Starts Docker database
2. Cleans ALL user data from database
3. Starts backend
4. Makes port 3000 public
5. Starts Expo with tunnel
6. Outputs the Expo URL

---

## Manual Verification Steps

### 1. Database Running

```bash
docker-compose -f backend/docker-compose.yml up -d
docker exec backend-db-1 pg_isready -U postgres
```

Expected: `/var/run/postgresql:5432 - accepting connections`

### 2. Clean ALL User Data

```bash
docker exec backend-db-1 psql -U postgres -d blumarkets -c "
TRUNCATE sessions, action_logs, ledger_entries, holdings, protections, loans, portfolios, otp_codes, users CASCADE;
"
```

### 3. Backend Running

```bash
cd backend && npm run dev &
```

Verify:
```bash
curl -s http://localhost:3000/docs | head -5
```

### 4. API Integration Test

```bash
# Test OTP endpoint
curl -s http://localhost:3000/api/v1/auth/send-otp \
  -X POST -H "Content-Type: application/json" \
  -d '{"phone": "+989123456789"}'
```

Expected: `{"success":true,"message":"OTP sent","expiresIn":120}`

### 5. Port Public (Codespaces)

```bash
gh codespace ports visibility 3000:public -c $CODESPACE_NAME
```

Verify:
```bash
curl -s https://${CODESPACE_NAME}-3000.app.github.dev/api/v1/auth/send-otp \
  -X POST -H "Content-Type: application/json" \
  -d '{"phone": "+989123456789"}'
```

### 6. Expo Running

```bash
cd blu-markets-mobile && npx expo start --tunnel --clear &
```

Get URL:
```bash
curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | select(.proto=="https") | .public_url' | sed 's/https:/exp:/'
```

---

## Test Credentials

| Field | Value |
|-------|-------|
| Phone | `+989123456789` |
| OTP | `999999` (dev bypass) |

---

## Flow Verification

After user completes onboarding, verify in database:

```bash
docker exec backend-db-1 psql -U postgres -d blumarkets -c "
SELECT
  u.phone,
  u.risk_score,
  u.consent_risk,
  p.cash_irr,
  p.total_value_irr,
  (SELECT COUNT(*) FROM holdings WHERE portfolio_id = p.id) as holdings_count
FROM users u
JOIN portfolios p ON u.id = p.user_id
WHERE u.phone = '+989123456789';
"
```

Expected:
- `risk_score`: 1-10 (from questionnaire)
- `consent_risk`: true
- `holdings_count`: 8 (PAXG, USDT, BTC, ETH, BNB, SOL, TON, LINK)

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Skipped questionnaire | User already exists | Run `--clean-all` |
| 404 on OTP | Backend not running or port not public | Check backend + port visibility |
| Holdings empty | Prices not available during allocation | Check backend logs for price errors |
| WebSocket errors | Non-fatal, ignore | Backend connectivity warnings |

---

## Claude's Checklist Output

When starting Expo Go test, Claude should output:

```
✅ Database: Running (backend-db-1 healthy)
✅ Backend: Running at http://localhost:3000
✅ API Test: OTP endpoint responding
✅ Port 3000: Public
✅ Database: Cleaned (0 users)
✅ Expo: Running with tunnel

📱 Expo URL: exp://xxx-anonymous-8081.exp.direct
📞 Test Phone: +989123456789
🔑 OTP Code: 999999

Expected Flow:
Phone → OTP → Questionnaire → Profile → Allocation → Funding → Portfolio Home
```
