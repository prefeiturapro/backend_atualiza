const express = require("express");
const router = express.Router();

const { buscarConfiguracoes } = require("../controllers/dadosgerais"); 

// Rota POST para buscar as configurações globais
router.post("/config", buscarConfiguracoes);

module.exports = router;