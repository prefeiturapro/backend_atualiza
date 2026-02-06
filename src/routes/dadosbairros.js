const express = require("express");
const router = express.Router();

// Importamos ambas as funções do controller
const { dadosbairros, validarBairro } = require("../controllers/dadosbairros"); 

router.post("/dados", dadosbairros);

router.post("/validar", validarBairro);

module.exports = router;