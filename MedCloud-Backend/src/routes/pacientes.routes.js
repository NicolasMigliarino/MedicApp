const { Router } = require('express');
const { getPacientes,getPaciente,createPaciente,deletePaciente, setPaciente,getObrasSociales, getHistorialAsistenciaPaciente } = require('../controllers/pacientes.controllers');
const { verificarToken } = require('../middlewares/auth.middleware');
const router = Router();

// Cuando alguien visite "/pacientes", se ejecuta la función getPacientes
router.get('/pacientes', verificarToken, getPacientes);

// Ruta para obtener el historial de asistencia del paciente
router.get('/pacientes/:id/asistencia', verificarToken, getHistorialAsistenciaPaciente);

// La Singular para editar o ver un solo paciente
router.get('/pacientes/:id', verificarToken, getPaciente);

// Ruta para crear un nuevo paciente
router.post('/pacientes', verificarToken, createPaciente);

// PUT: Para editar. Se usa así: localhost:3000/pacientes/1
router.put('/pacientes/:id', verificarToken, setPaciente);

// DELETE: Para borrar. Se usa así: localhost:3000/pacientes/1
router.delete('/pacientes/:id', verificarToken, deletePaciente);

// NUEVA RUTA: Para obtener la lista de obras sociales
router.get('/obras-sociales', getObrasSociales);

module.exports = router;