const express = require("express");
const router = express.Router();
const { exigirAuth } = require("../middleware/auth");
const { listarComprovantesRecusados, downloadComprovanteRecusado } = require("../controllers/comprovantesrecusados");

router.get("/listar",           exigirAuth, listarComprovantesRecusados);
router.get("/download/:id",     exigirAuth, downloadComprovanteRecusado);

module.exports = router;
