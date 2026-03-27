const { buscaClientes, salvarDadosCliente } = require("../models/dadosclientes");

const formatarImagem = (campo) => {
    if (!campo) return null;
    const buf = Buffer.isBuffer(campo) ? campo : Buffer.from(campo);
    // Detecta PNG pelos magic bytes (89 50 4E 47)
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    const mime  = isPng ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
};

// GET /dadosclientes/config  — pública (usada no login e no formulário do cidadão)
const buscarConfig = async (req, res) => {
    try {
        const rows = await buscaClientes();
        if (!rows || rows.length === 0) {
            return res.status(404).json({ erro: "Configurações do cliente não encontradas." });
        }
        const c = rows[0];
        return res.json({
            sucesso: true,
            id_dados_cliente:       c.id_dados_cliente,
            nm_cliente:             c.nm_cliente,
            ds_endereco:            c.ds_endereco,
            id_municipios:          c.id_municipios,
            nm_municipio:           c.nm_municipio,
            ds_cabecalhorelatorio:  c.ds_cabecalhorelatorio,
            ds_rodaperelatorio:     c.ds_rodaperelatorio,
            ds_telefone:            c.ds_telefone,
            ds_email:               c.ds_email,
            by_brasao:              formatarImagem(c.by_brasao),
            by_brasaoprefeitura:    formatarImagem(c.by_brasaoprefeitura)
        });
    } catch (error) {
        console.error("[CLIENTE] Erro buscarConfig:", error.message);
        return res.status(500).json({ erro: "Erro interno do servidor." });
    }
};

// Mantido para compatibilidade com código legado que usa POST /dadosclientes/dados
const dadosclientes = async (req, res) => {
    try {
        const rows = await buscaClientes();
        if (!rows || rows.length === 0) {
            return res.status(401).json({ erro: "Configurações do cliente não encontradas." });
        }
        const c = rows[0];
        return res.json({
            auth: true,
            nm_cliente:          c.nm_cliente,
            by_brasaoprefeitura: formatarImagem(c.by_brasaoprefeitura)
        });
    } catch (error) {
        console.error("Erro na busca de clientes:", error);
        return res.status(500).json({ erro: "Erro interno do servidor." });
    }
};

// PUT /dadosclientes/config/:id  — protegida
const salvarConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const dados = req.body;
        const files = req.files || {};

        const bufferBrasao           = files.by_brasao?.[0]?.buffer           || null;
        const bufferBrasaoPrefeitura = files.by_brasaoprefeitura?.[0]?.buffer || null;

        await salvarDadosCliente(id, dados, bufferBrasao, bufferBrasaoPrefeitura);
        return res.json({ sucesso: true, mensagem: "Configurações salvas com sucesso!" });
    } catch (error) {
        console.error("[CLIENTE] Erro salvarConfig:", error.message);
        return res.status(500).json({ erro: "Erro ao salvar configurações." });
    }
};

module.exports = { dadosclientes, buscarConfig, salvarConfig };
