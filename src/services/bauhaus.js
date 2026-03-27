/**
 * Serviço de integração com a API GEO da Bauhaus Sistemas
 *
 * Fluxo:
 *  1. cd_contribuinte > 0  → PUT direto pelo código
 *  2. cd_contribuinte == 0 → GET pelo CPF
 *       → encontrou: PUT pelo código retornado (salva código)
 *       → não encontrou: POST (salva código gerado)
 *
 * Nome enviado: sempre nm_contribuinte de database.dados_contribuintes
 */

const axios = require("axios");
const pool  = require("../models/connection");

async function buscarConfiguracaoBauhaus() {
    try {
        const { rows } = await pool.query(
            `SELECT ds_api, ds_apitoken FROM master.dados_gerais LIMIT 1`
        );
        return rows[0] || {};
    } catch (e) {
        console.error("[BAUHAUS] Erro ao buscar configuração:", e.message);
        return {};
    }
}

function montarPayloadBauhaus(p, codigo = null) {
    return {
        ...(codigo ? { Codigo: codigo } : {}),
        Identificacao: {
            Nome:         p.nm_contribuinte || "",
            NomeReduzido: p.nm_contribuinte || "",
            NomeFantasia: p.nm_contribuinte || "",
            TipoPessoa:   "F",
            Ativo:        true
        },
        Endereco: {
            Logradouro: {
                Nome: p.nm_rua_atual || "",
                Tipo: p.tp_rua_extr  || "RUA"
            },
            Numero:      p.ds_numero_atual     || "",
            Complemento: p.ds_complemento_atual || "",
            Bairro: {
                Nome: p.ds_bairro_atual || ""
            },
            Municipio: {
                Codigo: parseInt(p.id_municipioatual) || 0,
                Nome:   p.ds_cidade_atual || ""
            }
        },
        Documentacao: {
            Cpf:     (p.nr_cpf_atual || "").replace(/\D/g, ""),
            CpfCnpj: (p.nr_cpf_atual || "").replace(/\D/g, "")
        },
        Contato: {
            Email:    p.ds_email_atual    || "",
            Telefone: (p.nr_telefone_atual || "").replace(/\D/g, "")
        },
        OutrosDados: {}
    };
}

