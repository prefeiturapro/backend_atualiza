const pool = require("./connection");

async function listarForms() {
    const sql = `SELECT * FROM master.forms ORDER BY nm_form`;
    try {
        const { rows } = await pool.query(sql);
        return rows;
    } catch (error) {
        console.error(`[MODEL] Erro ao listar forms:`, error.message);
        return [];
    }
}

async function buscarFormPorId(id) {
    const sql = `SELECT * FROM master.forms WHERE id_forms = $1`;
    try {
        const { rows } = await pool.query(sql, [id]);
        return rows[0] || null;
    } catch (error) {
        console.error(`[MODEL] Erro ao buscar form por ID:`, error.message);
        return null;
    }
}

async function criarForm(dados) {
    const { nm_form, ds_caption, ds_observacao, st_formreport } = dados;
    const sql = `
        INSERT INTO master.forms (nm_form, ds_caption, ds_observacao, st_formreport)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
    const { rows } = await pool.query(sql, [nm_form, ds_caption, ds_observacao, st_formreport]);
    return rows[0];
}

async function atualizarForm(id, dados) {
    const { nm_form, ds_caption, ds_observacao, st_formreport } = dados;
    const sql = `
        UPDATE master.forms
        SET nm_form = $1, ds_caption = $2, ds_observacao = $3, st_formreport = $4
        WHERE id_forms = $5
        RETURNING *
    `;
    const { rows } = await pool.query(sql, [nm_form, ds_caption, ds_observacao, st_formreport, id]);
    return rows[0] || null;
}

async function excluirForm(id) {
    const sql = `DELETE FROM master.forms WHERE id_forms = $1 RETURNING id_forms`;
    const { rows } = await pool.query(sql, [id]);
    return rows[0] || null;
}

module.exports = {
    listarForms,
    buscarFormPorId,
    criarForm,
    atualizarForm,
    excluirForm
};
