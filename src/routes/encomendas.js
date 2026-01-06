// ARQUIVO: backend/src/routes/encomendas.js
const express = require("express");
const router = express.Router();
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Agora sim isso vai funcionar, pois exportamos 'criarEncomenda' no arquivo acima
const { getEncomenda, criarEncomenda, getFiltraEncomenda, updateEncomenda } = require("../controllers/encomendas");

// CORREÇÃO: Aponte para o arquivo correto do controller de processamento
// (Supondo que o arquivo seja controllers/processaencomenda.js)
const processaencomenda = require("../controllers/processaencomenda"); 

// ROTA EXISTENTE — lista todas as encomendas
router.get("/", getEncomenda);
router.post("/filtrar", getFiltraEncomenda);
router.post("/atualizar/:id", updateEncomenda);

// Agora 'criarEncomenda' existe e é uma função válida
router.post("/", criarEncomenda);

// NOVA ROTA — retorna uma encomenda detalhada
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        // Verifica se processaencomenda é uma função antes de chamar
        if (typeof processaencomenda !== 'function') {
             // Tenta pegar a função de dentro do objeto, caso tenha sido exportado como { processaencomenda }
             // ou lança erro se o arquivo não existir
             throw new Error("Controller processaencomenda não foi importado corretamente.");
        }

        const resultado = await processaencomenda(id);
       
        if (resultado.error) {
            return res.status(400).json({ error: resultado.error });
        }
        return res.json(resultado);
    } catch (error) {
        console.error("Erro na rota GET /encomendas/:id ->", error);
        return res.status(500).json({ error: "Erro interno ao processar encomenda." });
    }
});

module.exports = router;