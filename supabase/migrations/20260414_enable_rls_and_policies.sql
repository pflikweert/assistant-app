-- Deferred to phase 3.
-- Keep this migration as a no-op for now so schema preparation and backfill can
-- run before row-level security is enabled.

begin;
commit;
