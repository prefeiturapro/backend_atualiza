const pool = require("./connection");

async function buscarMunicipioPadrao() {
    // Cruza a tabela de municípios com a de dados gerais (master)
    const sql = `
        SELECT m.id_municipios, m.nm_municipio 
        FROM database.municipios m
        INNER JOIN master.dados_gerais d ON d.id_municipios = m.id_municipios
        LIMIT 1
    `;
    
    try {
        const { rows } = await pool.query(sql);
        return rows[0];        
    } catch (error) {
        console.error(`[MODEL] ERRO NO SQL DE MUNICÍPIOS:`, error.message);
        throw error;
    }
}

module.exports = { buscarMunicipioPadrao };