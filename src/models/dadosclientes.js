const pool = require("./connection");

async function buscaClientes() {
    const sql = `
        SELECT dc.*, m.nm_municipio
        FROM master.dados_cliente dc
        LEFT JOIN database.municipios m ON m.id_municipios = dc.id_municipios
        LIMIT 1
    `;
    try {
        const { rows } = await pool.query(sql);
        return rows;
    } catch (error) {
        console.error(`[MODEL] ERRO CRÍTICO NO SQL:`, error.message);
        return [];
    }
}

async function salvarDadosCliente(id, d, bufferBrasao, bufferBrasaoPrefeitura) {
    // Monta o SET dinâmico para as imagens (só atualiza se enviou novo arquivo)
    const params = [
        d.nm_cliente         || '',
        d.ds_endereco        || '',
        d.id_municipios      || null,
        d.ds_cabecalhorelatorio || '',
        d.ds_rodaperelatorio || '',
        d.ds_telefone        || '',
        d.ds_email           || ''
    ];

    let imagensSql = '';
    if (bufferBrasao) {
        params.push(bufferBrasao);
        imagensSql += `, by_brasao = $${params.length}`;
    }
    if (bufferBrasaoPrefeitura) {
        params.push(bufferBrasaoPrefeitura);
        imagensSql += `, by_brasaoprefeitura = $${params.length}`;
    }

    params.push(id);
    const sql = `
        UPDATE master.dados_cliente SET
            nm_cliente              = $1,
            ds_endereco             = $2,
            id_municipios           = $3,
            ds_cabecalhorelatorio   = $4,
            ds_rodaperelatorio      = $5,
            ds_telefone             = $6,
            ds_email                = $7
            ${imagensSql}
        WHERE id_dados_cliente = $${params.length}
    `;
    await pool.query(sql, params);
}

module.exports = { buscaClientes, salvarDadosCliente };
