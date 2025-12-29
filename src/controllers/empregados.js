const { buscaEmpregados } = require("../models/empregados");

const getEmpregado = async (req, res) => {
  const data = await buscaEmpregados()
   return res.json(data);
}


module.exports = {
    getEmpregado
}