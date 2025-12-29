const express = require("express");
const router = express.Router(); // 1. Aqui você criou com o nome 'router'

// Importe as funções do Controller
const { getContribuinte, criarContribuinte, getIdentificadorContribuinte } = require("../controllers/contribuintes");

// Rotas Padrão
router.get("/", getContribuinte);
router.post("/", criarContribuinte);

// 🟢 Carrega Cliente por Telefone
// CORREÇÃO: Use 'router' aqui também
router.get("/:nr_telefone", getContribuinte); 
router.get("/:nr_telefone", getIdentificadorContribuinte); 

module.exports = router;