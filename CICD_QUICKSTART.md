# CI/CD Quick Start (5 Minutes)

## What's Included

- `.gitlab-ci.yml` — Full pipeline: build → test → deploy
- `docs/CICD_SETUP.md` — Complete setup guide
- `scripts/setup-cicd-vars.sh` — Variable checklist

## TL;DR Setup

### 1. Generate SSH Key (Local Machine)
```bash
ssh-keygen -t ed25519 -f /tmp/deploy_key -N ""
cat /tmp/deploy_key          # Private key content
cat /tmp/deploy_key.pub      # Public key content
```

### 2. Add Public Key to Server
```bash
ssh deploy@YOUR_SERVER_IP
mkdir -p ~/.ssh
echo "PASTE_PUBLIC_KEY_CONTENT_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. Set GitLab CI Variables
Go to: **GitLab Project → Settings → CI/CD → Variables**

Add these variables (mark ones with 🔒 as Protected):

```
SSH_PRIVATE_KEY          🔒  (paste contents of /tmp/deploy_key)
DEPLOY_USER                   deploy
DEPLOY_HOST                   34.124.179.109  (your server IP)
DEPLOY_PORT                   22
REMOTE_APP_DIR                /srv/usdt247-payment
DB_HOST                  🔒  34.124.179.109
DB_PORT                       5432
DB_USER                  🔒  postgres
DB_PASSWORD              🔒  Admin_123
DB_NAME                  🔒  orbitlab
DB_SCHEMA                     payment_svc
```

### 4. Prepare Server (Run Once)
```bash
# SSH into server as root or with sudo
ssh root@YOUR_SERVER_IP

# Install Node & PM2
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs rsync openssh-server
npm install -g pm2
pm2 startup
pm2 save

# Create deploy directory
mkdir -p /srv/usdt247-payment/{releases,logs}
useradd -m -s /bin/bash deploy  # if not exists
chown -R deploy:deploy /srv/usdt247-payment
chmod 755 /srv/usdt247-payment
```

### 5. Test SSH from CI
```bash
# Push code to test the pipeline
git add .gitlab-ci.yml docs/CICD_SETUP.md scripts/setup-cicd-vars.sh
git commit -m "ci: add gitlab ci/cd pipeline"
git push origin main

# Go to GitLab Project → CI/CD → Pipelines
# Wait for build/test/package to complete
# Manually trigger deploy:production job
```

## Pipeline Flow

```
push to main/tag
    ↓
[install] npm ci
    ↓
[test]    tsc --noEmit, npm test
    ↓
[build]   npm run build
    ↓
[package] tar dist/ + config
    ↓
[deploy]  (manual trigger)
    ├─ SSH to server
    ├─ Extract artifact
    ├─ npm ci --omit=dev
    ├─ Run DB migrations
    ├─ Reload PM2
    └─ Cleanup old releases
```

## Verify Deployment

```bash
# Check on server
ssh deploy@YOUR_SERVER_IP
pm2 status
pm2 logs usdt247-payment -n 50

# Health check from outside
curl http://YOUR_SERVER_IP:3000/health
```

## Rollback (if needed)

```bash
ssh deploy@YOUR_SERVER_IP

# List releases
ls -1 /srv/usdt247-payment/releases/

# Switch to previous
ln -sfn /srv/usdt247-payment/releases/OLD_RELEASE_NAME /srv/usdt247-payment/current

# Reload PM2
cd /srv/usdt247-payment/current && pm2 startOrReload ecosystem.config.js --env production
```

## Common Issues

| Issue | Solution |
|-------|----------|
| SSH connection fails | Check `SSH_PRIVATE_KEY` matches public key on server. Run `ssh-keyscan -H $SERVER >> ~/.ssh/known_hosts` |
| Migrations fail | Ensure `DB_*` variables are correct. Test: `PGPASSWORD=... psql -h $HOST -U $USER -d $DB -c "SELECT 1"` |
| PM2 won't start | Check `/srv/usdt247-payment/current/ecosystem.config.js` exists. Run `pm2 start ecosystem.config.js --env production` manually |
| Permission denied | Ensure `deploy` user owns `/srv/usdt247-payment`. Check SSH key permissions: `chmod 600 ~/.ssh/id_rsa` |

## Next: Full Documentation

See `docs/CICD_SETUP.md` for:
- Detailed server setup
- Environment variable options
- Manual deployment steps
- Security best practices
- Troubleshooting guide

## Support

Run this for a checklist:
```bash
bash scripts/setup-cicd-vars.sh
```

