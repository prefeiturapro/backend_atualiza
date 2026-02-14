const express = require("express");
const router = express.Router();
const multer = require("multer"); 
const contribuinteController = require('../controllers/dadoscontribuintes');
// CORREÇÃO AQUI: Importamos as funções específicas diretamente
const { 
    salvarDadosContribuinte, 
    processarComprovante, 
    listarPedidosPendentes, 
    validarPedidoPrefeitura 
} = require("../controllers/dadoscontribuintes");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// As rotas agora chamam as funções diretamente, sem o prefixo "controller."
router.get("/pendentes", listarPedidosPendentes);
router.post("/validar-pedido", validarPedidoPrefeitura);

// Rota original para salvar os dados no banco
router.post("/salvar", salvarDadosContribuinte);
router.get('/validar-cpf/:cpf', contribuinteController.validarCpfReceita);

// Rota de OCR
router.post("/processar-comprovante", upload.single("comprovante"), processarComprovante);

module.exports = router;