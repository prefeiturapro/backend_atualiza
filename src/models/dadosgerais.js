const pool = require("./connection");

async function obterDadosGerais() {
    // Realiza o JOIN para buscar o nome do município baseado no ID cadastrado
    const sql = `
        SELECT 
            dg.*, 
            m.nm_municipio as nm_municipio_sede 
        FROM master.dados_gerais dg
        LEFT JOIN database.municipios m ON m.id_municipios = dg.id_municipios
        LIMIT 1
    `;
    try {
        const { rows } = await pool.query(sql);
        return rows[0];        
    } catch (error) {
        console.error(`[MODEL] ERRO AO BUSCAR DADOS GERAIS:`, error.message);
        throw error;
    }
}

async function atualizarDadosGerais(id, d) {
    const sql = `
        UPDATE master.dados_gerais SET
            nr_exercicio = $1, st_checkcpf = $2, st_checkcnpj = $3,
            ds_ftp = $4, nm_userftp = $5, ds_senhaftp = $6,
            st_logincpf = $7, st_logininscricao = $8, st_loginreduzido = $9,
            st_loginpornome = $10, st_logingovbr = $11, st_logincertificado = $12,
            st_aprovacaoaut = $13, st_login_cod_cont = $14, id_municipios = $15,
            st_bloqueioresp = $16
        WHERE id_dados_gerais = $17
    `;
    const values = [
        d.nr_exercicio, d.st_checkcpf, d.st_checkcnpj, d.ds_ftp, d.nm_userftp, d.ds_senhaftp,
        d.st_logincpf, d.st_logininscricao, d.st_loginreduzido, d.st_loginpornome,
        d.st_logingovbr, d.st_logincertificado, d.st_aprovacaoaut, d.st_login_cod_cont,
        d.id_municipios, d.st_bloqueioresp, id
    ];
    await pool.query(sql, values);
}

module.exports = { obterDadosGerais, atualizarDadosGerais };