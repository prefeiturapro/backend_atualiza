const { buscaResponsavel } = require("../models/responsavel");

const getResponsavel = async (req, res) => {
  const {hora, campo} = req.params;

  const data = await buscaResponsavel(hora, campo)
   return res.json(data);
}


module.exports = {
    getResponsavel
}