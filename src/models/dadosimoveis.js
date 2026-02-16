const pool = require("./connection");

async function buscaImoveisDinamica(filtros) {
    // 1. Limpeza rigorosa: mantém APENAS chaves que têm valores reais (nem "0", nem vazio)
    const filtrosReais = {};
    Object.keys(filtros).forEach(key => {
        const valor = filtros[key];
        if (valor !== null && valor !== undefined && valor.toString().trim() !== "" && valor.toString().trim() !== "0") {
            filtrosReais[key] = valor;
        }
    });

    const { ds_inscricao, nr_cpf_resp, cd_reduzido, cd_responsavel, nm_responsavel } = filtrosReais;
    
    let sql = `
        SELECT 
            id_dados_imoveis, nm_logradouro_imovel, ds_numero_imovel, nr_cep_imovel, 
            nm_bairro_imovel, ds_loteamento_imovel, ds_edificio_imovel, ds_fotoimovel,
            nm_responsavel, nr_cpf_resp, nm_logradouro_resp, ds_numero_resp, 
            nr_cep_resp, nm_bairro_resp, nr_telefone_resp, ds_email_resp, ds_foto_resp, ds_edificio_resp,
            ds_loteamento_resp, ds_inscricao, cd_reduzido, cd_responsavel
        FROM database.dados_imoveis 
        WHERE 1=1
    `;

    const values = [];
    let counter = 1;

    if (ds_inscricao) {
        sql += ` AND ds_inscricao ILIKE $${counter++}`;
        values.push(ds_inscricao.trim());
    }
    if (nr_cpf_resp) {
        sql += ` AND nr_cpf_resp = $${counter++}`;
        values.push(nr_cpf_resp.replace(/\D/g, "")); 
    }
    if (cd_reduzido) {
        sql += ` AND cd_reduzido = $${counter++}`;
        values.push(parseInt(cd_reduzido, 10));
    }
    if (cd_responsavel) {
        sql += ` AND cd_responsavel = $${counter++}`;
        values.push(parseInt(cd_responsavel, 10));
    }
    if (nm_responsavel) {
        sql += ` AND nm_responsavel ILIKE $${counter++}`;
        values.push(`%${nm_responsavel.trim()}%`);
    }

    if (values.length === 0) return [];

    try {
        console.log("SQL EXECUTADO:", sql);
        console.log("VALORES:", values);
        const { rows } = await pool.query(sql, values);
        return rows;
    } catch (error) {
        console.error(`[MODEL ERROR]`, error.message);
        throw error;
    }
}

// GARANTA QUE A EXPORTAÇÃO ESTEJA ASSIM:
module.exports = { buscaImoveisDinamica };