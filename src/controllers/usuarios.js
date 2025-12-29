const { buscaUsuarios } = require("../models/usuarios");

const loginUsuario = async (req, res) => {
  const { nome, senha } = req.body;

  if (!nome || !senha) {
    return res.status(400).json({ erro: "Usuário e senha são obrigatórios." });
  }

  try {
    // Passa o que veio do frontend para o banco
    const dados = await buscaUsuarios(nome, senha);
    
    // Se o array veio vazio, usuário não existe
    if (!dados || dados.length === 0) {
      return res.status(401).json({ erro: "Usuário ou senha incorretos." });
    }

    
    const usuarioEncontrado = dados[0];

    return res.json({
        auth: true,                                 
        id_usuarios: usuarioEncontrado.id_usuarios, 
        nome: usuarioEncontrado.nome                
    });

    // -----------------------------

  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
}

module.exports = {
  loginUsuario 
};