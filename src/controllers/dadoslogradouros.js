const modelLogradouros = require("../models/dadoslogradouros");


async function validarLogradouro(req, res) {
    const { nm_logradouro } = req.body;
    
    if (!nm_logradouro) {
        return res.status(400).json({ erro: "Nome do logradouro é obrigatório." });
    }

    try {
        const logradouroEncontrado = await modelLogradouros.buscarLogradouroPorNome(nm_logradouro);
        
        if (logradouroEncontrado) {
            return res.json({ 
                valido: true, 
                nomeOficial: logradouroEncontrado.nm_logradouro
            });
        }
        
        return res.json({ valido: false });
    } catch (error) {
        console.error("Erro ao validar logradouro:", error.message);
        res.status(500).json({ erro: error.message });
    }
}

async function listarLogradouros(req, res) {
    try {
        const dados = await modelLogradouros.buscaLogradouros();
        if (!dados || dados.length === 0) {
            return res.status(404).json({ erro: "Nenhum logradouro encontrado." });
        }
        return res.json(dados);
    } catch (error) {
        console.error("Erro ao listar logradouros:", error);
        return res.status(500).json({ erro: "Erro interno do servidor." });
    }
}

const dadoslogradouros = async (req, res) => {
  try {
    const dados = await modelLogradouros.buscaLogradouros(); // Corrigido camelCase
    
    if (!dados || dados.length === 0) {
      return res.status(404).json({ erro: "Logradouros não encontrados." });
    }

    const logradouro = dados[0];

    return res.json({
        auth: true,
        nm_logradouro: logradouro.nm_logradouro,
        cd_logradouro: logradouro.cd_logradouro,
    });

  } catch (error) {
    console.error("Erro na busca de logradouros:", error); 
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
}


module.exports = { dadoslogradouros, validarLogradouro, listarLogradouros };