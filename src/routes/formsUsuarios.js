const express = require("express");
const router = express.Router();
const { exigirAuth } = require("../middleware/auth");

const {
    listarPermissoesUsuario,
    salvarPermissoes
} = require("../controllers/formsUsuarios");

router.get("/usuario/:id_usuarios", exigirAuth, listarPermissoesUsuario);
router.post("/salvar",              exigirAuth, salvarPermissoes);

module.exports = router;
