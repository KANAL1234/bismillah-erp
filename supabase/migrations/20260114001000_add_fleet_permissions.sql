-- Fleet Module Permissions
INSERT INTO public.permissions (module, resource, action, permission_code, description) VALUES
('fleet', 'overview', 'view', 'fleet:overview:view', 'Access fleet dashboard'),
('fleet', 'vehicles', 'view', 'fleet:vehicles:view', 'View fleet vehicles'),
('fleet', 'vehicles', 'create', 'fleet:vehicles:create', 'Add new vehicle'),
('fleet', 'vehicles', 'update', 'fleet:vehicles:update', 'Edit vehicle details'),
('fleet', 'vehicles', 'delete', 'fleet:vehicles:delete', 'Delete vehicle'),
('fleet', 'drivers', 'view', 'fleet:drivers:view', 'View fleet drivers'),
('fleet', 'drivers', 'create', 'fleet:drivers:create', 'Add new driver'),
('fleet', 'drivers', 'update', 'fleet:drivers:update', 'Edit driver details'),
('fleet', 'drivers', 'delete', 'fleet:drivers:delete', 'Delete driver'),
('fleet', 'trips', 'view', 'fleet:trips:view', 'View trips'),
('fleet', 'trips', 'create', 'fleet:trips:create', 'Create new trip'),
('fleet', 'trips', 'update', 'fleet:trips:update', 'Edit trip details'),
('fleet', 'fuel', 'view', 'fleet:fuel:view', 'View fuel logs'),
('fleet', 'fuel', 'create', 'fleet:fuel:create', 'Log fuel expense'),
('fleet', 'fuel', 'update', 'fleet:fuel:update', 'Edit fuel record'),
('fleet', 'maintenance', 'view', 'fleet:maintenance:view', 'View maintenance records'),
('fleet', 'maintenance', 'create', 'fleet:maintenance:create', 'Log maintenance'),
('fleet', 'maintenance', 'update', 'fleet:maintenance:update', 'Edit maintenance record');

-- Assign to Super Admin
DO $$
DECLARE
    v_role_id uuid;
BEGIN
    SELECT id INTO v_role_id FROM public.roles WHERE role_code = 'SUPER_ADMIN';
    
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM public.permissions WHERE module = 'fleet';
END $$;
