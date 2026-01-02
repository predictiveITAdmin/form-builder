Forms
Roles
Users
Responses

INSERT INTO permissions (permission_name, permission_code, description, resource, action)
VALUES
-- Forms
('Create Forms', 'forms.create', 'Allows creating new forms.', 'forms', 'create'),
('View Forms', 'forms.read', 'Allows viewing forms.', 'forms', 'read'),
('Update Forms', 'forms.update', 'Allows editing existing forms.', 'forms', 'update'),
('Delete Forms', 'forms.delete', 'Allows deleting forms.', 'forms', 'delete'),

-- Roles
('Create Roles', 'roles.create', 'Allows creating new roles.', 'roles', 'create'),
('View Roles', 'roles.read', 'Allows viewing roles.', 'roles', 'read'),
('Update Roles', 'roles.update', 'Allows editing existing roles.', 'roles', 'update'),
('Delete Roles', 'roles.delete', 'Allows deleting roles.', 'roles', 'delete'),

-- Users
('Create Users', 'users.create', 'Allows creating new users.', 'users', 'create'),
('View Users', 'users.read', 'Allows viewing users.', 'users', 'read'),
('Update Users', 'users.update', 'Allows editing existing users.', 'users', 'update'),
('Delete Users', 'users.delete', 'Allows deleting users.', 'users', 'delete'),

-- Responses
('Create Responses','responses.create','Allows creating new responses.', 'responses', 'create'),
('View Responses', 'responses.read', 'Allows viewing responses.', 'responses', 'read'),
('Update Responses','responses.update','Allows editing existing responses.', 'responses', 'update'),
('Delete Responses','responses.delete','Allows deleting responses.', 'responses', 'delete');
