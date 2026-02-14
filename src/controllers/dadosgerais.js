const modelDadosGerais = require("../models/dadosgerais");

async function buscarConfiguracoes(req, res) {
    try {
        const dados = await modelDadosGerais.obterDadosGerais();
        
        if (!dados) {
            return res.status(404).json({ erro: "Configurações não localizadas." });
        }

        // --- MANTENDO SUAS PARTICULARIDADES ORIGINAIS ---
        const statusBloqueio = String(dados.st_bloqueioresp || "N").trim().toUpperCase();

        return res.json({
            sucesso: true,
            id_dados_gerais: dados.id_dados_gerais,
            nr_exercicio: dados.nr_exercicio, // Adicionado para o form
            id_municipio_sede: dados.id_municipios, // Seu mapeamento original
            nm_municipio_sede: dados.nm_municipio_sede,
            st_bloqueioresp: statusBloqueio, // Sua sanitização original
            st_checkcpf: dados.st_checkcpf,
            // Mantendo a estrutura para os demais campos da tabela
            st_checkcnpj: dados.st_checkcnpj,
            ds_ftp: dados.ds_ftp,
            nm_userftp: dados.nm_userftp,
            ds_senhaftp: dados.ds_senhaftp,
            st_logincpf: dados.st_logincpf,
            st_logininscricao: dados.st_logininscricao,
            st_loginreduzido: dados.st_loginreduzido,
            st_loginpornome: dados.st_loginpornome,
            st_logingovbr: dados.st_logingovbr,
            st_logincertificado: dados.st_logincertificado,
            st_aprovacaoaut: dados.st_aprovacaoaut,
            st_login_cod_cont: dados.st_login_cod_cont
        });

    } catch (error) {
        console.error("[CONTROLLER] ERRO:", error.message);
        res.status(500).json({ erro: "Erro interno ao carregar dados." });
    }
}

async function salvarConfiguracoes(req, res) {
    try {
        const { id } = req.params;
        const dadosParaSalvar = req.body;

        // Mapeando de volta o id_municipio_sede para id_municipios antes de enviar ao model
        if (dadosParaSalvar.id_municipio_sede) {
            dadosParaSalvar.id_municipios = dadosParaSalvar.id_municipio_sede;
        }

        await modelDadosGerais.atualizarDadosGerais(id, dadosParaSalvar);
        
        return res.json({ sucesso: true, mensagem: "Configurações salvas com sucesso!" });
    } catch (error) {
        console.error("[CONTROLLER] ERRO AO SALVAR:", error.message);
        res.status(500).json({ erro: "Erro ao atualizar configurações." });
    }
}

module.exports = { buscarConfiguracoes, salvarConfiguracoes };