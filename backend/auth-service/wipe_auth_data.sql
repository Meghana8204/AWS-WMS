-- WARNING: This script deletes operational auth data but preserves the default admin user and RBAC seeds.

-- Clear logs and tokens
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE refresh_token CASCADE;

-- Delete all users except the seed admin
-- Admin ID: c1000000-0000-0000-0000-000000000001
DELETE FROM user_role WHERE user_id != 'c1000000-0000-0000-0000-000000000001';
DELETE FROM app_user WHERE id != 'c1000000-0000-0000-0000-000000000001';

-- Re-enable the admin user just in case
UPDATE app_user SET enabled = TRUE WHERE id = 'c1000000-0000-0000-0000-000000000001';

ANALYZE;
