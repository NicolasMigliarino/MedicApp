const { Router } = require('express');
const { verificarToken } = require('../middlewares/auth.middleware');
const { upload } = require('../controllers/archivos.controllers');
const { 
    getHistorialPagosPaciente, 
    getHistorialPagosProfesional, 
    registrarPagoProfesional 
} = require('../controllers/pagos.controllers');

const router = Router();

// Historial de pagos de pacientes
router.get('/pagos/paciente/:id', verificarToken, getHistorialPagosPaciente);

// Historial de liquidaciones pagadas a profesionales
router.get('/pagos/profesional/:id', verificarToken, getHistorialPagosProfesional);

// Registrar pago de liquidación a profesional (con comprobante)
router.post('/pagos/profesional/:id', verificarToken, upload.single('comprobante'), registrarPagoProfesional);

module.exports = router;
