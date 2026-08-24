// ============================================================================
// Controlador de Recuperación de Contraseña por Email
// Gestiona el flujo completo: solicitud → validación → cambio de contraseña
// ============================================================================

const { getConnection, sql } = require('../db');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ── Configuración del transporter de email ──────────────────────────────────
// Usa variables de entorno para la configuración SMTP.
const createTransporter = () => {
    // Sanitizamos la contraseña de aplicación de Google eliminando espacios en blanco
    const cleanPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true para 465, false para otros puertos
        auth: {
            user: process.env.SMTP_USER || '',
            pass: cleanPass
        }
    });
};

// ── Plantilla HTML del email de recuperación ────────────────────────────────
const buildResetEmailHTML = (username, resetLink) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background-color:#f0f2f5; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5; padding:40px 0;">
            <tr>
                <td align="center">
                    <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden;">
                        <!-- Header con gradiente -->
                        <tr>
                            <td style="background:linear-gradient(135deg,#3c23c9,#5b42f3); padding:32px 40px; text-align:center;">
                                <h1 style="color:#ffffff; margin:0; font-size:28px; font-weight:700; letter-spacing:-0.5px;">MedCloud</h1>
                                <p style="color:rgba(255,255,255,0.85); margin:8px 0 0; font-size:14px;">Plataforma de Gestión Clínica</p>
                            </td>
                        </tr>
                        <!-- Cuerpo del email -->
                        <tr>
                            <td style="padding:36px 40px;">
                                <h2 style="color:#1a1a2e; margin:0 0 8px; font-size:20px;">Recuperación de Contraseña</h2>
                                <p style="color:#64748b; margin:0 0 24px; font-size:14px; line-height:1.6;">
                                    Hola <strong style="color:#334155;">${username}</strong>, recibimos una solicitud para restablecer tu contraseña de acceso al sistema.
                                </p>
                                
                                <!-- Botón de acción -->
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="padding:8px 0 24px;">
                                            <a href="${resetLink}" 
                                               style="display:inline-block; background:linear-gradient(135deg,#3c23c9,#5b42f3); color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:25px; font-size:14px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">
                                                Restablecer Contraseña
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                <p style="color:#94a3b8; font-size:13px; line-height:1.6; margin:0 0 16px;">
                                    Si el botón no funciona, copiá y pegá este enlace en tu navegador:
                                </p>
                                <p style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; word-break:break-all; font-size:12px; color:#3c23c9; margin:0 0 24px;">
                                    ${resetLink}
                                </p>

                                <!-- Advertencia de expiración -->
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="background-color:#fef3c7; border:1px solid #fcd34d; border-radius:8px; padding:12px 16px;">
                                            <p style="color:#92400e; font-size:12px; margin:0; line-height:1.5;">
                                                ⏱️ <strong>Este enlace expira en 1 hora.</strong> Si no solicitaste este cambio, podés ignorar este mensaje con total seguridad.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color:#f8fafc; padding:20px 40px; border-top:1px solid #e2e8f0; text-align:center;">
                                <p style="color:#94a3b8; font-size:11px; margin:0;">
                                    © ${new Date().getFullYear()} MedCloud — Plataforma de Gestión Clínica Integral
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
};

