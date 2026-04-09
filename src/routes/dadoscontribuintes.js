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
    downloadContrato,
    listarLoteamentos,
    listarEdificios
} = require("../controllers/dadoscontribuintes");

const storage = multer.memoryStorage();

// Comprovante OCR: apenas imagens e PDF, máx 5 MB
const fileFilterComprovante = (req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (permitidos.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido. Envie JPG, PNG, WebP ou PDF.'), false);
};

// Contrato/Procuração: imagens, PDF e compactadores, máx 30 MB
// Valida pela extensão pois MIME de compactadores varia entre navegadores
const fileFilterContrato = (req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase().split('.').pop();
    const extsPermitidas = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'zip', 'rar', '7z'];
    if (extsPermitidas.includes(ext)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido para contrato. Envie JPG, PNG, PDF, ZIP, RAR ou 7Z.'), false);
};

// fileFilter combinado para upload.fields (aplica regra por campo)
const fileFilterSalvar = (req, file, cb) => {
    if (file.fieldname === 'contrato') return fileFilterContrato(req, file, cb);
    return fileFilterComprovante(req, file, cb);
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB — para comprovante OCR
    fileFilter: fileFilterComprovante
});

const uploadSalvar = multer({
    storage,
    limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB — comporta comprovante + contrato
    fileFilter: fileFilterSalvar
});

// ─── ROTAS PÚBLICAS (formulário do cidadão) ────────────────────────────────
router.get("/loteamentos",                  listarLoteamentos);
router.get("/edificios",                    listarEdificios);
router.get("/verificar-status/:reduzido",   verificarStatusImovel);
router.get('/validar-cpf/:cpf',             contribuinteController.validarCpfReceita);
router.post("/salvar",      uploadSalvar.fields([{ name: "comprovante", maxCount: 1 }, { name: "contrato", maxCount: 1 }]), salvarDadosContribuinte);
router.post("/enviar-comprovante",          enviarComprovante);
router.post("/processar-comprovante",       ocrLimiter, upload.single("comprovante"), processarComprovante);

// ─── ROTAS ADMIN (exigem JWT) ──────────────────────────────────────────────
router.get("/pendentes",                    exigirAuth, listarPedidosPendentes);
router.get("/historico",                    exigirAuth, listarHistoricoPedidos);
router.get("/comprovantes-recusados",       exigirAuth, listarComprovantesRecusados);
router.get("/download/:id",                 exigirAuth, downloadComprovante);
router.get("/download-contrato/:id",        exigirAuth, downloadContrato);
router.post("/validar-pedido",              exigirAuth, validarPedidoPrefeitura);

module.exports = router;
