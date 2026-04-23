   Current src/ has a flat layout with routes calling services directly. User wants to adopt the layered pattern from docs/CLAUDE.md: config/, controllers/, middlewares/, models/, routes/,
      services/, types/, utils/. Keep all current PG/SePay/Knex business logic — layout change only. Also fix broken refs and delete dead code.

     Target Structure

     src/
     ├── app.ts                          # NEW — Fastify app factory
     ├── config/
     │   ├── app.ts                      # REWRITE — PG-era AppConfig, no broken import
     │   ├── database.ts                 # REWRITE — PG connection config (shared by db.ts + knexfile.ts)
     │   └── logger.ts                   # KEEP as-is
     ├── controllers/                    # NEW layer
     │   ├── configController.ts
     │   ├── orderController.ts
     │   ├── priceController.ts
     │   └── webhookController.ts
     ├── db.ts                           # MODIFY — import connection config from config/database.ts
     ├── knexfile.ts                     # MODIFY — import connection config from config/database.ts
     ├── middlewares/
     │   ├── errorHandler.ts             # NEW — global error handler plugin
     │   └── sepayAuth.ts                # KEEP as-is
     ├── migrations/                     # KEEP all 000-005 as-is
     ├── models/
     │   └── types.ts                    # NEW — shared interfaces extracted from services
     ├── routes/
     │   ├── configRoutes.ts             # MODIFY — delegate to controller
     │   ├── orderRoutes.ts              # MODIFY — delegate to controller
     │   ├── priceRoutes.ts              # MODIFY — delegate to controller
     │   └── webhookRoutes.ts            # RENAME from sepayWebhookRoutes.ts, delegate to controller
     ├── server.ts                       # REWRITE — slim: import app, import logger, listen
     ├── services/                       # KEEP all 7 files as-is (no logic changes)
     ├── types/
     │   └── fastify.d.ts                # NEW — Fastify type augmentation (empty for now)
     └── utils/
         └── migrationRunner.ts          # NEW — extract migration logic from server.ts onReady

     File-by-File Plan

     Phase 1: Foundation (new files, no existing code breaks)

     1. CREATE src/models/types.ts
       - Extract from orderService.ts: OrderState, DepositRequest, WithdrawalRequest
       - Extract from priceService.ts: RateResult, QuoteResult
       - Extract from sepayService.ts: SepayWebhookPayload
       - Export from config/app.ts: AppConfig
     2. CREATE src/config/database.ts (REWRITE — PG, not MySQL)
       - Export databaseConfig object: { host, port, user, password, database, ssl, schema }
       - Export testConnection() using the knex instance from db.ts
       - Reads from env vars (same as current db.ts inline config)
     3. CREATE src/utils/migrationRunner.ts
       - Export runMigrations() that calls db.migrate.latest()
       - Import db from ../db
     4. REWRITE src/config/app.ts
       - Remove broken import of '../models/types'
       - Define AppConfig type inline or import from ../models/types
       - Keep same shape: { port, host, nodeEnv }
     5. DELETE src/config/knex.ts — dead code (old knexfile ref, MySQL era)
     6. CREATE src/config/logger.ts — already exists, KEEP as-is

     Phase 2: Controllers (extract handler logic from routes)

     7. CREATE src/controllers/orderController.ts
       - handleDeposit(req, reply) — move handler from orderRoutes
       - handleWithdrawal(req, reply) — move handler from orderRoutes
       - handleGetOrder(req, reply) — move handler from orderRoutes
     8. CREATE src/controllers/priceController.ts
       - handleGetRate(req, reply) — move handler from priceRoutes
     9. CREATE src/controllers/configController.ts
       - handleGetFees(req, reply) — move handler from configRoutes
     10. CREATE src/controllers/webhookController.ts
       - handleSepayWebhook(req, reply) — move handler from sepayWebhookRoutes

     Phase 3: Update routes to use controllers

     11. MODIFY src/routes/orderRoutes.ts
       - Keep schema definitions
       - Replace inline handlers with controller imports
     12. MODIFY src/routes/priceRoutes.ts — same pattern
     13. MODIFY src/routes/configRoutes.ts — same pattern, remove db import (unused after controller extraction)
     14. RENAME src/routes/sepayWebhookRoutes.ts → src/routes/webhookRoutes.ts
       - Update to use controller

     Phase 4: Core wiring

    15. CREATE src/app.ts — Fastify app factory
       - export async function buildApp(): Promise<FastifyInstance>
       - Register: cors, swagger, swaggerUi, errorHandler, health route, all 4 route prefixes
       - Register onReady hook (runMigrations + testConnection + logger)
     16. REWRITE src/server.ts — slim entrypoint
       - Import buildApp from ./app
       - Import logger from ./config/logger
       - Import appConfig from ./config/app
       - Call buildApp(), then app.listen()
     17. MODIFY src/db.ts
       - Import connection config from ./config/database instead of inline env reads
     18. MODIFY src/knexfile.ts
       - Import connection config from ./config/database instead of inline env reads

     Phase 5: New scaffolding

     19. CREATE src/middlewares/errorHandler.ts
       - Fastify error handler plugin (setErrorHandler)
       - Log error, return { success: false, error: message }
     20. CREATE src/types/fastify.d.ts
       - Empty Fastify type augmentation placeholder

     Phase 6: Update imports in services

     21. MODIFY src/services/orderService.ts
       - Move OrderState, DepositRequest, WithdrawalRequest types to models/types.ts, re-export from here for backward compat during transition
     22. MODIFY src/services/priceService.ts
       - Move RateResult, QuoteResult to models/types.ts, import from there
     23. MODIFY src/services/sepayService.ts
       - Move SepayWebhookPayload to models/types.ts, import from there

     Phase 7: Cleanup

     24. Update CLAUDE.md to reflect new structure
     25. Verify: npx tsc --noEmit passes
     26. Verify: npm run dev starts successfully

     Verification

     1. npx tsc --noEmit — type-check
     2. npm run dev — server starts, health endpoint responds
     3. npm run build — dist/ builds cleanly

7 tasks (7 done)                                                                            
   ✔ Phase 1: Foundation — models/types, config/database, utils/migrationRunner, fix config/app, delete config/knex
   ✔ Phase 2: Create controllers — orderController, priceController, configController, webhookController
   ✔ Phase 3: Update routes + rename webhookRoutes — orderRoutes, priceRoutes, configRoutes, webhookRoutes
   ✔ Phase 4: Core wiring — app.ts, server.ts, db.ts, knexfile.ts
   ✔ Phase 5: New scaffolding — errorHandler, types/fastify.d.ts
   ✔ Phase 6: Update service imports to use models/types
   ✔ Phase 7: Cleanup — type-check + build passes
