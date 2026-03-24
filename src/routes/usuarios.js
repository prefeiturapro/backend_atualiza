const express = require("express");
const router = express.Router();
const { exigirAuth } = require("../middleware/auth");
const { loginLimiter, recuperarSenhaLimiter } = require("../middleware/rateLimiters");

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

// ─── ROTAS PÚBLICAS (sem JWT) ──────────────────────────────────────────────
router.post("/login",           loginLimiter,          loginUsuario);
router.post("/recuperar-senha", recuperarSenhaLimiter, recuperarSenha);

// ─── ROTAS ADMIN (exigem JWT) ──────────────────────────────────────────────
router.get("/proximo-codigo",   exigirAuth, proximoCdUsuario);
router.get("/listar",           exigirAuth, listarUsuarios);
router.get("/:id",              exigirAuth, buscarUsuarioPorId);
router.post("/salvar",          exigirAuth, criarUsuario);
router.put("/atualizar/:id",    exigirAuth, atualizarUsuario);
router.put("/alterar-senha/:id",exigirAuth, alterarSenha);
router.put("/bloquear/:id",     exigirAuth, bloquearUsuario);
router.put("/desbloquear/:id",  exigirAuth, desbloquearUsuario);
router.delete("/excluir/:id",   exigirAuth, excluirUsuario);

module.exports = router;
