const express = require('express');
const router = express.Router();
const notificacaoController = require('../controllers/notificacao');

// Rota chamada pelo seu handleSalvar no React
router.post('/enviar-email-protocolo', notificacaoController.enviarEmailProtocolo);

module.exports = router;