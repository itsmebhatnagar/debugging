CREATE TABLE IF NOT EXISTS "AdminAuthState" (
    "id" TEXT NOT NULL,
    "activeSessionId" TEXT,
    "passwordResetSealed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AdminAuthState_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AdminAuthState" ("id", "activeSessionId", "passwordResetSealed")
VALUES ('singleton', NULL, false)
ON CONFLICT ("id") DO NOTHING;

UPDATE "User"
SET "role" = 'USER'
WHERE "role" = 'ADMIN'
  AND "email" <> 'admin@debugging2026.com';

CREATE UNIQUE INDEX IF NOT EXISTS "User_single_admin_role_key"
ON "User" ("role")
WHERE "role" = 'ADMIN';
