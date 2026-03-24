const express = require("express");
const router = express.Router();
const { exigirAuth } = require("../middleware/auth");
const { buscarResumo, buscarEvolucao, buscarPorBairro, buscarSemAtualizacaoPorBairro } = require("../controllers/dashboard");

router.get("/resumo",            exigirAuth, buscarResumo);
router.get("/evolucao",          exigirAuth, buscarEvolucao);
router.get("/por-bairro",        exigirAuth, buscarPorBairro);
router.get("/sem-atualizacao",   exigirAuth, buscarSemAtualizacaoPorBairro);

module.exports = router;
