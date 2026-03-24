const express = require("express");
const router = express.Router();
const multer = require("multer");
const { exigirAuth } = require("../middleware/auth");
const { ocrLimiter } = require("../middleware/rateLimiters");

const contribuinteController = require('../controllers/dadoscontribuintes');
const {
    salvarDadosContribuinte,
    processarComprovante,
    listarPedidosPendentes,
    listarHistoricoPedidos,
    validarPedidoPrefeitura,
    verificarStatusImovel,
    enviarComprovante,
    listarComprovantesRecusados,
    downloadComprovante,
    listarLoteamentos,
    listarEdificios
} = require("../controllers/dadoscontribuintes");

const storage = multer.memoryStorage();

// Validação de tipo de arquivo no multer (primeira camada de defesa)
const fileFilter = (req, file, cb) => {
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (tiposPermitidos.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não permitido. Envie JPG, PNG, WebP ou PDF.'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter
});

// ─── ROTAS PÚBLICAS (formulário do cidadão) ────────────────────────────────
router.get("/loteamentos",                  listarLoteamentos);
router.get("/edificios",                    listarEdificios);
router.get("/verificar-status/:reduzido",   verificarStatusImovel);
router.get('/validar-cpf/:cpf',             contribuinteController.validarCpfReceita);
router.post("/salvar",      upload.single("comprovante"), salvarDadosContribuinte);
router.post("/enviar-comprovante",          enviarComprovante);
router.post("/processar-comprovante",       ocrLimiter, upload.single("comprovante"), processarComprovante);

// ─── ROTAS ADMIN (exigem JWT) ──────────────────────────────────────────────
router.get("/pendentes",                    exigirAuth, listarPedidosPendentes);
router.get("/historico",                    exigirAuth, listarHistoricoPedidos);
router.get("/comprovantes-recusados",       exigirAuth, listarComprovantesRecusados);
router.get("/download/:id",                 exigirAuth, downloadComprovante);
router.post("/validar-pedido",              exigirAuth, validarPedidoPrefeitura);

module.exports = router;
