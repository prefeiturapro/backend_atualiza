const modelDadosGerais = require("../models/dadosgerais");

async function buscarConfiguracoes(req, res) {
    try {
        const dados = await modelDadosGerais.obterDadosGerais();
        
        if (!dados) {
            return res.status(404).json({ 
                erro: "Configurações gerais não localizadas no banco de dados." 
            });
        }

        return res.json({
            sucesso: true,
            id_dados_gerais: dados.id_dados_gerais,
            nm_cliente: dados.nm_cliente,
            id_municipio_sede: dados.id_municipios,
            email_suporte: dados.ds_email_suporte
        });

    } catch (error) {
        console.error("[CONTROLLER] ERRO EM DADOS GERAIS:", error.message);
        res.status(500).json({ erro: "Erro interno ao carregar dados gerais." });
    }
}

module.exports = { buscarConfiguracoes };