const { getConnection, sql } = require('../db');
const { generarReciboEfectivo } = require('../utils/reciboHelper');
const path = require('path');
const fs = require('fs');
const getTurnos = async (req, res) => {
    try {
        // Extraemos los datos del usuario logueado desde el token (req.user)
        const usuario_id = req.user.id; 
        const rol_codigo = req.user.rol; 

        const pool = await getConnection();
        
        // Le pasamos las credenciales al Stored Procedure
        const result = await pool.request()
            .input('UsuarioID', sql.Int, usuario_id)
            .input('RolCodigo', sql.VarChar, rol_codigo)
            .execute('sp_GetTurnos');
            
        res.json(result.recordset);
    } catch (error) {
        console.error("🚨 ERROR AL OBTENER TURNOS:", error.message);
        res.status(500).send(error.message);
    }
};

const { sendPatientReminderEmail } = require('../utils/emailSender');

const enviarEmailRecordatorioHelper = async (turnoId, poolInstance) => {
    const pool = poolInstance || await getConnection();
    const result = await pool.request()
        .input('id', sql.Int, turnoId)
        .query(`
            SELECT 
                t.id, t.fecha_hora_inicio, t.fecha_hora_fin, t.estado, t.motivo_consulta,
                p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.email AS paciente_email,
                pr.nombre AS profesional_nombre, pr.apellido AS profesional_apellido, pr.especialidad AS profesional_especialidad
            FROM Turnos t
            INNER JOIN Pacientes p ON t.paciente_id = p.id
            INNER JOIN Profesionales pr ON t.profesional_id = pr.id
            WHERE t.id = @id
        `);

    if (result.recordset.length === 0) {
        throw new Error('Turno no encontrado');
    }

    const turnoInfo = result.recordset[0];
    if (!turnoInfo.paciente_email || !turnoInfo.paciente_email.includes('@')) {
        throw new Error('El paciente no tiene un email válido registrado.');
    }

    // Formatear fecha
    const dateObj = new Date(turnoInfo.fecha_hora_inicio);
    const fechaStr = dateObj.toLocaleDateString('es-AR') + ' a las ' + dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    // Enviar email
    await sendPatientReminderEmail(
        `${turnoInfo.paciente_nombre} ${turnoInfo.paciente_apellido}`,
        turnoInfo.paciente_email,
        `${turnoInfo.profesional_nombre} ${turnoInfo.profesional_apellido}`,
        turnoInfo.profesional_especialidad,
        fechaStr
    );

    // Actualizar flag
    await pool.request()
        .input('id', sql.Int, turnoId)
        .query('UPDATE Turnos SET recordatorio_dia_anterior_enviado = 1, recordatorio_enviado = 1 WHERE id = @id');
};

const createTurno = async (req, res) => {
    const { profesional_id, paciente_id, fecha_hora_inicio, fecha_hora_fin, estado, motivo_consulta, observaciones_admin } = req.body;
    try {
        const pool = await getConnection();
        await pool.request()
            .input('profesional_id', sql.Int, profesional_id)
            .input('paciente_id', sql.Int, paciente_id)
            .input('fecha_hora_inicio', sql.DateTime, fecha_hora_inicio)
            .input('fecha_hora_fin', sql.DateTime, fecha_hora_fin)
            .input('estado', sql.NVarChar, estado)
            .input('motivo_consulta', sql.NVarChar, motivo_consulta)
            .input('observaciones_admin', sql.NVarChar, observaciones_admin)
            .execute('sp_CreateTurno');
        
        res.json({ msg: 'Turno agendado correctamente' });
    } catch (error) {
        console.error("🚨 ERROR SQL AL CREAR TURNO:", error.message); 
        res.status(500).json({ message: error.message });
    }
};

