const pool = require("./connection");

async function buscaBairros() {
    const sql = `SELECT * FROM database.bairros`;
    try {
        const { rows } = await pool.query(sql);
        return rows;        
    } catch (error) {
        console.error(`[MODEL] ERRO CRÍTICO NO SQL:`, error.message);
        return [];
    }
}

async function buscarBairroPorNome(nome) {
    // Busca aproximada para lidar com pequenas variações de acentuação ou espaços
    const sql = `
        SELECT nm_bairro 
        FROM database.bairros 
        WHERE nm_bairro ILIKE $1 
        LIMIT 1
    `;
    // O uso de % no início e fim permite achar "MINA DO MATO" se a IA ler apenas "MINA DO"
    const { rows } = await pool.query(sql, [`%${nome}%`]);
    return rows[0];
}

module.exports = {
    buscaBairros,
    buscarBairroPorNome
};