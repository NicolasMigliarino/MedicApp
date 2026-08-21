const { getConnection, sql } = require('../db');

// Obtener la caja activa de hoy y su resumen de cobros por método de pago
const getCajaActiva = async (req, res) => {
    try {
        const pool = await getConnection();
        
        // 1. Obtener la última caja abierta hoy (o el último estado abierto si hay alguno activo)
        const cajaResult = await pool.request()
            .query(`
                SELECT TOP 1 * FROM dbo.caja_diaria 
                WHERE estado = 'Abierta' 
                ORDER BY id DESC
            `);
        
        if (cajaResult.recordset.length === 0) {
            return res.json({ caja: null, resumen: [] });
        }

        const caja = cajaResult.recordset[0];

        // 2. Obtener el desglose de cobros de esta caja por método de pago
        const resumenResult = await pool.request()
            .input('caja_diaria_id', sql.Int, caja.id)
            .query(`
                SELECT metodo_pago, ISNULL(SUM(monto_bruto), 0.00) AS total
                FROM dbo.pagos
                WHERE caja_diaria_id = @caja_diaria_id
                GROUP BY metodo_pago
            `);

        res.json({
            caja,
            resumen: resumenResult.recordset
        });
    } catch (error) {
        console.error("Error al obtener caja activa:", error.message);
        res.status(500).send(error.message);
    }
};

// Abrir una nueva caja diaria
const abrirCaja = async (req, res) => {
    try {
        const { monto_apertura } = req.body;
        const usuario_id = req.user.id; // Obtenido del token jwt decodificado

        const pool = await getConnection();
        const result = await pool.request()
            .input('usuario_id', sql.Int, usuario_id)
            .input('monto_apertura', sql.Decimal(10, 2), monto_apertura || 0.00)
            .execute('sp_AbrirCaja');

        res.json({
            message: 'Caja abierta exitosamente',
            caja_diaria_id: result.recordset[0].caja_diaria_id,
            mensaje: result.recordset[0].mensaje
        });
    } catch (error) {
        console.error("Error al abrir caja:", error.message);
        res.status(500).send(error.message);
    }
};

// Cerrar la caja diaria activa
const cerrarCaja = async (req, res) => {
    try {
        const { caja_diaria_id, monto_cierre_real } = req.body;
        const usuario_id = req.user.id;

        if (!caja_diaria_id || monto_cierre_real === undefined) {
            return res.status(400).json({ message: 'El ID de la caja y el monto de cierre real son requeridos.' });
        }

        const pool = await getConnection();
        const result = await pool.request()
            .input('caja_diaria_id', sql.Int, caja_diaria_id)
            .input('usuario_cierre_id', sql.Int, usuario_id)
            .input('monto_cierre_real', sql.Decimal(10, 2), monto_cierre_real)
            .execute('sp_CerrarCaja');

        const balance = result.recordset[0];
        if (balance) {
            const dif = parseFloat(balance.diferencia || 0);
            if (dif === 0) {
                balance.diagnostico = '✔️ Caja Cuadrada Perfectamente';
            } else if (dif > 0) {
                balance.diagnostico = '🚨 Sobrante en Caja';
            } else {
                balance.diagnostico = '🚨 Faltante en Caja';
            }
        }

        res.json({
            message: 'Caja cerrada exitosamente',
            balance: balance
        });
    } catch (error) {
        console.error("Error al cerrar caja:", error.message);
        res.status(500).send(error.message);
    }
};

// Obtener el historial completo de cajas diarias cerradas
const getHistorialCajas = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query(`
                SELECT c.*, 
                       ua.username AS usuario_apertura_nombre,
                       uc.username AS usuario_cierre_nombre
                FROM dbo.caja_diaria c
                INNER JOIN dbo.usuarios ua ON c.usuario_apertura_id = ua.id
                LEFT JOIN dbo.usuarios uc ON c.usuario_cierre_id = uc.id
                ORDER BY c.fecha_apertura DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error al obtener historial de cajas:", error.message);
        res.status(500).send(error.message);
    }
};

// Obtener liquidaciones de profesionales
const getLiquidacion = async (req, res) => {
    try {
        const { profesional_id, fecha_desde, fecha_hasta } = req.query;

        if (!profesional_id || !fecha_desde || !fecha_hasta) {
            return res.status(400).json({ message: 'Se requiere profesional_id, fecha_desde y fecha_hasta en la consulta.' });
        }

        const pool = await getConnection();
        const result = await pool.request()
            .input('profesional_id', sql.Int, profesional_id)
            .input('fecha_desde', sql.Date, fecha_desde)
            .input('fecha_hasta', sql.Date, fecha_hasta)
            .execute('sp_GetLiquidacionProfesional');

        res.json({
            detalles: result.recordsets[0],
            consolidado: result.recordsets[1] ? result.recordsets[1][0] : null
        });
    } catch (error) {
        console.error("Error al obtener liquidaciones:", error.message);
        res.status(500).send(error.message);
    }
};

module.exports = {
    getCajaActiva,
    abrirCaja,
    cerrarCaja,
    getHistorialCajas,
    getLiquidacion
};
