const pool = require("./connection");

async function buscaClientes() {
    
    const sql = `
    SELECT * FROM master.dados_cliente`;
      
    try {
        const { rows } = await pool.query(sql);
        
        return rows;        
    } catch (error) {
        console.error(`[MODEL] ERRO CRÍTICO NO SQL:`, error.message);
        // Se der erro de coluna, vai aparecer aqui
        return [];
    }
}

  

module.exports = {
    buscaClientes  
};