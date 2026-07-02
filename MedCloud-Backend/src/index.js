require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

// IMPORTACIONES DE RUTAS
const pacientesRoutes = require('./routes/pacientes.routes');
const profesionalesRoutes = require('./routes/profesionales.routes');
const turnosRoutes = require('./routes/turnos.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const rolesRoutes = require('./routes/roles.routes');
const administrativosRoutes = require('./routes/administrativos.routes');
const historialRoutes = require('./routes/historial.routes');
const authRoutes = require('./routes/auth.routes');
const archivosRoutes = require('./routes/archivos.routes');
const cajaRoutes = require('./routes/caja.routes');
const passwordResetRoutes = require('./routes/passwordReset.routes');
const soporteRoutes = require('./routes/soporte.routes');

const app = express();

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// USO DE RUTAS
app.use(pacientesRoutes);
app.use(profesionalesRoutes);
app.use(turnosRoutes);
app.use(usuariosRoutes);
app.use(rolesRoutes);
app.use(administrativosRoutes);
app.use(historialRoutes);
app.use(authRoutes);
app.use(archivosRoutes);
app.use(cajaRoutes);
app.use(passwordResetRoutes);
app.use(soporteRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
const { iniciarScheduler } = require('./utils/scheduler');

// Manejo de errores (opcional pero recomendado)
app.use((err, req, res, next) => {
    return res.json({
        message: err.message
    });
});

app.listen(3000, () => {
    console.log('Server on port 3000');
    iniciarScheduler(); // Iniciar programador de recordatorios por email
});