const model = require("../models/usuarios");

// ─── PRÓXIMO CÓDIGO ───────────────────────────────────────────────────────────

const proximoCdUsuario = async (req, res) => {
    try {
        const proximo = await model.proximoCdUsuario();
        return res.json({ cd_usuario: proximo });
    } catch (error) {
        console.error("Erro ao buscar próximo código:", error);
        return res.status(500).json({ erro: "Erro interno." });
    }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────

const loginUsuario = async (req, res) => {
    const { nome, senha } = req.body;

    if (!nome || !senha) {
        return res.status(400).json({ erro: "Usuário e senha são obrigatórios." });
    }

    try {
        const usuario = await model.buscaUsuarios(nome, senha);

        if (!usuario) {
            return res.status(401).json({ erro: "Usuário ou senha incorretos." });
        }

        if (usuario.st_bloqueado === 'S') {
            return res.status(403).json({ erro: "Usuário bloqueado. Contate o administrador." });
        }

        return res.json({
            auth: true,
            id_usuarios: usuario.id_usuarios,
            cd_usuario: usuario.cd_usuario,
            nome: usuario.nm_usuario,
            email: usuario.ds_email,
            foto: usuario.by_foto
        });
    } catch (error) {
        console.error("Erro no login:", error);
        return res.status(500).json({ erro: "Erro interno do servidor." });
    }
};

// ─── LISTAR ───────────────────────────────────────────────────────────────────

const listarUsuarios = async (req, res) => {
    try {
        const dados = await model.listarUsuarios();
        return res.json(dados);
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        return res.status(500).json({ erro: "Erro interno ao listar usuários." });
    }
};

// ─── BUSCAR POR ID ────────────────────────────────────────────────────────────

const buscarUsuarioPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const usuario = await model.buscarUsuarioPorId(id);
        if (!usuario) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }
        return res.json(usuario);
    } catch (error) {
        console.error("Erro ao buscar usuário:", error);
        return res.status(500).json({ erro: "Erro interno ao buscar usuário." });
    }
};

// ─── CRIAR ────────────────────────────────────────────────────────────────────

const criarUsuario = async (req, res) => {
    const { nm_usuario, nr_cpf, dt_nascimento, ds_email, ds_password, by_foto, st_exibirfoto, id_usuarioscadastro } = req.body;

    if (!nm_usuario || !nr_cpf || !ds_email || !ds_password) {
        return res.status(400).json({ erro: "Nome de usuário, CPF, e-mail e senha são obrigatórios." });
    }

    if (ds_password.length < 8) {
        return res.status(400).json({ erro: "A senha deve ter no mínimo 8 caracteres." });
    }

    try {
        const nomeExiste = await model.verificarUsuarioExistente(nm_usuario);
        if (nomeExiste) {
            return res.status(409).json({ erro: "Já existe um usuário com este nome." });
        }

        if (nr_cpf) {
            const cpfExiste = await model.verificarCpfExistente(nr_cpf);
            if (cpfExiste) {
                return res.status(409).json({ erro: "CPF já cadastrado para outro usuário." });
            }
        }

        const novoUsuario = await model.criarUsuario({
            nm_usuario, nr_cpf, dt_nascimento, ds_email,
            ds_password, by_foto, st_exibirfoto, id_usuarioscadastro
        });
        return res.status(201).json(novoUsuario);
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        return res.status(500).json({ erro: "Erro interno ao criar usuário." });
    }
};

// ─── ATUALIZAR ────────────────────────────────────────────────────────────────

const atualizarUsuario = async (req, res) => {
    const { id } = req.params;
    const { nm_usuario, nr_cpf, dt_nascimento, ds_email, by_foto, st_exibirfoto } = req.body;

    if (!nm_usuario || !nr_cpf || !ds_email) {
        return res.status(400).json({ erro: "Nome de usuário, CPF e e-mail são obrigatórios." });
    }

    try {
        const nomeExiste = await model.verificarUsuarioExistente(nm_usuario, id);
        if (nomeExiste) {
            return res.status(409).json({ erro: "Já existe outro usuário com este nome." });
        }

        if (nr_cpf) {
            const cpfExiste = await model.verificarCpfExistente(nr_cpf, id);
            if (cpfExiste) {
                return res.status(409).json({ erro: "CPF já cadastrado para outro usuário." });
            }
        }

        const atualizado = await model.atualizarUsuario(id, { nm_usuario, nr_cpf, dt_nascimento, ds_email, by_foto, st_exibirfoto });
        if (!atualizado) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }
        return res.json(atualizado);
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        return res.status(500).json({ erro: "Erro interno ao atualizar usuário." });
    }
};

// ─── ALTERAR SENHA ────────────────────────────────────────────────────────────

const alterarSenha = async (req, res) => {
    const { id } = req.params;
    const { nova_senha } = req.body;

    if (!nova_senha || nova_senha.length < 8) {
        return res.status(400).json({ erro: "A senha deve ter no mínimo 8 caracteres." });
    }

    try {
        const resultado = await model.atualizarSenha(id, nova_senha);
        if (!resultado) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }
        return res.json({ mensagem: "Senha alterada com sucesso." });
    } catch (error) {
        console.error("Erro ao alterar senha:", error);
        return res.status(500).json({ erro: "Erro interno ao alterar senha." });
    }
};

// ─── BLOQUEAR ────────────────────────────────────────────────────────────────

const bloquearUsuario = async (req, res) => {
    const { id } = req.params;
    const { id_usuariosbloqueio } = req.body;

    try {
        const resultado = await model.bloquearUsuario(id, id_usuariosbloqueio);
        if (!resultado) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }
        return res.json({ mensagem: "Usuário bloqueado com sucesso.", dados: resultado });
    } catch (error) {
        console.error("Erro ao bloquear usuário:", error);
        return res.status(500).json({ erro: "Erro interno ao bloquear usuário." });
    }
};

// ─── DESBLOQUEAR ─────────────────────────────────────────────────────────────

const desbloquearUsuario = async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await model.desbloquearUsuario(id);
        if (!resultado) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }
        return res.json({ mensagem: "Usuário desbloqueado com sucesso.", dados: resultado });
    } catch (error) {
        console.error("Erro ao desbloquear usuário:", error);
        return res.status(500).json({ erro: "Erro interno ao desbloquear usuário." });
    }
};

// ─── EXCLUIR ──────────────────────────────────────────────────────────────────

const excluirUsuario = async (req, res) => {
    const { id } = req.params;
    try {
        const excluido = await model.excluirUsuario(id);
        if (!excluido) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }
        return res.json({ mensagem: "Usuário excluído com sucesso." });
    } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        return res.status(500).json({ erro: "Erro interno ao excluir usuário." });
    }
};

module.exports = {
    loginUsuario,
    proximoCdUsuario,
    listarUsuarios,
    buscarUsuarioPorId,
    criarUsuario,
    atualizarUsuario,
    alterarSenha,
    bloquearUsuario,
    desbloquearUsuario,
    excluirUsuario
};
