const pool = require("./connection");

async function buscaBairros() {
    const sql = `SELECT * FROM database.bairros ORDER BY nm_bairro`;
    try {
        const { rows } = await pool.query(sql);
        return rows;        
    } catch (error) {
        console.error(`[MODEL] ERRO CRÍTICO NO SQL:`, error.message);
        return [];
    }
}

async function buscarBairroPorNome(nome) {
    // 1. Usamos o unaccent para ignorar acentos do banco e do que a IA leu
    // 2. O parâmetro $1 recebe o nome vindo do frontend
    // 3. O score de similarity ajuda a definir se o resultado é confiável
    const sql = `
        SELECT 
            nm_bairro, 
            similarity(unaccent(nm_bairro), unaccent($1)) as score
        FROM database.bairros
        WHERE 
            unaccent(nm_bairro) % unaccent($1) -- Busca por similaridade
            OR unaccent(nm_bairro) ILIKE unaccent($1 || '%') -- Ou se começa com o nome
        ORDER BY score DESC
        LIMIT 1;
    `;
    
    try {
        const { rows } = await pool.query(sql, [nome]);
        
        // Só retornamos se o nível de confiança for aceitável (ex: maior que 0.3)
        if (rows.length > 0 && rows[0].score > 0.3) {
            return rows[0];
        }
        return null;
    } catch (error) {
        console.error(`[MODEL] Erro na busca por similaridade:`, error.message);
        return null;
    }
}

module.exports = {
    buscaBairros,
    buscarBairroPorNome
};