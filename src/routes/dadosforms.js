const express = require("express");
const router = express.Router();

const {
    listarForms,
    buscarFormPorId,
    criarForm,
    atualizarForm,
    excluirForm
} = require("../controllers/dadosforms");

router.get("/listar", listarForms);
router.get("/:id", buscarFormPorId);
router.post("/salvar", criarForm);
router.put("/atualizar/:id", atualizarForm);
router.delete("/excluir/:id", excluirForm);

module.exports = router;
