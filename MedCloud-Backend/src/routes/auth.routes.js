const { Router } = require('express');
const { login } = require('../controllers/auth.controllers');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/login', login);

router.get('/auth/verify-session', verificarToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

module.exports = router;