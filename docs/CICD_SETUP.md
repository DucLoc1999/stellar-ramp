# GitLab CI/CD Setup Guide

## Overview

This project uses GitLab CI/CD with Option A deployment strategy:
- **Build**: TypeScript compilation, type checking, testing
- **Package**: Create tarball with `dist/`, `package.json`, `ecosystem.config.js`
- **Deploy**: SSH to production server, extract, install deps, run migrations, reload PM2

## Required GitLab CI Variables

Set these in **GitLab Project Settings → CI/CD → Variables** (mark sensitive ones as **Protected**):

### SSH Credentials (Protected)
| Variable | Value | Example |
|----------|-------|---------|
| `SSH_PRIVATE_KEY` | Private SSH key for deploy user | `-----BEGIN OPENSSH PRIVATE KEY-----\n...` |
| `DEPLOY_USER` | SSH username on server | `ubuntu` or `deploy` |
| `DEPLOY_HOST` | Production server IP/hostname | `34.124.179.109` or `api.example.com` |
| `DEPLOY_PORT` | SSH port (optional) | `22` (default if omitted) |
| `REMOTE_APP_DIR` | Deploy directory on server | `/srv/usdt247-payment` |

### Database (Protected)
| Variable | Value | Example |
|----------|-------|---------|
| `DB_HOST` | Database host | `34.124.179.109` |
| `DB_PORT` | Database port (optional) | `5432` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `Admin_123` |
| `DB_NAME` | Database name | `orbitlab` |
| `DB_SCHEMA` | Database schema (optional) | `payment_svc` |

**Note**: Leave `DB_*` variables empty if you don't want CI to run migrations automatically. Migrations can still be run manually on the server.

## Server Setup Checklist

Run these commands **once** on your production server:

### 1. Create Deploy User
```bash
# If not already created
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG sudo deploy  # Optional: for sudo commands
```

### 2. Install Node & PM2
```bash
# As root or with sudo
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs rsync openssh-server

# Install PM2 globally
sudo npm install -g pm2
sudo pm2 startup
sudo pm2 save
```

### 3. Setup Deploy Directory
```bash
# As root or with sudo
mkdir -p /srv/usdt247-payment/{releases,logs}
chown -R deploy:deploy /srv/usdt247-payment
chmod 755 /srv/usdt247-payment
```

### 4. Add CI SSH Public Key
```bash
# As deploy user
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Paste your CI SSH public key (corresponding to SSH_PRIVATE_KEY)
echo "ssh-rsa AAAA... your-key-name" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 5. Verify SSH Access (from CI runner or local machine)
```bash
ssh -p 22 deploy@YOUR_SERVER_IP "echo 'SSH connection OK'"
```

### 6. (Optional) Setup Environment File
```bash
# As deploy user
cat > ~/.env << 'EOF'
NODE_ENV=production
PORT=3000
SEPAY_KEY=your_key
SEPAY_WEBHOOK_API_KEY=your_key
# ... other env vars
EOF

chmod 600 ~/.env
```

Or use PM2 ecosystem env (see below).

## Manual Deployment

If you want to deploy without pushing to main/tags, you can trigger the deploy job manually:

1. Go to **GitLab Project → CI/CD → Pipelines**
2. Find the commit/branch you want to deploy
3. Click the pipeline, then click **Play** (▶️) on the `deploy:production` job
4. Monitor logs in real-time

## Rollback

### Quick Rollback (via SSH)
```bash
ssh deploy@YOUR_SERVER_IP

# List available releases
ls -1 /srv/usdt247-payment/releases/

# Switch to previous release
ln -sfn /srv/usdt247-payment/releases/PREVIOUS_RELEASE_NAME /srv/usdt247-payment/current

# Reload PM2
cd /srv/usdt247-payment/current
pm2 startOrReload ecosystem.config.js --env production
pm2 save
```

### Via PM2 Logs
```bash
ssh deploy@YOUR_SERVER_IP
pm2 logs usdt247-payment        # View live logs
pm2 status                       # Check all processes
pm2 restart usdt247-payment      # Restart one app
```

## Monitoring

### Check Deployment Status
```bash
# Via GitLab UI or CLI
gitlab pipeline get PROJECT_ID --pipeline-id PIPELINE_ID

# Or check on server
ssh deploy@YOUR_SERVER_IP
pm2 status
pm2 logs usdt247-payment -n 50   # Last 50 lines
```

### Health Check
The app exposes `/health` endpoint on port 3000:
```bash
curl -s http://YOUR_SERVER_IP:3000/health | jq .
```

## Troubleshooting

### SSH Connection Fails
```bash
# Check SSH key is correct
ssh -vvv -p 22 deploy@YOUR_SERVER_IP "echo OK"

# Verify known_hosts
ssh-keyscan -H YOUR_SERVER_IP >> ~/.ssh/known_hosts
```

### Migrations Fail
```bash
# Run manually on server
ssh deploy@YOUR_SERVER_IP
cd /srv/usdt247-payment/current
DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... \
  node node_modules/.bin/knex migrate:latest --knexfile dist/knexfile.js
```

### PM2 Won't Start
```bash
ssh deploy@YOUR_SERVER_IP
cd /srv/usdt247-payment/current
pm2 start ecosystem.config.js --env production --watch
pm2 logs
```

### Symlink or Permissions Issues
```bash
ssh deploy@YOUR_SERVER_IP
ls -la /srv/usdt247-payment/
# Verify current → releases/XXXX symlink
# Check ownership: should be deploy:deploy
```

## Env Vars with PM2

If you prefer to load env vars via PM2 ecosystem config instead of system-wide, add to `ecosystem.config.js`:

```javascript
env: {
  NODE_ENV: "production",
  PORT: 3000,
  SEPAY_KEY: process.env.SEPAY_KEY,
  SEPAY_ENV: "production",
  // ... other vars
}
```

Then on server, export in your shell before running PM2:
```bash
export SEPAY_KEY=your_key
pm2 start ecosystem.config.js --env production
```

Or set in GitLab CI variables and CI will pass them to migrations.

## Next Steps

1. **Generate SSH Key Pair** (if you don't have one):
   ```bash
   ssh-keygen -t ed25519 -f deploy_key -N ""
   # Outputs: deploy_key (private), deploy_key.pub (public)
   ```

2. **Add Private Key to GitLab**:
   - Project Settings → CI/CD → Variables
   - `SSH_PRIVATE_KEY`: paste contents of `deploy_key`
   - Mark as **Protected**

3. **Add Public Key to Server**:
   - `cat deploy_key.pub >> ~/.ssh/authorized_keys` on deploy user

4. **Set Other Variables**:
   - `DEPLOY_USER`, `DEPLOY_HOST`, `REMOTE_APP_DIR`, `DB_*` etc.

5. **Push to main or tag**:
   ```bash
   git push origin main
   # or
   git tag v1.0.0
   git push origin v1.0.0
   ```

6. **Monitor Pipeline**:
   - GitLab Project → CI/CD → Pipelines
   - Wait for build/test/package to complete
   - Manually trigger `deploy:production` job

## Security Best Practices

- ✅ Use **Protected Variables** for SSH key and DB credentials
- ✅ Only deploy from `main` branch or version tags (see `.gitlab-ci.yml`)
- ✅ Manual trigger for deploy job (`when: manual`)
- ✅ Keep SSH key private and rotate periodically
- ✅ Use a dedicated `deploy` user with limited privileges
- ✅ Enable 2FA on GitLab account
- ✅ Audit deployment logs in GitLab UI

