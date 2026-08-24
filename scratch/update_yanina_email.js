const { getConnection } = require('../MedCloud-Backend/src/db');

async function updateYaninaEmail() {
    try {
        const pool = await getConnection();
        await pool.request()
            .input('email', 'nmigliarino@gmail.com')
            .query("UPDATE dbo.usuarios SET email = @email WHERE username = 'Yanina'");
        console.log("✅ Email de 'Yanina' actualizado exitosamente a 'nmigliarino@gmail.com'");
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        process.exit(0);
    }
}

updateYaninaEmail();
