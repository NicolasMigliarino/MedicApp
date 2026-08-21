const { getConnection, sql } = require('../db');

// Obtener el historial de pagos de un paciente
const getHistorialPagosPaciente = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();
        const result = await pool.request()
            .input('paciente_id', sql.Int, id)
            .execute('sp_GetHistorialPagosPaciente');
            
        res.json(result.recordset);
    } catch (error) {
        console.error("🚨 ERROR AL OBTENER HISTORIAL DE PAGOS PACIENTE:", error.message);
        res.status(500).send(error.message);
    }
};

// Obtener el historial de pagos/liquidaciones realizados a un profesional
const getHistorialPagosProfesional = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();
        const result = await pool.request()
            .input('profesional_id', sql.Int, id)
            .execute('sp_GetHistorialPagosProfesional');
            
        res.json(result.recordset);
    } catch (error) {
        console.error("🚨 ERROR AL OBTENER HISTORIAL DE LIQUIDACIONES PROFESIONAL:", error.message);
        res.status(500).send(error.message);
    }
};

// Registrar una liquidación de honorarios pagada a un profesional
const registrarPagoProfesional = async (req, res) => {
    try {
        const { id } = req.params;
        const { monto, fecha_desde, fecha_hasta } = req.body;
        const usuario_registro_id = req.user ? req.user.id : 1; // Obtenido del token JWT

        if (!monto || !fecha_desde || !fecha_hasta) {
            return res.status(400).json({ message: 'El monto, fecha_desde y fecha_hasta son obligatorios.' });
        }

        let comprobante_url = null;
        if (req.file) {
            comprobante_url = '/uploads/' + req.file.filename;
        }

        const pool = await getConnection();
        await pool.request()
            .input('profesional_id', sql.Int, id)
            .input('monto', sql.Decimal(10, 2), monto)
            .input('fecha_desde', sql.Date, fecha_desde)
            .input('fecha_hasta', sql.Date, fecha_hasta)
            .input('comprobante_url', sql.NVarChar(255), comprobante_url)
            .input('usuario_registro_id', sql.Int, usuario_registro_id)
            .execute('sp_RegistrarPagoProfesional');

        res.json({ message: 'Pago de liquidación registrado correctamente.' });
    } catch (error) {
        console.error("🚨 ERROR AL REGISTRAR LIQUIDACIÓN PROFESIONAL:", error.message);
        res.status(500).send(error.message);
    }
};

module.exports = {
    getHistorialPagosPaciente,
    getHistorialPagosProfesional,
    registrarPagoProfesional
};
