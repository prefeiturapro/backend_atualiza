const express = require("express");
const router = express.Router();

// Lembre-se que no seu controller você exportou como 'cadastroimovel'
// Se você não mudou o nome lá, importe assim:
const { dadosimoveis } = require("../controllers/dadosimoveis"); 

// O prefixo "/dadosimoveis" já vem do seu index.js
// Então aqui você só coloca a parte final: "/dados"
router.post("/dados", dadosimoveis);

module.exports = router;