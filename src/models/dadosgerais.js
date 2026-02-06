const pool = require("./connection");

async function obterDadosGerais() {
    // Busca as configurações mestre do sistema
    const sql = `
        SELECT 
            id_dados_gerais, 
            nm_cliente, 
            id_municipios, 
            ds_email_suporte 
        FROM master.dados_gerais 
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

module.exports = { obterDadosGerais };