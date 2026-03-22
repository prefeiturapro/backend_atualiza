const model = require("../models/formsUsuarios");

// ─── LISTAR PERMISSÕES DE UM USUÁRIO ─────────────────────────────────────────

const listarPermissoesUsuario = async (req, res) => {
    const { id_usuarios } = req.params;
    try {
        const dados = await model.listarPermissoesUsuario(id_usuarios);
        return res.json(dados);
    } catch (error) {
        console.error("Erro ao listar permissões:", error);
        return res.status(500).json({ erro: "Erro interno ao listar permissões." });
    }
};

// ─── SALVAR PERMISSÕES ────────────────────────────────────────────────────────

const salvarPermissoes = async (req, res) => {
    const { id_usuarios, permissoes, id_usuarioautorizacao } = req.body;

    if (!id_usuarios || !Array.isArray(permissoes)) {
        return res.status(400).json({ erro: "id_usuarios e permissoes são obrigatórios." });
    }

    try {
        await model.salvarPermissoes(id_usuarios, permissoes, id_usuarioautorizacao);
        return res.json({ mensagem: "Permissões salvas com sucesso." });
    } catch (error) {
        console.error("Erro ao salvar permissões:", error);
        return res.status(500).json({ erro: "Erro interno ao salvar permissões." });
    }
};

module.exports = {
    listarPermissoesUsuario,
    salvarPermissoes
};
