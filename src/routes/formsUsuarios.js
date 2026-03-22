const express = require("express");
const router = express.Router();

const {
    listarPermissoesUsuario,
    salvarPermissoes
} = require("../controllers/formsUsuarios");

router.get("/usuario/:id_usuarios", listarPermissoesUsuario);
router.post("/salvar", salvarPermissoes);

module.exports = router;
