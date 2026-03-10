const pool = require("./connection");

async function buscaLogradouros() {
    // Adicionado ORDER BY para facilitar a localização no combo do frontend
    const sql = `SELECT * FROM database.logradouros ORDER BY nm_logradouro ASC`;
    try {
        const { rows } = await pool.query(sql);
        return rows;        
    } catch (error) {
        console.error(`[MODEL LOGRADOUROS] ERRO CRÍTICO NO SQL:`, error.message);
        return [];
    }
}

async function buscarLogradouroPorNome(nome) {
    /**
     * 1. unaccent: remove acentos da busca e do banco.
     * 2. similarity: calcula o quão perto 'R. João' está de 'Rua João'.
     * 3. operador %: utiliza o índice GIST/GIN (se houver) para performance.
     */
    const sql = `
        SELECT 
            nm_logradouro,
            similarity(unaccent(nm_logradouro), unaccent($1)) as score
        FROM database.logradouros 
        WHERE 
            unaccent(nm_logradouro) % unaccent($1) -- Busca por similaridade
            OR unaccent(nm_logradouro) ILIKE unaccent('%' || $1 || '%') -- Fallback para busca parcial
        ORDER BY score DESC
        LIMIT 1
    `;
    
    try {
        const { rows } = await pool.query(sql, [nome]);
        
        // Definimos um score mínimo de 0.3 para evitar que ele retorne 
        // uma rua totalmente diferente se não houver nada parecido.
        if (rows.length > 0 && rows[0].score > 0.3) {
            return rows[0];
        }
        
        return null;
    } catch (error) {
        console.error(`[MODEL LOGRADOUROS] ERRO NA BUSCA POR SIMILARIDADE:`, error.message);
        return null;
    }
}

module.exports = {
    buscaLogradouros,
    buscarLogradouroPorNome
};