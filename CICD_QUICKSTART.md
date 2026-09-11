# CI/CD Quick Start (Hybrid - Simplified)

## What's Included

- `.gitlab-ci.yml` — 2 stages: test (in CI) + deploy (on server)
- `CICD_OPTIONS.md` — Comparison of all approaches
- `docs/CICD_SETUP.md` — Full setup guide (still valid)

## How It Works

```
git push origin main
  ↓ (automatic - in GitLab CI container)
[test] npm ci + tsc + tests
  ↓ (pass/fail shown in GitLab UI)
[deploy] Manual trigger when ready
  ↓ (runs on your debian-server runner)
git pull origin main
npm install --production
npm run build
npm run migrate:prod (optional)
pm2 restart ecosystem.config.js
  ↓
Done! (4 min total)
```

## Setup (Simple!)

### 1. Register GitLab Runner on Your Server
```bash
# On your debian-server (as root or sudo)
curl -L https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh | bash
sudo apt-get install gitlab-runner

# Register runner
sudo gitlab-runner register \
  --url https://gitlab.com/ \
  --registration-token YOUR_REGISTRATION_TOKEN \
  --executor shell \
  --tag-list debian-server \
  --description "Debian Server Runner"
```

(Get `YOUR_REGISTRATION_TOKEN` from: GitLab Project → Settings → CI/CD → Runners)

### 2. Install Node & PM2 on Server
```bash
# On your debian-server
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs rsync openssh-server
npm install -g pm2
```

### 3. Setup Your Project Directory
```bash
# On your debian-server
mkdir -p /var/www/my-project
cd /var/www/my-project
git clone https://YOUR_GITLAB_URL/project.git .
npm install --production
npm run build
pm2 start ecosystem.config.js
pm2 save
```

### 4. Update `.gitlab-ci.yml` Variables (if needed)
The current `.gitlab-ci.yml` assumes:
- Runner tag: `debian-server` ✓
- Project dir: `/var/www/my-project` ← Update if different
- PM2 app name: `ecosystem.config.js` ✓

If your paths differ, edit `.gitlab-ci.yml` line 21:
```yaml
script:
  - cd /YOUR/ACTUAL/PATH/here  # ← Change this
```

## Deploy Workflow

### First Deploy
1. Push code: `git push origin main`
2. Go to **GitLab Project → CI/CD → Pipelines**
3. Wait for `test` job to pass (2-3 min)
4. Click **Play** (▶️) on `deploy` job
5. Watch logs in real-time
6. Done!

### Subsequent Deploys
```bash
# Just push, wait for tests, then click deploy
git push origin main
# Wait 2 min for tests...
# Manual click in GitLab UI
```

## If Deploy Fails

**Option 1: Fix and retry**
```bash
git commit -m "fix: issue"
git push origin main
# Wait for test to pass, then retry deploy
```

**Option 2: Rollback**
```bash
# On your server
ssh ubuntu@YOUR_SERVER_IP
cd /var/www/my-project

# Check git history
git log --oneline -5

# Revert to previous
git revert <commit-hash>
git push origin main

# Deploy again
```

**Option 3: Manual PM2 restart**
```bash
# On your server
ssh ubuntu@YOUR_SERVER_IP
pm2 restart ecosystem.config.js
pm2 status
pm2 logs usdt247-payment -n 50
```

## Verify Deployment

```bash
# Check on server
ssh ubuntu@YOUR_SERVER_IP
pm2 status
pm2 logs usdt247-payment -n 20

# Health check
curl http://YOUR_SERVER_IP:3000/health
```

## Environment Variables

If your app needs `.env` file, create it on the server:

```bash
ssh ubuntu@YOUR_SERVER_IP
cat > /var/www/my-project/.env << 'EOF'
NODE_ENV=production
PORT=3000
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
SEPAY_KEY=...
EOF

chmod 600 /var/www/my-project/.env
pm2 restart ecosystem.config.js
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Runner not found | Check runner is registered: `gitlab-runner list` on server |
| Build fails with `tsc` errors | Fix TypeScript errors, push again |
| Deploy hangs on `git pull` | SSH to server, check if git is stuck: `ps aux \| grep git` |
| PM2 won't restart | Check logs: `pm2 logs`, ensure `ecosystem.config.js` exists |
| Permission denied | Check gitlab-runner user has access to `/var/www/my-project` |
| Node not found | Verify Node installed: `which node` on server |

## Comparison: Why Hybrid?

| Aspect | Hybrid (Current) | Simple | Full Multi-Stage |
|--------|------------------|--------|------------------|
| CI checks | ✅ tsc, tests | ❌ None | ✅ Full pipeline |
| Deploy speed | ⚡ 3-4 min | ⚡⚡ 2-3 min | ⚡ 5 min (artifacts) |
| Error detection | Before deploy ✅ | At runtime ❌ | Before deploy ✅ |
| Rollback | Git revert | Git revert | Instant symlink |
| Complexity | ⭐⭐ Low | ⭐ Super low | ⭐⭐⭐⭐ High |
| **Best for?** | **Your case ✅** | Hobby only | Enterprise only |

For a payment system on your own server = **Hybrid is perfect**.

## See Also

- `CICD_OPTIONS.md` — Full comparison of all approaches
- `docs/CICD_SETUP.md` — Advanced setup & troubleshooting

