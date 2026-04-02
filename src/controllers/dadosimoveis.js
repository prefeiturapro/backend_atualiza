const { buscaImoveisDinamica } = require("../models/dadosimoveis");
const modelDadosGerais = require("../models/dadosgerais");
const pool = require("../models/connection");
const axios = require("axios");

const dadosimoveis = async (req, res) => {
    const { reduzido } = req.body;

    try {
        let dados;

        // 1. BUSCA O IMÓVEL (Sua lógica original)
        if (reduzido) {
            const sqlAdmin = `SELECT * FROM database.dados_imoveis WHERE cd_reduzido = $1`;
            const result = await pool.query(sqlAdmin, [reduzido]);
            dados = result.rows;
        } else {
            dados = await buscaImoveisDinamica(req.body);
        }

        if (!dados || dados.length === 0) {
            return res.status(404).json({ erro: "Cadastro não encontrado." });
        }

        const imovel = dados[0];

        // 2. BUSCA CONFIGURAÇÃO DE BLOQUEIO (Tabela master.dados_gerais)
        const configGeral = await modelDadosGerais.obterDadosGerais();
        
        // Verifica se a trava está ATIVA (N = Bloqueia quem tem CMC)
        const bloqueioAtivo = configGeral.st_bloqueiacmc === 'N';
        
        // Verifica se o imóvel possui um CMC preenchido (diferente de nulo e zero)
        const temCMC = imovel.cd_cmc && imovel.cd_cmc !== 0 && imovel.cd_cmc !== "0";

        // 3. REGRA DE BLOQUEIO
        // Se a prefeitura bloqueia (N) E o imóvel tem CMC, retorna erro 403 (Proibido)
        if (bloqueioAtivo && temCMC) {
            return res.status(403).json({ 
                erro: "Este cadastro possui vínculo com CMC e não permite atualização online. Procure a prefeitura.",
                bloqueadoPeloCMC: true 
            });
        }

        // 4. SE PASSOU PELA REGRA, FORMATA AS FOTOS E RETORNA
        const formatarFoto = (campo) => {
            if (campo && Buffer.isBuffer(campo)) {
                return `data:image/jpeg;base64,${campo.toString('base64')}`;
            }
            return null;
        };

        return res.json({
            auth: true,
            ...imovel,
            ds_fotoimovel: formatarFoto(imovel.ds_fotoimovel),
            ds_foto_resp: formatarFoto(imovel.ds_foto_resp)
        });

    } catch (error) {
        console.error("Erro na busca de imóveis:", error);
        return res.status(500).json({ erro: "Erro interno do servidor." });
    }
}

/**
 * GET /dadosimoveis/foto?inscricao=XX
 * Busca a foto principal do imóvel na API de Fotos da Bauhaus.
 * Retorna { base64: "...", descricao: "..." } ou { base64: null } se não configurado/não encontrado.
 */
const buscarFotoImovel = async (req, res) => {
    const { reduzido } = req.query;
    console.log("[FOTO] ▶ Requisição recebida — cd_reduzido:", reduzido);

    if (!reduzido) return res.status(400).json({ erro: "Código reduzido não informado." });

    try {
        const config = await modelDadosGerais.obterDadosGerais();
        const { ds_api, ds_apitoken } = config;
        console.log("[FOTO]   ds_api    :", ds_api || "(não configurado)");
        console.log("[FOTO]   ds_apitoken:", ds_apitoken ? "(preenchido)" : "(vazio)");

        if (!ds_api) {
            console.log("[FOTO]   API não configurada — retornando null");
            return res.json({ base64: null });
        }

        const baseUrl = ds_api.replace(/\/$/, "");
        const urlRaw = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`;
        const url = `${urlRaw}/geo/api/ImagemImovel/${reduzido}`;
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            ...(ds_apitoken ? { Authorization: ds_apitoken } : {})
        };

        console.log("[FOTO]   GET", url);

        const resposta = await axios.get(url, { headers, timeout: 10000 });
        console.log("[FOTO]   HTTP status:", resposta.status);
        console.log("[FOTO]   Resposta:", JSON.stringify(resposta.data, null, 2).substring(0, 500));

        const imagem = resposta.data?.Imovel?.Imagem;

        if (!imagem || !imagem.ConteudoBase64) {
            console.log("[FOTO]   Nenhuma imagem encontrada no retorno da API");
            return res.json({ base64: null });
        }

        console.log("[FOTO] ✔ Foto encontrada — Descricao:", imagem.Descricao);
        return res.json({
            base64: imagem.ConteudoBase64,
            descricao: imagem.Descricao || ""
        });

    } catch (err) {
        console.error("[FOTO] ✖ Erro:", err.response?.status, err.message);
        if (err.response?.data) {
            console.error("[FOTO]   Detalhe:", JSON.stringify(err.response.data));
        }
        return res.json({ base64: null });
    }
};

module.exports = { dadosimoveis, buscarFotoImovel };