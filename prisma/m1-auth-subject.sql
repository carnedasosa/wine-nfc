-- M1 additive rollout for an existing database that has not been baselined yet.
-- Review and apply once, before deploying the M1 application code.
-- This intentionally does not create a Prisma Migrate baseline (that belongs to M2).

BEGIN;

DO $m1$
BEGIN
  EXECUTE format(
    'ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I TEXT',
    'User',
    'authSubject'
  );
  EXECUTE format(
    'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (%I)',
    'User_authSubject_key',
    'User',
    'authSubject'
  );
END
$m1$;

COMMIT;
