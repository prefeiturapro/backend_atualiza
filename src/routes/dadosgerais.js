const express = require("express");
const router = express.Router();
const { exigirAuth } = require("../middleware/auth");
const { buscarConfiguracoes, salvarConfiguracoes } = require("../controllers/dadosgerais");

// Pública: usada pelo formulário do cidadão para carregar logo/nome da prefeitura
router.get("/config", buscarConfiguracoes);

// Admin: apenas usuários autenticados podem alterar configurações
router.put("/config/:id", exigirAuth, salvarConfiguracoes);

module.exports = router;