-- Seed permissions matching what the Python business-service checks via
-- require_permission(...) in each module's router (see
-- backend/business-service/app/modules/*/infrastructure/api/router.py).
INSERT INTO permission (id, name) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'receiving:read'),
    ('a1000000-0000-0000-0000-000000000002', 'receiving:write'),
    ('a1000000-0000-0000-0000-000000000003', 'returns:read'),
    ('a1000000-0000-0000-0000-000000000004', 'returns:write');

INSERT INTO role (id, name) VALUES
    ('b1000000-0000-0000-0000-000000000001', 'ADMIN'),
    ('b1000000-0000-0000-0000-000000000002', 'WAREHOUSE_OPERATOR'),
    ('b1000000-0000-0000-0000-000000000003', 'RETURNS_CLERK');

-- ADMIN gets every permission that exists today.
INSERT INTO role_permission (role_id, permission_id)
SELECT 'b1000000-0000-0000-0000-000000000001', id FROM permission;

INSERT INTO role_permission (role_id, permission_id) VALUES
    ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001'),
    ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002'),
    ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003'),
    ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004');

-- Dev-only seed admin user: username "admin", password "ChangeMe123!"
-- (BCrypt hash below, strength 12). Rotate or remove this before any
-- shared/deployed environment - see docs/SECURITY.md.
INSERT INTO app_user (id, username, password_hash, enabled, created_at) VALUES
    ('c1000000-0000-0000-0000-000000000001', 'admin',
     '$2b$12$v4SE2ZyXn7bIiFeyuv.PUOvPItocSfXzE2pQs.MckVmUtIm.X9auO', TRUE, now());

INSERT INTO user_role (user_id, role_id) VALUES
    ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001');
