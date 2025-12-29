const pool = require("./connection")

const buscaEmpregados = async () => {
    const { rows } = await pool.query("SELECT * FROM database.empregados where id_empregados < 10");
    return rows;
}

module.exports = {
    buscaEmpregados
}