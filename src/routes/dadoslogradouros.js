const express = require("express");
const router = express.Router();

// Importamos ambas as funções do controller
const { dadoslogradouros, validarLogradouro } = require("../controllers/dadoslogradouros"); 

router.post("/dados", dadoslogradouros);

router.post("/validar", validarLogradouro);

module.exports = router;