async function sincronizarContribuinteBauhaus(pedido) {
    console.log("=".repeat(60));
    console.log("[BAUHAUS] ▶ Iniciando sincronização");
    console.log(`[BAUHAUS]   nm_contribuinte : "${pedido.nm_contribuinte}"`);
    console.log(`[BAUHAUS]   nr_cpf_atual    : "${pedido.nr_cpf_atual}"`);
    console.log(`[BAUHAUS]   cd_contribuinte : ${pedido.cd_contribuinte}`);
    console.log(`[BAUHAUS]   id_municipioatual: ${pedido.id_municipioatual}`);

    const { ds_api, ds_apitoken } = await buscarConfiguracaoBauhaus();

    if (!ds_api) {
        console.warn("[BAUHAUS] ✖ ds_api não configurado — sincronização ignorada.");
        return { sucesso: false, acao: "ignorado", erro: "API não configurada." };
    }

    const urlRaw  = ds_api.replace(/\/$/, "");
    const baseUrl = /^https?:\/\//i.test(urlRaw) ? urlRaw : `https://${urlRaw}`;
    console.log(`[BAUHAUS]   baseUrl: ${baseUrl}`);

    const headers = {
        "Content-Type": "application/json",
        "Accept":        "application/json",
        ...(ds_apitoken ? { Authorization: ds_apitoken } : {})
    };

    const cpf            = (pedido.nr_cpf_atual || "").replace(/\D/g, "");
    const cdContribuinte = parseInt(pedido.cd_contribuinte) || 0;

    console.log(`[BAUHAUS]   cpf (limpo)     : "${cpf}"`);
    console.log(`[BAUHAUS]   cdContribuinte  : ${cdContribuinte}`);

    try {
        // ── Regra 5: cd_contribuinte preenchido → PUT direto ─────────────────
        if (cdContribuinte > 0) {
            console.log(`[BAUHAUS] → FASE: cd_contribuinte=${cdContribuinte} preenchido, executando PUT direto`);
            const payload = montarPayloadBauhaus(pedido, cdContribuinte);
            const url = `${baseUrl}/geo/api/contribuinte/${cdContribuinte}`;
            console.log(`[BAUHAUS]   PUT ${url}`);
            console.log("[BAUHAUS]   Payload:", JSON.stringify(payload, null, 2));
            const res = await axios.put(url, payload, { headers, timeout: 10000 });
            console.log(`[BAUHAUS] ✔ PUT direto OK — status HTTP ${res.status}`);
            return { sucesso: true, acao: "atualizado", codigo: cdContribuinte };
        }

        // ── Regra 1: cd_contribuinte = 0 → busca pelo CPF ────────────────────
        console.log(`[BAUHAUS] → FASE: cd_contribuinte=0, buscando na API pelo CPF "${cpf}"`);
        let codigoBauhaus = 0;

        if (cpf) {
            const urlGet = `${baseUrl}/geo/api/contribuinte?CPF=${cpf}`;
            console.log(`[BAUHAUS]   GET ${urlGet}`);
            try {
                const resGet = await axios.get(urlGet, { headers, timeout: 10000 });
                // A API retorna { Pages: {...}, Dados: [...] }
                const lista = Array.isArray(resGet.data)
                    ? resGet.data
                    : Array.isArray(resGet.data?.Dados) ? resGet.data.Dados : [];
                console.log(`[BAUHAUS]   Resposta GET — ${lista.length} registro(s) retornado(s)`);
                if (lista.length > 0) {
                    // Prioriza o primeiro ativo (Desativado !== "S"), senão usa o primeiro
                    const ativo = lista.find(r => r.OutrosDados?.Desativado !== "S") || lista[0];
                    console.log(`[BAUHAUS]   Registro selecionado: Codigo=${ativo.Codigo}, Desativado=${ativo.OutrosDados?.Desativado}`);
                    codigoBauhaus = parseInt(ativo.Codigo || ativo.codigo || 0);
                    console.log(`[BAUHAUS]   Código extraído da resposta: ${codigoBauhaus}`);
                } else {
                    console.log("[BAUHAUS]   Nenhum contribuinte encontrado pelo CPF");
                }
            } catch (errGet) {
                console.warn(`[BAUHAUS]   GET por CPF falhou — status: ${errGet.response?.status || "sem status"}, mensagem: ${errGet.message}`);
                console.warn("[BAUHAUS]   Tratando como contribuinte não encontrado na Bauhaus");
            }
        } else {
            console.warn("[BAUHAUS]   CPF vazio — pulando busca por CPF");
        }

        // ── Regra 3: encontrado pelo CPF → PUT ───────────────────────────────
        if (codigoBauhaus > 0) {
            console.log(`[BAUHAUS] → FASE: contribuinte encontrado via CPF (código=${codigoBauhaus}), executando PUT`);
            const payload = montarPayloadBauhaus(pedido, codigoBauhaus);
            const url = `${baseUrl}/geo/api/contribuinte/${codigoBauhaus}`;
            console.log(`[BAUHAUS]   PUT ${url}`);
            console.log("[BAUHAUS]   Payload:", JSON.stringify(payload, null, 2));
            const res = await axios.put(url, payload, { headers, timeout: 10000 });
            console.log(`[BAUHAUS] ✔ PUT via CPF OK — status HTTP ${res.status}`);
            return { sucesso: true, acao: "atualizado_via_cpf", codigo: codigoBauhaus };
        }

        // ── Regra 2: não encontrado → POST ───────────────────────────────────
        console.log("[BAUHAUS] → FASE: contribuinte NÃO encontrado, executando POST (novo)");
        const payload = montarPayloadBauhaus(pedido);
        const urlPost = `${baseUrl}/geo/api/contribuinte`;
        console.log(`[BAUHAUS]   POST ${urlPost}`);
        console.log("[BAUHAUS]   Payload:", JSON.stringify(payload, null, 2));
        const resPost = await axios.post(urlPost, payload, { headers, timeout: 10000 });
        console.log(`[BAUHAUS]   POST status HTTP ${resPost.status}`);
        console.log("[BAUHAUS]   Resposta POST:", JSON.stringify(resPost.data, null, 2));
        const codigoCriado = parseInt(
            resPost.data?.Codigo ||
            resPost.data?.codigo ||
            resPost.data?.Identificacao?.Codigo ||
            resPost.data?.Message?.Detail ||
            0
        );
        console.log(`[BAUHAUS] ✔ POST OK — código gerado: ${codigoCriado}`);
        return { sucesso: true, acao: "incluido", codigo: codigoCriado };

    } catch (err) {
        const status  = err.response?.status;
        const detalhe = err.response?.data || err.message;
        console.error(`[BAUHAUS] ✖ Erro na sincronização — HTTP ${status}`);
        console.error("[BAUHAUS]   Detalhe:", typeof detalhe === "object" ? JSON.stringify(detalhe, null, 2) : detalhe);
        return {
            sucesso: false,
            acao:    "erro",
            erro:    typeof detalhe === "object" ? JSON.stringify(detalhe) : detalhe
        };
    } finally {
        console.log("=".repeat(60));
    }
}

module.exports = { sincronizarContribuinteBauhaus };
