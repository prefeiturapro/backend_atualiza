const express = require("express");
const router = express.Router();

const { buscarMunicipioSede, listarMunicipios } = require("../controllers/dadosmunicipios");

// Rota para identificar a cidade da prefeitura cliente
router.post("/padrao",  buscarMunicipioSede);
router.get("/listar",   listarMunicipios);

module.exports = router;