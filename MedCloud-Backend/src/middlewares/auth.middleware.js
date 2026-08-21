const jwt = require('jsonwebtoken');
const { getConnection, sql } = require('../db');

/**
 * Middleware para verificar la validez del token JWT enviado por el frontend.
 * Valida la existencia de token, inactividad/expiración y control de sesión única.
 */
const verificarToken = (req, res, next) => {
    // Buscamos el token que manda React en el header de Authorization
    const tokenHeader = req.headers['authorization'];
    
    if (!tokenHeader) {
        return res.status(403).json({ message: 'Acceso denegado. No hay token.' });
    }

    // Limpiamos el formato (separa la palabra "Bearer " del token real)
    const token = tokenHeader.split(' ')[1] || tokenHeader;

    // Verificamos que sea el mismo token que generó el Login
    jwt.verify(token, 'PALABRA_SECRETA_SUPER_SEGURA', async (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Token inválido o expirado' });
        }
        
        req.user = decoded; 

        // ── VALIDACIÓN DE SESIÓN ÚNICA SIMULTÁNEA ─────────────────────────
        // Verifica si el session_id embebido en el JWT coincide con el registrado en la BD.
        // Si el usuario inició sesión en otro dispositivo, session_token cambia e invalida esta petición.
        if (decoded.id && decoded.session_id) {
            try {
                const pool = await getConnection();
                const userRes = await pool.request()
                    .input('id', sql.Int, decoded.id)
                    .query('SELECT session_token FROM dbo.usuarios WHERE id = @id');

                if (userRes.recordset.length > 0) {
                    const activeSessionToken = userRes.recordset[0].session_token;
                    if (activeSessionToken && activeSessionToken !== decoded.session_id) {
                        return res.status(401).json({ 
                            message: 'Se ha iniciado sesión en otro dispositivo o ventana con este usuario.',
                            code: 'CONCURRENT_LOGIN_DISPLACED'
                        });
                    }
                }
            } catch (dbErr) {
                console.error("Error al validar sesión única en middleware:", dbErr.message);
            }
        }
        
        // ── VALIDACIÓN DEL TRIAL EXPIRADO CENTRALIZADA ─────────────────────────
        if (req.method !== 'GET') {
            const { trial_dias_restantes } = decoded;
            if (trial_dias_restantes !== undefined && trial_dias_restantes < 0) {
                return res.status(403).json({ 
                    message: 'El periodo de prueba ha expirado. Por favor, contacte a soporte para activar su licencia.',
                    code: 'TRIAL_EXPIRED'
                });
            }
        }
        
        next();
    });
};

module.exports = { verificarToken };
