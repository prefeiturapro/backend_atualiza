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
        
        // LOG 2: Ver o resultado do banco
        console.log(`[MODEL] Resultado do SQL: Encontrou ${rows.length} usuário(s).`);
        
        if (rows.length > 0) {
            console.log(`[MODEL] SUCESSO! Usuário encontrado: ID ${rows[0].id || 'S/ ID'}`);
        } else {
            console.log("[MODEL] FALHA: Nenhum usuário bateu com esse login e senha.");
        }
        console.log("---------------------------------------------------");

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