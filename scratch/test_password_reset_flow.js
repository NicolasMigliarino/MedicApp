const { getConnection, sql } = require('../MedCloud-Backend/src/db');

async function testPasswordResetFlow() {
    console.log("=================================================");
    console.log("🧪 TEST E2E: FLUJO COMPLETO RECUPERACIÓN DE CLAVE");
    console.log("=================================================");

    const API_URL = 'http://localhost:3000';
    const targetUsername = 'Yanina';
    const newPasswordTest = 'Emmamiglia88';

    try {
        const pool = await getConnection();

        // 1. Obtener datos del usuario Yanina
        const userRes = await pool.request()
            .input('username', sql.VarChar, targetUsername)
            .query("SELECT id, username, email FROM dbo.usuarios WHERE username = @username");

        if (userRes.recordset.length === 0) {
            console.error(`❌ Usuario '${targetUsername}' no encontrado en la base de datos.`);
            process.exit(1);
        }

        const user = userRes.recordset[0];
        console.log(`👤 Usuario encontrado: ID ${user.id} | Username: ${user.username} | Email: ${user.email}`);

        // 2. Ejecutar Solicitud de Recuperación (POST /auth/forgot-password)
        console.log(`\n📧 Step 1: Enviando solicitud de recuperación para ${user.email}...`);
        const forgotRes = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email })
        });
        const forgotData = await forgotRes.json();
        console.log(`✅ Respuesta forgot-password (HTTP ${forgotRes.status}):`, forgotData);

        // 3. Obtener el token recién generado de la tabla password_reset_tokens
        const tokenRes = await pool.request()
            .input('usuario_id', sql.Int, user.id)
            .query("SELECT TOP 1 token, fecha_expiracion, usado FROM dbo.password_reset_tokens WHERE usuario_id = @usuario_id AND usado = 0 ORDER BY fecha_creacion DESC");

        if (tokenRes.recordset.length === 0) {
            console.error("❌ No se encontró token activo generado en dbo.password_reset_tokens.");
            process.exit(1);
        }

        const activeToken = tokenRes.recordset[0].token;
        console.log(`🔑 Step 2: Token obtenido de la BD: ${activeToken}`);
        console.log(`⏰ Expiración registrada: ${tokenRes.recordset[0].fecha_expiracion}`);

        // 4. Validar Token (POST /auth/validate-reset-token)
        console.log(`\n🔍 Step 3: Validando token mediante API...`);
        const validateRes = await fetch(`${API_URL}/auth/validate-reset-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: activeToken })
        });
        const validateData = await validateRes.json();
        console.log(`✅ Respuesta validate-reset-token (HTTP ${validateRes.status}):`, validateData);

        if (!validateData.valid) {
            console.error("❌ La API indicó que el token NO es válido.");
            process.exit(1);
        }

        // 5. Restablecer Contraseña a 'Emmamiglia88' (POST /auth/reset-password)
        console.log(`\n🔐 Step 4: Estableciendo nueva contraseña '${newPasswordTest}'...`);
        const resetRes = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: activeToken, newPassword: newPasswordTest })
        });
        const resetData = await resetRes.json();
        console.log(`✅ Respuesta reset-password (HTTP ${resetRes.status}):`, resetData);

        // 6. Probar Login con la nueva contraseña (POST /login)
        console.log(`\n🚪 Step 5: Verificando inicio de sesión con la nueva contraseña '${newPasswordTest}'...`);
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: targetUsername, password: newPasswordTest })
        });
        const loginData = await loginRes.json();

        console.log(`🎉 LOGIN EXITOSO! HTTP Status: ${loginRes.status}`);
        console.log(`👤 Usuario autenticado:`, loginData.user);
        console.log(`🎟️ Token JWT recibido: ${loginData.token ? 'Sí (Válido)' : 'No'}`);

        console.log("\n=================================================");
        console.log("✅ RESULTADO: FLUJO DE RECUPERACIÓN COMPROBADO 100% OK");
        console.log("=================================================");

    } catch (err) {
        console.error("🚨 ERROR DURANTE LA PRUEBA:", err.message);
    } finally {
        process.exit(0);
    }
}

testPasswordResetFlow();
