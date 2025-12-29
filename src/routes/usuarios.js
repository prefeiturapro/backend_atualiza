const express = require("express");
const router = express.Router();

// Importe o controller que criamos (certifique-se que o nome da função está correto)
const { loginUsuario } = require("../controllers/usuarios"); 

router.post("/login", loginUsuario);

module.exports = router;
