const express = require("express");
const router = express.Router();
const { buscarConfiguracoes, salvarConfiguracoes } = require("../controllers/dadosgerais"); 

// Rota para carregar as configurações na tela
router.get("/config", buscarConfiguracoes); 

// NOVA ROTA: Rota para salvar as alterações (Update)
// O :id é o id_dados_gerais que vem do banco para garantir o registro único
router.put("/config/:id", salvarConfiguracoes); 

module.exports = router;