const express = require("express");
const { getResponsavel} = require("../controllers/responsavel");


const rotaResponsavel = express.Router();


// 🟢 Carrega Responsavel
rotaResponsavel.get("/:hora/:campo", getResponsavel);


module.exports = rotaResponsavel;
