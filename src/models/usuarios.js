const pool = require("./connection");

async function buscaUsuarios(nome, senha) {
    if (!nome || !senha) {
        console.log("[MODEL] Erro: Nome ou senha vazios.");
        return [];
    }

    // Usando ILIKE no nome para ignorar maiúsculas/minúsculas
    const sql = `
        SELECT * FROM bauhaus.usuarios 
        WHERE nm_usuario ILIKE $1 AND ds_password = md5($2)
    `;

    try {
        const { rows } = await pool.query(sql, [nome, senha]);
        

        return rows;        
    } catch (error) {
        console.error(`[MODEL] ERRO CRÍTICO NO SQL:`, error.message);
        // Se der erro de coluna, vai aparecer aqui
        return [];
    }
}

async function GetSenhaCriptografada(nome, senha) {


    
}
  

  

module.exports = {
    buscaUsuarios  
};