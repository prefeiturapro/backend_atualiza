const express = require("express");
const router = express.Router();
const { buscarResumo, buscarEvolucao, buscarPorBairro, buscarSemAtualizacaoPorBairro } = require("../controllers/dashboard");

router.get("/resumo",            buscarResumo);
router.get("/evolucao",          buscarEvolucao);
router.get("/por-bairro",        buscarPorBairro);
router.get("/sem-atualizacao",   buscarSemAtualizacaoPorBairro);

module.exports = router;
