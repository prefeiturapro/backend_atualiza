// ARQUIVO: backend/src/controllers/encomendas.js

// 1. Renomeamos na importação para evitar conflito (Alias)
// gravaEncomenda (do banco) vira gravaEncomendaModel
const { buscaEncomendas, gravaEncomenda: gravaEncomendaModel, FiltraEncomendas, atualizaEncomenda } = require("../models/encomendas");

const getEncomenda = async (req, res) => {
  const data = await buscaEncomendas();
  return res.json(data);
}

// 2. Mudamos o nome da função do Controller para 'criarEncomenda'
// ARQUIVO: backend/src/controllers/encomendas.js

const criarEncomenda = async (req, res) => {
    console.log("----------------------------------------------");
    console.log("[CONTROLLER] 1. Chegou na função criarEncomenda");
    
    try {
        const dados = req.body;
        console.log("[CONTROLLER] 2. Dados recebidos do Frontend:", dados);

        if (req.file) {
            console.log("Arquivo recebido na memória:", req.file.originalname);
            dados.ds_fototorta = req.file.buffer; // <--- O BINÁRIO ESTÁ AQUI
        }

        // Validação básica
        if (!dados.nm_nomefantasia || !dados.hr_horaenc || !dados.dt_abertura) {
            console.log("[CONTROLLER] ERRO: Campos obrigatórios faltando!");
            return res.status(400).json({ erro: "Nome, Data e Hora são obrigatórios." });
        }

        console.log("[CONTROLLER] 3. Tentando chamar o Model (gravaEncomendaModel)...");
        
        // Verifica se a função do model existe antes de chamar
        if (typeof gravaEncomendaModel !== 'function') {
            throw new Error("A função 'gravaEncomendaModel' não foi importada corretamente! Verifique o require.");
        }

        const novaEncomenda = await gravaEncomendaModel(dados);
        
        console.log("[CONTROLLER] 4. Sucesso! ID gerado:", novaEncomenda?.id_ordemservicos);
        
        return res.status(201).json({ 
            mensagem: "Encomenda cadastrada com sucesso!", 
            id: novaEncomenda.id_ordemservicos 
        });

    } catch (error) {
        console.log("------------------ ERRO FATAL ------------------");
        console.error("[CONTROLLER] O erro aconteceu aqui:", error.message);
        console.log("----------------------------------------------");
        return res.status(500).json({ erro: "Erro interno ao salvar encomenda." });
    }
};

const getFiltraEncomenda = async (req, res) => {
  const { nr_telefone, nm_nomefantasia, hr_horaenc, dt_abertura } = req.body;
  const data = await FiltraEncomendas(nr_telefone, nm_nomefantasia, hr_horaenc, dt_abertura)
  return res.json(data);
}

const updateEncomenda = async (req, res) => {
    const { id } = req.params;
    const dados = req.body;

    console.log(`[CONTROLLER] Atualizando encomenda ID: ${id}`);

    try {

        if (req.file) {
            console.log("Atualizando foto:", req.file.originalname);
            dados.ds_fototorta = req.file.buffer;
        }

        if (!id) {
            return res.status(400).json({ erro: "ID da encomenda é obrigatório." });
        }

        const encomendaAtualizada = await atualizaEncomenda(id, dados);

        if (!encomendaAtualizada) {
            return res.status(404).json({ erro: "Encomenda não encontrada para atualização." });
        }

        return res.json({ 
            mensagem: "Encomenda atualizada com sucesso!", 
            id: encomendaAtualizada.id_ordemservicos 
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ erro: "Erro interno ao atualizar." });
    }
};

module.exports = {
    getEncomenda,
    criarEncomenda,
    getFiltraEncomenda,
    updateEncomenda
};