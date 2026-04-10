const pool = require("./connection");

async function listar() {
    const { rows } = await pool.query(
        `SELECT id_comprovantesrecusados, dt_data, hr_hora
         FROM database.comprovantesrecusados
         ORDER BY dt_data DESC, hr_hora DESC`
    );
    return rows;
}

async function buscarPorId(id) {
    const { rows } = await pool.query(
        `SELECT id_comprovantesrecusados, ds_comprovanterecusado, dt_data, hr_hora
         FROM database.comprovantesrecusados
         WHERE id_comprovantesrecusados = $1`,
        [id]
    );
    return rows[0] || null;
}

module.exports = { listar, buscarPorId };