// RENOMBRADO: setTurno
const setTurno = async (req, res) => {
    const { id } = req.params;
    const { profesional_id, paciente_id, fecha_hora_inicio, fecha_hora_fin, estado, motivo_consulta, observaciones_admin } = req.body;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('profesional_id', sql.Int, profesional_id)
            .input('paciente_id', sql.Int, paciente_id)
            .input('fecha_hora_inicio', sql.DateTime, fecha_hora_inicio)
            .input('fecha_hora_fin', sql.DateTime, fecha_hora_fin)
            .input('estado', sql.NVarChar, estado)
            .input('motivo_consulta', sql.NVarChar, motivo_consulta)
            .input('observaciones_admin', sql.NVarChar, observaciones_admin)
            .execute('sp_SetTurno');
        
        if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'Turno no encontrado' });

        res.json({ msg: 'Turno actualizado' });
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const deleteTurno = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .execute('sp_DeleteTurno');

        if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'Turno no encontrado' });

        return res.sendStatus(204);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const getHorarios = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().execute('sp_GetHorarios');
        res.json(result.recordset);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const registrarPagoTurno = async (req, res) => {
    try {
        const { id } = req.params;
        const { monto, metodo_pago } = req.body;

        if (!monto || !metodo_pago) {
            return res.status(400).json({ message: 'El monto y el método de pago son obligatorios.' });
        }

        const pool = await getConnection();

        let comprobante_url = null;
        if (req.file) {
            comprobante_url = '/uploads/' + req.file.filename;
        } else if (metodo_pago === 'Efectivo') {
            // Obtener datos para la plantilla del recibo
            const infoResult = await pool.request()
                .input('turno_id', sql.Int, id)
                .query(`
                    SELECT 
                        t.fecha_hora_inicio,
                        pac.nombre AS paciente_nombre, pac.apellido AS paciente_apellido, pac.dni AS paciente_dni,
                        prof.nombre AS profesional_nombre, prof.apellido AS profesional_apellido
                    FROM dbo.turnos t
                    INNER JOIN dbo.pacientes pac ON t.paciente_id = pac.id
                    INNER JOIN dbo.profesionales prof ON t.profesional_id = prof.id
                    WHERE t.id = @turno_id
                `);

            if (infoResult.recordset.length > 0) {
                const tInfo = infoResult.recordset[0];
                const pacienteFullName = `${tInfo.paciente_nombre} ${tInfo.paciente_apellido}`;
                const profesionalFullName = `Dr. ${tInfo.profesional_nombre} ${tInfo.profesional_apellido}`;
                const fechaConsulta = new Date(tInfo.fecha_hora_inicio).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
                
                const tempId = 'CASH_' + Date.now();
                comprobante_url = generarReciboEfectivo(pacienteFullName, tInfo.paciente_dni, profesionalFullName, fechaConsulta, parseFloat(monto), tempId);
            }
        }

        await pool.request()
            .input('turno_id', sql.Int, id)
            .input('monto', sql.Decimal(10, 2), monto)
            .input('metodo_pago', sql.VarChar(50), metodo_pago)
            .input('usuario_registro_id', sql.Int, req.user ? req.user.id : 1)
            .input('comprobante_url', sql.NVarChar(255), comprobante_url)
            .execute('sp_RegistrarPagoTurno');

        res.json({ 
            message: 'Pago registrado exitosamente. El turno ha sido Confirmado de forma automática.',
            comprobante_url 
        });
    } catch (error) {
        console.error("Error al registrar pago:", error.message);
        res.status(500).send(error.message);
    }
};

