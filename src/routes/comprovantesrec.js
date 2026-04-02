const express = require("express");
const router = express.Router();
const multer = require("multer");
const { exigirAuth } = require("../middleware/auth");
const { salvarComprovanteRecusado, listarComprovantesRecusados, downloadComprovanteRecusado } = require("../controllers/comprovantesrec");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/salvar",          upload.single("comprovante"), salvarComprovanteRecusado);
router.get("/listar",           exigirAuth, listarComprovantesRecusados);
router.get("/download/:id",     exigirAuth, downloadComprovanteRecusado);

module.exports = router;
