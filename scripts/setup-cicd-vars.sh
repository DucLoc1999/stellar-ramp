#!/bin/bash
# CI/CD Variables Quick Setup Script
# Run this to see which variables you need and their current status

echo "================================"
echo "GitLab CI/CD Variables Checklist"
echo "================================"
echo ""
echo "Required Variables (set in GitLab Project Settings → CI/CD → Variables):"
echo ""

VARS=(
  "SSH_PRIVATE_KEY:SSH private key for deploy user (PEM format, protected)"
  "DEPLOY_USER:SSH username (e.g., deploy, ubuntu)"
  "DEPLOY_HOST:Production server IP or hostname"
  "DEPLOY_PORT:SSH port (default: 22, optional)"
  "REMOTE_APP_DIR:Deploy directory on server (e.g., /srv/usdt247-payment)"
  "DB_HOST:Database host"
  "DB_PORT:Database port (default: 5432, optional)"
  "DB_USER:Database username"
  "DB_PASSWORD:Database password (protected)"
  "DB_NAME:Database name"
  "DB_SCHEMA:Database schema (default: payment_svc, optional)"
)

for var in "${VARS[@]}"; do
  IFS=':' read -r name desc <<< "$var"
  printf "  %-20s : %s\n" "$name" "$desc"
done

echo ""
echo "================================"
echo "Generate SSH Key Pair (if needed)"
echo "================================"
echo ""
echo "1. Generate new keypair:"
echo "   ssh-keygen -t ed25519 -f deploy_key -N \"\""
echo ""
echo "2. View private key (for SSH_PRIVATE_KEY variable):"
echo "   cat deploy_key"
echo ""
echo "3. Add public key to server:"
echo "   cat deploy_key.pub >> ~/.ssh/authorized_keys"
echo ""
echo "4. Copy private key content to GitLab CI variable:"
echo "   - GitLab Project → Settings → CI/CD → Variables"
echo "   - Add variable SSH_PRIVATE_KEY"
echo "   - Paste content of deploy_key"
echo "   - Mark as Protected ✓"
echo ""

echo "================================"
echo "Test SSH Connection"
echo "================================"
echo ""
echo "ssh -p 22 deploy@YOUR_SERVER_IP 'echo OK'"
echo ""