const registrarPagoMultiplesTurnos = async (req, res) => {
    try {
        const { turno_ids, monto, metodo_pago } = req.body;
        let ids = [];
        if (typeof turno_ids === 'string') {
            ids = JSON.parse(turno_ids);
        } else {
            ids = turno_ids;
        }

        if (!ids || ids.length === 0 || !monto || !metodo_pago) {
            return res.status(400).json({ message: 'Los IDs de turnos, el monto y el método de pago son obligatorios.' });
        }

        const pool = await getConnection();
        const montoIndividual = parseFloat(monto) / ids.length;
        
        let comprobante_url = null;
        if (req.file) {
            comprobante_url = '/uploads/' + req.file.filename;
        } else if (metodo_pago === 'Efectivo') {
            const infoResult = await pool.request()
                .query(`
                    SELECT 
                        t.id AS turno_id, t.fecha_hora_inicio,
                        pac.nombre AS paciente_nombre, pac.apellido AS paciente_apellido, pac.dni AS paciente_dni,
                        prof.nombre AS profesional_nombre, prof.apellido AS profesional_apellido
                    FROM dbo.turnos t
                    INNER JOIN dbo.pacientes pac ON t.paciente_id = pac.id
                    INNER JOIN dbo.profesionales prof ON t.profesional_id = prof.id
                    WHERE t.id IN (${ids.map(id => parseInt(id)).join(',')})
                `);

            if (infoResult.recordset.length > 0) {
                const tInfo = infoResult.recordset[0];
                const pacienteFullName = `${tInfo.paciente_nombre} ${tInfo.paciente_apellido}`;
                const tDni = tInfo.paciente_dni;
                
                const detailsText = infoResult.recordset.map(row => {
                    const dateStr = new Date(row.fecha_hora_inicio).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
                    return `Turno #${row.turno_id} - Dr. ${row.profesional_nombre} ${row.profesional_apellido} (${dateStr})`;
                }).join('<br>');

                const tempId = 'CASH_MULTI_' + Date.now();
                const filename = `recibo_efectivo_${tempId}_${Date.now()}.html`;
                const filepath = path.join(__dirname, '../../uploads', filename);

                const fechaPago = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

                const htmlContent = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <title>Recibo de Pago - MedCloud</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
                        .receipt-box { max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); font-size: 16px; line-height: 24px; color: #555; }
                        .title { font-size: 24px; font-weight: bold; color: #0f766e; text-align: center; margin-bottom: 20px; }
                        .header-table, .details-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        .header-table td { padding: 5px 0; }
                        .details-table th, .details-table td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                        .details-table th { background-color: #f2f2f2; font-weight: bold; }
                        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
                        .total { font-size: 18px; font-weight: bold; color: #333; text-align: right; margin-top: 10px; }
                    </style>
                </head>
                <body>
                    <div class="receipt-box">
                        <div class="title">🏥 MedCloud - Recibo de Pago (Adelanto)</div>
                        
                        <table class="header-table">
                            <tr>
                                <td><strong>Número de Recibo:</strong> #${tempId}</td>
                                <td style="text-align: right;"><strong>Fecha de Emisión:</strong> ${fechaPago}</td>
                            </tr>
                            <tr>
                                <td><strong>Paciente:</strong> ${pacienteFullName} (DNI: ${tDni})</td>
                                <td style="text-align: right;"><strong>Método de Pago:</strong> Efectivo</td>
                            </tr>
                        </table>

                        <table class="details-table">
                            <thead>
                                <tr>
                                    <th>Descripción / Turnos Adelantados</th>
                                    <th>Total por Turno</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${detailsText}</td>
                                    <td>$${montoIndividual.toFixed(2)} c/u</td>
                                </tr>
                            </tbody>
                        </table>

                        <div class="total">Total Cancelado: $${parseFloat(monto).toFixed(2)}</div>

                        <div class="footer">
                            MedCloud © 2026 - Sistema de Gestión Médica<br>
                            Este documento es un comprobante de pago oficial emitido por caja para múltiples consultas.
                        </div>
                    </div>
                </body>
                </html>
                `;

                const uploadsDir = path.join(__dirname, '../../uploads');
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }

                fs.writeFileSync(filepath, htmlContent, 'utf8');
                comprobante_url = `/uploads/${filename}`;
            }
        }

        const usuario_registro_id = req.user ? req.user.id : 1;
        
        for (const tId of ids) {
            await pool.request()
                .input('turno_id', sql.Int, parseInt(tId))
                .input('monto', sql.Decimal(10, 2), montoIndividual)
                .input('metodo_pago', sql.VarChar(50), metodo_pago)
                .input('usuario_registro_id', sql.Int, usuario_registro_id)
                .input('comprobante_url', sql.NVarChar(255), comprobante_url)
                .execute('sp_RegistrarPagoTurno');
        }

        res.json({ 
            message: 'Todos los pagos adelantados fueron registrados con éxito.',
            comprobante_url 
        });

    } catch (error) {
        console.error("🚨 ERROR AL REGISTRAR PAGOS MÚLTIPLES:", error.message);
        res.status(500).send(error.message);
    }
};

const enviarRecordatorioManual = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getConnection();
        await enviarEmailRecordatorioHelper(parseInt(id), pool);
        res.json({ message: 'Email de recordatorio enviado correctamente.' });
    } catch (error) {
        console.error("🚨 Error al enviar recordatorio manual:", error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { 
    getTurnos, 
    createTurno, 
    setTurno, 
    deleteTurno, 
    getHorarios, 
    registrarPagoTurno,
    registrarPagoMultiplesTurnos,
    enviarRecordatorioManual
};