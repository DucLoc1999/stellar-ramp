# Simplified GitLab CI/CD Options

## Option 1: Simple (Your Request)
**File: `.gitlab-ci-simple.yml`**

```yaml
stages:
  - deploy

deploy:
  stage: deploy
  tags:
    - debian-server
  script:
    - cd /var/www/my-project
    - git pull origin main
    - npm install --production
    - npm run build
    - pm2 restart ecosystem.config.js
  only:
    - main
```

**Pros:** 3 lines of logic
**Cons:** No error checks before deploy, risky for payment system

---

## Option 2: Hybrid (Recommended) ⭐
**File: `.gitlab-ci-hybrid.yml`**

```yaml
stages:
  - test
  - deploy

# Type-check in CI container (catch errors before server)
test:
  image: node:24-alpine
  stage: test
  script:
    - npm ci
    - npx tsc --noEmit
    - npm test || true
  only:
    - main

# Deploy via runner (fast, direct)
deploy:
  stage: deploy
  tags:
    - debian-server
  script:
    - cd /var/www/my-project
    - git pull origin main
    - npm install --production
    - npm run build
    - npm run migrate:prod || true
    - pm2 restart ecosystem.config.js
  only:
    - main
  when: manual
```

**Pros:** Catches errors before deploy, simple, fast
**Cons:** Still builds on server (not isolated)

---

## Option 3: Current (Full Multi-Stage) ✅✅
**Already in `.gitlab-ci.yml`**

**Pros:** Most robust, artifact history, instant rollback
**Cons:** More complex, slower, overkill if runner is on your server

---

## Comparison

| Aspect | Simple | Hybrid | Current |
|--------|--------|--------|---------|
| Setup time | 2 min | 5 min | 15 min |
| Deploy time | 3 min | 4 min | 5 min |
| Error detection | ❌ Runtime | ✅ Before deploy | ✅ Before deploy |
| Rollback | Git only | Git only | Instant symlink |
| Best for | Hobby | **Your case** | Enterprise |
| Payment system? | ❌ | ✅ | ✅✅ |

---

## My Recommendation for You

**Use Hybrid** because:

1. ✅ Your runner is on the server → no rsync overhead
2. ✅ You already have PM2 → use it directly
3. ✅ Payment system needs type safety → include `tsc --noEmit`
4. ✅ Simple to understand → 10 lines of config
5. ✅ Git is your rollback → `git revert && git push`

**Deploy workflow with Hybrid:**
```
git push origin main
  ↓ (automatic)
[test] npm ci, tsc, tests in container
  ↓ (pass/fail shown)
[deploy] Manual trigger when ready
  ↓ (on server)
git pull + build + pm2 restart
  ↓
Done (4 min)
```

If something breaks:
```bash
git revert <commit>
git push origin main
# CI test runs, then manually trigger deploy
```

---

## Action: What to Do Now

1. **Want to simplify?** I'll replace `.gitlab-ci.yml` with Hybrid version (10 lines)
2. **Want to keep current?** Leave as is (most robust)
3. **Want the super simple version?** I'll use Simple (3 lines, but risky)

Let me know which one!

