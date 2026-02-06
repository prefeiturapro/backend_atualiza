const { buscaImoveis } = require("../models/dadosimoveis");

const dadosimoveis = async (req, res) => {
  const { inscricao, cpf } = req.body;

  if (!inscricao || !cpf) {
    return res.status(400).json({ erro: "Inscrição e CPF são obrigatórios." });
  }

try {
    const dados = await buscaImoveis(inscricao, cpf);
    
    if (!dados || dados.length === 0) {
      return res.status(401).json({ erro: "Informações do cadastro incorretas." });
    }

    // AQUI: Vamos usar o nome 'imovel' consistentemente
    const imovel = dados[0];
    
    console.log("DEBUG BANCO - ds_fotoimovel:", imovel.ds_fotoimovel ? "Existe (Buffer)" : "Vazio/Undefined");
    
    const formatarFoto = (campo) => {
        if (campo && Buffer.isBuffer(campo)) {
            return `data:image/jpeg;base64,${campo.toString('base64')}`;
        }
        return null;
    };

    // CORREÇÃO: Usar 'imovel' em vez de 'imovelencontrado'
    return res.json({
        auth: true,
        ...imovel, 
        ds_fotoimovel: formatarFoto(imovel.ds_fotoimovel),
        ds_foto_resp: formatarFoto(imovel.ds_foto_resp)
    });

  } catch (error) {
    // Esse log vai te mostrar o erro de "imovelencontrado is not defined" se você não corrigir
    console.error("Erro na busca:", error); 
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
}

module.exports = { dadosimoveis };