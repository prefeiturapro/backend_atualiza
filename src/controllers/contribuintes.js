// CORREÇÃO: Adicionei o "s" no final para ficar igual ao Model
const { buscaContribuintes, gravaContribuinte, getIDContribuinte } = require("../models/contribuintes"); 




const getIdentificadorContribuinte = async (req, res) => {
  const { nr_telefone } = req.params;

  try {
      // Chama a função com o nome correto (Plural)
      const data = await getIDContribuinte(nr_telefone);
      
      // Opcional: Se não achar ninguém, avisa (para não retornar array vazio e parecer que achou)
      if (!data || data.length === 0) {
          return res.status(404).json({ mensagem: "Contribuinte não encontrado" });
      }

      return res.json(data);

  } catch (error) {
      console.error(error);
      return res.status(500).json({ erro: "Erro ao buscar o ID do contribuinte" });
  }
}

const getContribuinte = async (req, res) => {
  const { nr_telefone } = req.params;

  try {
      // Chama a função com o nome correto (Plural)
      const data = await buscaContribuintes(nr_telefone);
      
      // Opcional: Se não achar ninguém, avisa (para não retornar array vazio e parecer que achou)
      if (!data || data.length === 0) {
          return res.status(404).json({ mensagem: "Contribuinte não encontrado" });
      }

      return res.json(data);

  } catch (error) {
      console.error(error);
      return res.status(500).json({ erro: "Erro ao buscar contribuinte" });
  }
}

const criarContribuinte = async (req, res) => {
    console.log("----------------------------------------------");
    console.log("[CONTROLLER] 1. Chegou na função criarcontribuinte");
    
    try {
        const dados = req.body;
        
        if (!dados.nm_nomefantasia || !dados.nr_telefone) {
            console.log("[CONTROLLER] ERRO: Campos obrigatórios faltando!");
            return res.status(400).json({ erro: "Nome e telefone são obrigatórios." });
        }

        console.log("[CONTROLLER] 3. Tentando chamar o Model (gravaContribuinte)...");
        
        // Verifica se a função do model existe antes de chamar
        if (typeof gravaContribuinte !== 'function') {
            throw new Error("A função 'gravaContribuinte' não foi importada corretamente! Verifique o require.");
        }

        const novaContribuinte = await gravaContribuinte(dados);
                
        return res.status(201).json({ 
            mensagem: "Cliente cadastrado com sucesso!", 
            id: novaContribuinte.id_contribuintes 
        });

    } catch (error) {
        console.log("------------------ ERRO FATAL ------------------");
        console.error("[CONTROLLER] O erro aconteceu aqui:", error.message);
        console.log("----------------------------------------------");
        return res.status(500).json({ erro: "Erro interno ao salvar o contribuinte." });
    }
}

module.exports = {
    getContribuinte,
    criarContribuinte,
    getIdentificadorContribuinte
}