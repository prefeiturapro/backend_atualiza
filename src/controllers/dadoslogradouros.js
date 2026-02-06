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
        
        // Se não encontrar, o frontend liberará a edição manual
        return res.json({ valido: false });
    } catch (error) {
        console.error("Erro ao validar logradouro:", error.message);
        res.status(500).json({ erro: error.message });
    }
}


const dadoslogradouros = async (req, res) => {
  try {
    const dados = await modellogradouros.buscaLogradouros();
    
    if (!dados || dados.length === 0) {
      return res.status(404).json({ erro: "Logradouros não encontrados." });
    }

    // Exemplo retornando apenas o primeiro para configuração
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

module.exports = { dadoslogradouros, validarLogradouro };