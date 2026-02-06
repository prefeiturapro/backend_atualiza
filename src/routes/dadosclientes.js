const express = require("express");
const router = express.Router();

// Lembre-se que no seu controller você exportou como 'cadastroimovel'
// Se você não mudou o nome lá, importe assim:
const { dadosclientes } = require("../controllers/dadosclientes"); 


// Então aqui você só coloca a parte final: "/dados"
router.post("/dados", dadosclientes);

module.exports = router;