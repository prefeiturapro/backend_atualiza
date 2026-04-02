const express = require("express");
const router = express.Router();
const { dadosimoveis, buscarFotoImovel } = require("../controllers/dadosimoveis");

router.post("/dados", dadosimoveis);
router.post("/buscar-reduzido", dadosimoveis);
router.get("/foto", buscarFotoImovel);

module.exports = router;