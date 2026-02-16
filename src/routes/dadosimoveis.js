const express = require("express");
const router = express.Router();
const { dadosimoveis } = require("../controllers/dadosimoveis");

// O prefixo "/dadosimoveis" já vem do seu index.js
// Então aqui você só coloca a parte final: "/dados"
router.post("/dados", dadosimoveis);
router.post("/buscar-reduzido", dadosimoveis);

module.exports = router;