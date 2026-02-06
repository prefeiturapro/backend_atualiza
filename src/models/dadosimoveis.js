const pool = require("./connection");

async function buscaImoveis(inscricao, cpf) {
    if (!inscricao || !cpf) {
        console.log("[MODEL] Erro: Inscrição ou CPF vazios.");
        return [];
    }

    // Usando ILIKE no nome para ignorar maiúsculas/minúsculas
    
    const sql = `
    SELECT 
        id_dados_imoveis, nm_logradouro_imovel, ds_numero_imovel, nr_cep_imovel, 
        nm_bairro_imovel, ds_loteamento_imovel, ds_edificio_imovel, ds_fotoimovel,
        nm_responsavel, nr_cpf_resp, nm_logradouro_resp, ds_numero_resp, 
        nr_cep_resp, nm_bairro_resp, nr_telefone_resp, ds_email_resp, ds_foto_resp, ds_edificio_resp,
        ds_loteamento_resp, ds_inscricao, cd_reduzido, cd_responsavel
    FROM database.dados_imoveis 
    WHERE ds_inscricao ILIKE $1 AND nr_cpf_resp = $2
    `;
    
  
    try {
        const { rows } = await pool.query(sql, [inscricao, cpf]);
        

        return rows;        
    } catch (error) {
        console.error(`[MODEL] ERRO CRÍTICO NO SQL:`, error.message);
        // Se der erro de coluna, vai aparecer aqui
        return [];
    }
}

  

module.exports = {
    buscaImoveis  
};