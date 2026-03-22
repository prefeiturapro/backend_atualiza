const express = require("express");
const router = express.Router();
const multer = require("multer"); 
const contribuinteController = require('../controllers/dadoscontribuintes');
// CORREÇÃO AQUI: Importamos as funções específicas diretamente
const {
    salvarDadosContribuinte,
    processarComprovante,
    listarPedidosPendentes,
    listarHistoricoPedidos,
    validarPedidoPrefeitura,
    verificarStatusImovel,
    enviarComprovante,
    listarComprovantesRecusados,
    downloadComprovante
} = require("../controllers/dadoscontribuintes");

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB por arquivo
});
// As rotas agora chamam as funções diretamente, sem o prefixo "controller."
router.get("/pendentes", listarPedidosPendentes);
router.get("/historico", listarHistoricoPedidos);
router.get("/comprovantes-recusados", listarComprovantesRecusados);
router.get("/download/:id", downloadComprovante);
router.post("/validar-pedido", validarPedidoPrefeitura);

// Rota original para salvar os dados no banco

router.post("/salvar", upload.single("comprovante"), salvarDadosContribuinte);


// ... restante do códig
router.get('/validar-cpf/:cpf', contribuinteController.validarCpfReceita);

router.get("/verificar-status/:reduzido", verificarStatusImovel);

// Rota de OCR
router.post("/processar-comprovante", upload.single("comprovante"), processarComprovante);
router.post("/enviar-comprovante", enviarComprovante);

module.exports = router;