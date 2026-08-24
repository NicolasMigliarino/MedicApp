const { getConnection } = require('../MedCloud-Backend/src/db');

async function checkEmails() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT id, username, email, activo FROM dbo.usuarios");
        console.log("📋 USUARIOS REGISTRADOS EN BD:");
        console.table(res.recordset);
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        process.exit(0);
    }
}

checkEmails();
