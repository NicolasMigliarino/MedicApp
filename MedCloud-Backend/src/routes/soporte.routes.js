const { Router } = require('express');
const { sendSupportTicketEmail } = require('../utils/emailSender');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/api/soporte', verificarToken, async (req, res) => {
    try {
        const { category, subject, description, contactEmail } = req.body;
        
        // req.user viene del token decodificado
        const { username, rol } = req.user;

        if (!category || !subject || !description || !contactEmail) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }

        await sendSupportTicketEmail(username, rol, category, subject, description, contactEmail);

        res.json({ message: 'El reporte de soporte fue enviado con éxito.' });
    } catch (error) {
        console.error('Error al enviar ticket de soporte:', error);
        res.status(500).json({ message: 'Hubo un error al enviar el reporte. Por favor intente más tarde.' });
    }
});

module.exports = router;
