const { getConnection, sql } = require('../db');
const { formatTelefonoAR } = require('../utils/phoneFormatter');

/**
 * Obtener lista de pacientes.
 * Si el usuario es un médico, se filtra para que solo acceda a los pacientes relacionados a sus turnos.
 */
const getPacientes = async (req, res) => {
    try {
        const pool = await getConnection();
        const request = pool.request();
        
        // Si el token inyectó el req.user, le pasamos su id al Stored Procedure para filtrado
        if (req.user && req.user.id) {
            request.input('usuario_id', sql.Int, req.user.id);
        }

        const result = await request.execute('sp_GetPacientes');
        res.json(result.recordset);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

/**
 * Obtener los datos de un paciente específico por su ID único.
 */
const getPaciente = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .execute('sp_GetPaciente'); 

        if (result.recordset.length === 0) return res.status(404).json({ message: 'Paciente no encontrado' });

        return res.json(result.recordset[0]);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

/**
 * Obtener el listado de obras sociales disponibles en la clínica.
 */
const getObrasSociales = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().execute('sp_GetObrasSociales');
        res.json(result.recordset);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

/**
 * Registrar un nuevo paciente.
 * Valida que el rol no sea MEDICO y formatea el número de teléfono para la integración con WhatsApp/n8n.
 */
const createPaciente = async (req, res) => {
    // Restricción de negocio: Los médicos no cargan ni editan pacientes (solo la administración)
    if (req.user && req.user.rol === 'MEDICO') {
        return res.status(403).json({ message: 'Acceso denegado. Los médicos no pueden registrar pacientes.' });
    }

    const { nombre, apellido, dni, telefono, email, fecha_nacimiento, obra_social_id, numero_afiliado, fecha_alta, sexo, grupo_sanguineo, direccion, contacto_emergencia, alergias } = req.body;
    
    // Normalizamos el teléfono para n8n en formato internacional de Argentina (+54 9...)
    const telefonoFormateado = formatTelefonoAR(telefono);

    try {
        const pool = await getConnection();
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('apellido', sql.VarChar, apellido)
            .input('dni', sql.VarChar, dni)
            .input('telefono', sql.VarChar, telefonoFormateado)
            .input('email', sql.VarChar, email)
            .input('fecha_nacimiento', sql.Date, fecha_nacimiento)
            
            // Si la obra social viene vacía, enviamos un null a la BD
            .input('obra_social_id', sql.Int, obra_social_id === '' ? null : obra_social_id)
            
            .input('numero_afiliado', sql.VarChar, numero_afiliado)
            .input('fecha_alta', sql.VarChar, fecha_alta)
            .input('sexo', sql.NVarChar, sexo || null)
            .input('grupo_sanguineo', sql.NVarChar, grupo_sanguineo || null)
            .input('direccion', sql.NVarChar, direccion || null)
            .input('contacto_emergencia', sql.NVarChar, contacto_emergencia || null)
            .input('alergias', sql.NVarChar, alergias || null)
            .execute('sp_CreatePaciente');

        res.json({ msg: 'Paciente registrado correctamente' });
    } catch (error) {
        console.error("🚨 ERROR SQL AL CREAR PACIENTE:", error.message);
        res.status(500).send(error.message);
    }
};

/**
 * Actualizar los datos de un paciente existente.
 * Valida restricciones de rol médico y normaliza el teléfono.
 */
const setPaciente = async (req, res) => {
    // Restricción de negocio: Los médicos no pueden modificar datos del paciente
    if (req.user && req.user.rol === 'MEDICO') {
        return res.status(403).json({ message: 'Acceso denegado. Los médicos no pueden editar pacientes.' });
    }

    const { id } = req.params;
    const { nombre, apellido, dni, email, telefono, fecha_nacimiento, obra_social_id, numero_afiliado, sexo, grupo_sanguineo, direccion, contacto_emergencia, alergias } = req.body;
    
    // Normalizamos el teléfono para n8n en formato internacional de Argentina (+54 9...)
    const telefonoFormateado = formatTelefonoAR(telefono);

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('nombre', sql.VarChar, nombre)
            .input('apellido', sql.VarChar, apellido)
            .input('dni', sql.VarChar, dni)
            .input('email', sql.VarChar, email)
            .input('telefono', sql.VarChar, telefonoFormateado)
            .input('fecha_nacimiento', sql.Date, fecha_nacimiento)
            .input('obra_social_id', sql.Int, obra_social_id === '' ? null : obra_social_id) 
            .input('numero_afiliado', sql.VarChar, numero_afiliado)
            .input('sexo', sql.NVarChar, sexo || null)
            .input('grupo_sanguineo', sql.NVarChar, grupo_sanguineo || null)
            .input('direccion', sql.NVarChar, direccion || null)
            .input('contacto_emergencia', sql.NVarChar, contacto_emergencia || null)
            .input('alergias', sql.NVarChar, alergias || null)
            .execute('sp_SetPaciente');

        if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'Paciente no encontrado' });

        res.json({ message: 'Paciente actualizado exitosamente' });
    } catch (error) {
        res.status(500).send(error.message);
    }
};

/**
 * Eliminar lógicamente o físicamente un paciente mediante el Stored Procedure.
 */
const deletePaciente = async (req, res) => {
    // Restricción de negocio: Los médicos no pueden dar de baja pacientes
    if (req.user && req.user.rol === 'MEDICO') {
        return res.status(403).json({ message: 'Acceso denegado. Los médicos no pueden eliminar pacientes.' });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .execute('sp_DeletePaciente');

        if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'Paciente no encontrado' });
        
    } catch (error) {
        res.status(500).send(error.message);
    }
};

/**
 * Obtener el resumen de métricas e historial de asistencia de un paciente.
 */
const getHistorialAsistenciaPaciente = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('paciente_id', sql.Int, req.params.id)
            .execute('sp_GetHistorialAsistenciaPaciente');

        const resumen = result.recordsets[0] ? result.recordsets[0][0] : {
            total_turnos: 0,
            total_asistidos: 0,
            total_ausentes: 0,
            total_cancelados: 0,
            total_pendientes: 0,
            tasa_asistencia: 0.00
        };

        const historial = result.recordsets[1] || [];

        res.json({
            resumen,
            historial
        });
    } catch (error) {
        console.error("Error al obtener historial de asistencia:", error.message);
        res.status(500).send(error.message);
    }
};

module.exports = { getPacientes, getPaciente, createPaciente, setPaciente, deletePaciente, getObrasSociales, getHistorialAsistenciaPaciente };