const express = require("express");
const router = express.Router();

const {
    loginUsuario,
    recuperarSenha,
    proximoCdUsuario,
    listarUsuarios,
    buscarUsuarioPorId,
    criarUsuario,
    atualizarUsuario,
    alterarSenha,
    bloquearUsuario,
    desbloquearUsuario,
    excluirUsuario
} = require("../controllers/usuarios");

// Autenticação
router.post("/login", loginUsuario);
router.post("/recuperar-senha", recuperarSenha);

// Utilitários
router.get("/proximo-codigo", proximoCdUsuario);

// CRUD
router.get("/listar", listarUsuarios);
router.get("/:id", buscarUsuarioPorId);
router.post("/salvar", criarUsuario);
router.put("/atualizar/:id", atualizarUsuario);
router.put("/alterar-senha/:id", alterarSenha);
router.put("/bloquear/:id", bloquearUsuario);
router.put("/desbloquear/:id", desbloquearUsuario);
router.delete("/excluir/:id", excluirUsuario);

module.exports = router;
