const express = require("express");
const router = express.Router();

const { buscarMunicipioSede } = require("../controllers/dadosmunicipios"); 

// Rota para identificar a cidade da prefeitura cliente
router.post("/padrao", buscarMunicipioSede);

module.exports = router;