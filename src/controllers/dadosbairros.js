const modelBairros = require("../models/dadosbairros");

/**
 * Valida se o bairro extraído pela IA existe na base oficial
 */
async function validarBairro(req, res) {
    const { nm_bairro } = req.body;
    
    if (!nm_bairro) {
        return res.status(400).json({ erro: "Nome do bairro é obrigatório." });
    }

    try {
        const bairroEncontrado = await modelBairros.buscarBairroPorNome(nm_bairro);
        
        if (bairroEncontrado) {
            return res.json({ 
                valido: true, 
                nomeOficial: bairroEncontrado.nm_bairro 
            });
        }
        
        // Se não encontrar, o frontend liberará a edição manual
        return res.json({ valido: false });
    } catch (error) {
        console.error("Erro ao validar bairro:", error.message);
        res.status(500).json({ erro: error.message });
    }
}

/**
 * Retorna lista geral ou configurações de bairros
 */
const dadosbairros = async (req, res) => {
  try {
    const dados = await modelBairros.buscaBairros();
    
    if (!dados || dados.length === 0) {
      return res.status(404).json({ erro: "Bairros não encontrados." });
    }

    // Exemplo retornando apenas o primeiro para configuração
    const bairro = dados[0];

    return res.json({
        auth: true,
        nm_bairro: bairro.nm_bairro,
        cd_bairro: bairro.cd_bairro,
    });

  } catch (error) {
    console.error("Erro na busca de bairros:", error); 
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
}

module.exports = { dadosbairros, validarBairro };