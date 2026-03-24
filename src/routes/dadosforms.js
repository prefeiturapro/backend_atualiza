const express = require("express");
const router = express.Router();
const { exigirAuth } = require("../middleware/auth");

const {
    listarForms,
    buscarFormPorId,
    criarForm,
    atualizarForm,
    excluirForm
} = require("../controllers/dadosforms");

router.get("/listar",           exigirAuth, listarForms);
router.get("/:id",              exigirAuth, buscarFormPorId);
router.post("/salvar",          exigirAuth, criarForm);
router.put("/atualizar/:id",    exigirAuth, atualizarForm);
router.delete("/excluir/:id",   exigirAuth, excluirForm);

module.exports = router;
