# Blu Markets Testing Procedure

## Quick Start Command

Run this single command to start everything for testing:

```bash
cd /workspaces/Blu-Markets && ./scripts/start-dev.sh
```

---

## Manual Steps (if script not available)

### 1. Start Database (Docker)

```bash
cd /workspaces/Blu-Markets/backend
docker-compose up -d
```

Wait for healthy status:
```bash
docker ps | grep backend-db-1
```

### 2. Start Backend

```bash
cd /workspaces/Blu-Markets/backend
npm run dev
```

Verify it's running:
```bash
curl -s http://localhost:3000/api/v1/auth/send-otp -X POST -H "Content-Type: application/json" -d '{"phone": "+989123456789"}'
```

### 3. Make Backend Port Public (Codespaces)

```bash
gh codespace ports visibility 3000:public -c $CODESPACE_NAME
```

### 4. Start Expo

```bash
cd /workspaces/Blu-Markets/blu-markets-mobile
npx expo start --tunnel --clear
```

Get the Expo URL from ngrok:
```bash
curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | select(.proto=="https") | .public_url' | sed 's/https:/exp:/'
```

---

## Testing Fresh Onboarding

To test the full questionnaire flow, you need a NEW user (phone number not in database).

### Option A: Use a new phone number

Use any phone number not already in the database, e.g.:
- `+989111111111`
- `+989222222222`

### Option B: Delete existing user

To reset a specific user for fresh onboarding:

```bash
PHONE="+989123456789"

docker exec backend-db-1 psql -U postgres -d blumarkets -c "
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE phone = '$PHONE');
DELETE FROM action_logs WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$PHONE'));
DELETE FROM ledger_entries WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$PHONE'));
DELETE FROM holdings WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$PHONE'));
DELETE FROM protections WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$PHONE'));
DELETE FROM loans WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$PHONE'));
DELETE FROM portfolios WHERE user_id IN (SELECT id FROM users WHERE phone = '$PHONE');
DELETE FROM otp_codes WHERE phone = '$PHONE';
DELETE FROM users WHERE phone = '$PHONE';
"
```

### Option C: Reset entire database (nuclear option)

```bash
cd /workspaces/Blu-Markets/backend
npx prisma migrate reset --force
npx prisma db seed
```

---

## OTP Codes

### Development Bypass Code
In development, use `999999` as OTP for any phone number.

### Real OTP
Check backend logs for the actual OTP:
```
📱 OTP for +989123456789: 574806
```

---

## Checklist Before Testing

- [ ] Docker database is running (`docker ps | grep postgres`)
- [ ] Backend is running (`curl http://localhost:3000/docs`)
- [ ] Port 3000 is public (for Codespaces)
- [ ] Expo is running with tunnel
- [ ] Test user is clean (if testing onboarding)

---

## Common Issues

### "Request failed with status code 404"
- Backend not running, or
- Port 3000 not public

### Skipped questionnaire / went straight to portfolio
- User already exists with completed onboarding
- Delete user (see Option B above) and try again

### "Cannot read property 'toFixed' of undefined"
- Stale app bundle - restart Expo with `--clear` flag
- Force close Expo Go app and reopen

### WebSocket errors
- Backend not running or network issue
- These are non-fatal warnings

---

## Phone Numbers for Testing

| Phone | Purpose |
|-------|---------|
| `+989123456789` | General testing |
| `+989999999999` | Pre-seeded demo user |
| `+989111111111` | Fresh user testing |

---

## Environment

- **Backend URL**: `https://literate-space-cod-g5pjrgj6q453jg6-3000.app.github.dev/api/v1`
- **Expo URL**: Check ngrok tunnels at `http://localhost:4040`