// ============================================================================
// 1. SOLICITAR RECUPERACIÓN DE CONTRASEÑA
// POST /auth/forgot-password   Body: { email }
// ============================================================================
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    // Validación básica del campo email
    if (!email || !email.includes('@')) {
        return res.status(400).json({ message: 'Debés ingresar un email válido.' });
    }

    try {
        const pool = await getConnection();

        // Buscar usuario activo por email
        const result = await pool.request()
            .input('email', sql.VarChar, email.trim().toLowerCase())
            .execute('sp_GetUsuarioByEmail');

        // SEGURIDAD: Siempre retornar el mismo mensaje, sin importar si el email existe
        // Esto previene la enumeración de cuentas.
        if (result.recordset.length === 0) {
            console.log(`⚠️ Solicitud de recuperación para email NO REGISTRADO: ${email}`);
            return res.json({
                message: 'Si el email está registrado en el sistema, recibirás las instrucciones en tu bandeja de entrada.'
            });
        }

        const usuario = result.recordset[0];

        // Generar token criptográfico seguro (32 bytes = 64 caracteres hex)
        const token = crypto.randomBytes(32).toString('hex');

        // Calcular fecha de expiración (1 hora desde ahora)
        const fechaExpiracion = new Date(Date.now() + 60 * 60 * 1000);

        // Guardar token en la base de datos (invalida tokens previos automáticamente)
        await pool.request()
            .input('usuario_id', sql.Int, usuario.id)
            .input('token', sql.VarChar, token)
            .input('fecha_expiracion', sql.DateTime, fechaExpiracion)
            .execute('sp_CreatePasswordResetToken');

        // Construir el link de recuperación de forma dinámica según la web de origen
        let originUrl = null;
        if (req.headers.origin) {
            originUrl = req.headers.origin;
        } else if (req.headers.referer) {
            try { originUrl = new URL(req.headers.referer).origin; } catch (e) {}
        }

        const frontendUrl = process.env.FRONTEND_URL || originUrl || 'https://medcloud.ar';
        const resetLink = `${frontendUrl}/reset-password/${token}`;

        // Enviar el email
        const transporter = createTransporter();
        await transporter.sendMail({
            from: `"MedCloud" <${process.env.SMTP_USER || 'noreply@medcloud.com'}>`,
            to: usuario.email,
            subject: '🔐 MedCloud — Recuperación de Contraseña',
            html: buildResetEmailHTML(usuario.username, resetLink)
        });

        console.log(`📧 Email de recuperación enviado a: ${usuario.email} para usuario: ${usuario.username}`);

        res.json({
            message: 'Si el email está registrado en el sistema, recibirás las instrucciones en tu bandeja de entrada.'
        });

    } catch (error) {
        console.error('🚨 ERROR en forgotPassword:', error.message);
        res.status(500).json({ message: 'Ocurrió un error al procesar la solicitud. Intentá nuevamente más tarde.' });
    }
};

// ============================================================================
// 2. VALIDAR TOKEN DE RECUPERACIÓN
// POST /auth/validate-reset-token   Body: { token }
// ============================================================================
const validateResetToken = async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ valid: false, message: 'Token no proporcionado.' });
    }

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('token', sql.VarChar, token)
            .execute('sp_ValidatePasswordResetToken');

        if (result.recordset.length === 0) {
            return res.json({ valid: false, message: 'El enlace ha expirado o ya fue utilizado.' });
        }

        res.json({ valid: true, username: result.recordset[0].username });

    } catch (error) {
        console.error('🚨 ERROR en validateResetToken:', error.message);
        res.status(500).json({ valid: false, message: 'Error al validar el token.' });
    }
};

// ============================================================================
// 3. EJECUTAR CAMBIO DE CONTRASEÑA
// POST /auth/reset-password   Body: { token, newPassword }
// ============================================================================
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    // Validaciones básicas
    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Faltan datos obligatorios.' });
    }

    if (newPassword.length < 4) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 4 caracteres.' });
    }

    try {
        const pool = await getConnection();

        // Ejecutar el reset (el SP valida internamente el token y lanza error si es inválido)
        await pool.request()
            .input('token', sql.VarChar, token)
            .input('newPassword', sql.NVarChar, newPassword)
            .execute('sp_ResetPasswordByToken');

        console.log(`🔑 Contraseña restablecida exitosamente via token de recuperación.`);

        res.json({ message: 'Tu contraseña ha sido actualizada correctamente. Ya podés iniciar sesión.' });

    } catch (error) {
        console.error('🚨 ERROR en resetPassword:', error.message);

        // El SP lanza RAISERROR si el token es inválido/expirado
        if (error.message.includes('Token inválido o expirado')) {
            return res.status(400).json({ message: 'El enlace ha expirado o ya fue utilizado. Solicitá uno nuevo.' });
        }

        res.status(500).json({ message: 'Ocurrió un error al restablecer la contraseña.' });
    }
};

module.exports = { forgotPassword, validateResetToken, resetPassword };
