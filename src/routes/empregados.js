const express = require("express");
const { getEmpregado} = require("../controllers/empregados");


const rotaEmpregado = express.Router();


// 🟢 Carrega empregado
rotaEmpregado.get("/", getEmpregado);


module.exports = rotaEmpregado;
