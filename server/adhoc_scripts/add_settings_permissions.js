require('dotenv').config({ path: '../.env' });
const { getPool } = require('../db/pool');

async function addPermissions() {
  const pool = await getPool();
  try {
    // 1. Insert permissions
    const perms = [
      { name: "Read Settings", code: "settings.read", desc: "View application settings", resource: "settings", action: "read" },
      { name: "Update Settings", code: "settings.update", desc: "Update application settings", resource: "settings", action: "update" },
      { name: "Execute Raw SQL", code: "settings.query", desc: "Execute raw SQL queries against the DB", resource: "settings", action: "query" }
    ];

    for (const p of perms) {
      await pool.query(`
        INSERT INTO public.permissions (permission_name, permission_code, description, resource, action)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING;
      `, [p.name, p.code, p.desc, p.resource, p.action]);
    }
    console.log("Permissions created or already exist.");

    // 2. Get super_admin role_id
    const roleRes = await pool.query(`SELECT role_id FROM public.roles WHERE role_code = 'super_admin' LIMIT 1`);
    if (roleRes.rows.length === 0) {
      console.log("Could not find role 'super_admin'. Creating it...");
      await pool.query(`
        INSERT INTO public.roles (role_name, role_code, description, is_system_role)
        VALUES ('Super Admin', 'super_admin', 'System Administrator with full access to everything', true)
        ON CONFLICT DO NOTHING;
      `);
    }

    const { rows: roles } = await pool.query(`SELECT role_id FROM public.roles WHERE role_code = 'super_admin' LIMIT 1`);
    if (roles.length > 0) {
      const superAdminId = roles[0].role_id;
      
      // 3. Map permissions to super_admin
      const { rows: currPerms } = await pool.query(`
        SELECT permission_id FROM public.permissions 
        WHERE permission_code IN ('settings.read', 'settings.update', 'settings.query')
      `);

      for (const cp of currPerms) {
        await pool.query(`
          INSERT INTO public.role_permissions (role_id, permission_id, granted_by)
          VALUES ($1, $2, NULL)
          ON CONFLICT ON CONSTRAINT uq_role_permission DO NOTHING;
        `, [superAdminId, cp.permission_id]);
      }
      console.log("Permissions mapped to super_admin.");
    }

  } catch (err) {
    console.error("Error setting up permissions:", err);
  } finally {
    process.exit(0);
  }
}

addPermissions();
