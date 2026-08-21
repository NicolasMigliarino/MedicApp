const { getConnection, sql } = require('../db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Endpoint de Login de Usuario.
 * Autentica credenciales, genera un identificador único de sesión (session_id)
 * e inyecta el token JWT para control de sesión única y trial.
 */
const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await getConnection();

        // Ejecución del Stored Procedure centralizado para autenticación de usuario
        const result = await pool.request()
            .input('username', sql.VarChar, username)
            .execute('sp_LoginUsuario'); 

        // 1. Verificar si el usuario existe en la base de datos
        if (result.recordset.length === 0) {
            return res.status(400).json({ message: 'Usuario o contraseña incorrectos' });
        }

        const usuario = result.recordset[0];

        // 2. Verificar contraseña en texto plano
        if (usuario.password_hash !== password) {
            return res.status(400).json({ message: 'Usuario o contraseña incorrectos' });
        }

        // 3. Generar token único de sesión (para invalidar cualquier sesión previa en otro dispositivo)
        const session_id = crypto.randomUUID();

        try {
            await pool.request()
                .input('usuario_id', sql.Int, usuario.id)
                .input('session_token', sql.NVarChar(500), session_id)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.usuarios') AND name = 'session_token')
                    BEGIN
                        ALTER TABLE dbo.usuarios ADD session_token NVARCHAR(500) NULL;
                    END;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.usuarios') AND name = 'fecha_ultimo_acceso')
                    BEGIN
                        ALTER TABLE dbo.usuarios ADD fecha_ultimo_acceso DATETIME NULL;
                    END;
                    UPDATE dbo.usuarios
                    SET session_token = @session_token,
                        fecha_ultimo_acceso = GETDATE()
                    WHERE id = @usuario_id;
                `);
        } catch (sessErr) {
            console.error("⚠️ No se pudo actualizar el session_token del usuario:", sessErr.message);
        }

        // 4. Generación del JWT Token incluyendo session_id
        const token = jwt.sign(
            { 
                id: usuario.id, 
                username: usuario.username, 
                rol: usuario.rol_codigo,
                trial_dias_restantes: usuario.trial_dias_restantes,
                session_id
            },
            'PALABRA_SECRETA_SUPER_SEGURA',
            { expiresIn: '8h' }
        );

        // Retornamos el token y los datos básicos del usuario, incluyendo el estado de trial
        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: usuario.id,
                username: usuario.username,
                rol: usuario.rol_codigo,
                rol_nombre: usuario.rol_nombre,
                debe_cambiar_pass: usuario.debe_cambiar_pass,
                trial_dias_restantes: usuario.trial_dias_restantes 
            }
        });

    } catch (error) {
        console.error("Error en endpoint login:", error);
        res.status(500).send(error.message);
    }
};

module.exports = { login };