// ARQUIVO: backend/src/controllers/encomendas.js

// 1. Renomeamos na importação para evitar conflito (Alias)
// gravaEncomenda (do banco) vira gravaEncomendaModel
const { buscaEncomendas, gravaEncomenda: gravaEncomendaModel, FiltraEncomendas, atualizaEncomenda } = require("../models/encomendas");

const getEncomenda = async (req, res) => {
  const result = await buscaEncomendas();
  return res.json(result);
}

// 2. Mudamos o nome da função do Controller para 'criarEncomenda'
// ARQUIVO: backend/src/controllers/encomendas.js

const criarEncomenda = async (req, res) => {
    console.log("----------------------------------------------");
    console.log("[CONTROLLER] 1. Chegou na função criarEncomenda");
    
    try {
        const dados = req.body;
        console.log("[CONTROLLER] 2. Dados recebidos do Frontend:", dados);

if (dados.ds_fototorta_base64) {
            try {
                console.log("[CONTROLLER] Convertendo foto Base64...");
                // Remove o cabeçalho "data:image/jpeg;base64," se existir e pega só o código
                const partes = dados.ds_fototorta_base64.split(';base64,');
                const base64Pura = partes.pop() || partes[0];
                
                // Converte para Buffer (formato que o banco aceita)
                dados.ds_fototorta = Buffer.from(base64Pura, 'base64');
            } catch (erroFoto) {
                console.error("Erro ao converter foto:", erroFoto);
            }
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

if (dados.ds_fototorta_base64) {
            try {
                console.log("[CONTROLLER] Convertendo foto Base64...");
                // Remove o cabeçalho "data:image/jpeg;base64," se existir e pega só o código
                const partes = dados.ds_fototorta_base64.split(';base64,');
                const base64Pura = partes.pop() || partes[0];
                
                // Converte para Buffer (formato que o banco aceita)
                dados.ds_fototorta = Buffer.from(base64Pura, 'base64');
            } catch (erroFoto) {
                console.error("Erro ao converter foto:", erroFoto);
            }
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