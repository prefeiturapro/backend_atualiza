const { buscaClientes } = require("../models/dadosclientes");

const dadosclientes = async (req, res) => {
  try {
    const dados = await buscaClientes();
    
    if (!dados || dados.length === 0) {
      return res.status(401).json({ erro: "Configurações do cliente não encontradas." });
    }

    const cliente = dados[0];


    const formatarFoto = (campo) => {
        if (campo && Buffer.isBuffer(campo)) {
            // Usamos PNG como padrão para logomarcas para suportar transparência
            return `data:image/png;base64,${campo.toString('base64')}`;
        }
        return null;
    };

    return res.json({
        auth: true,
        nm_cliente: cliente.nm_cliente,
        // CORREÇÃO: Enviamos com o nome exato que o Frontend espera
        by_brasaoprefeitura: formatarFoto(cliente.by_brasaoprefeitura)
    });

  } catch (error) {
    console.error("Erro na busca de clientes:", error); 
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
}

module.exports = { dadosclientes };