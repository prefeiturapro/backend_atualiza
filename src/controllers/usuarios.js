const model = require("../models/usuarios");
const transporter = require("../config/mail");
const jwt = require("jsonwebtoken");

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

        const token = jwt.sign(
            { id_usuarios: usuario.id_usuarios, cd_usuario: usuario.cd_usuario, nome: usuario.nm_usuario },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            auth: true,
            token,
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

// ─── RECUPERAR SENHA ─────────────────────────────────────────────────────────

function gerarSenhaTemporaria() {
    const letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
    const numeros = "23456789";
    const especiais = "@#$!";
    let senha = "";
    for (let i = 0; i < 5; i++) senha += letras[Math.floor(Math.random() * letras.length)];
    senha += numeros[Math.floor(Math.random() * numeros.length)];
    senha += numeros[Math.floor(Math.random() * numeros.length)];
    senha += especiais[Math.floor(Math.random() * especiais.length)];
    return senha.split("").sort(() => Math.random() - 0.5).join("");
}

const recuperarSenha = async (req, res) => {
    const { nr_cpf } = req.body;

    if (!nr_cpf) {
        return res.status(400).json({ erro: "Informe o CPF cadastrado." });
    }

    // Remove formatação (aceita com ou sem pontuação)
    const cpfNumeros = nr_cpf.replace(/\D/g, "");

    if (cpfNumeros.length !== 11) {
        return res.status(400).json({ erro: "CPF inválido. Informe os 11 dígitos." });
    }

    try {
        const usuario = await model.buscarUsuarioPorCpf(cpfNumeros);

        if (!usuario) {
            return res.status(404).json({ erro: "Nenhum usuário encontrado com este CPF." });
        }

        if (!usuario.ds_email) {
            return res.status(422).json({ erro: "Este usuário não possui e-mail cadastrado. Contate o administrador." });
        }

        if (usuario.st_bloqueado === "S") {
            return res.status(403).json({ erro: "Usuário bloqueado. Contate o administrador." });
        }

        const senhaTemp = gerarSenhaTemporaria();
        await model.atualizarSenha(usuario.id_usuarios, senhaTemp);

        await transporter.sendMail({
            to: usuario.ds_email,
            subject: "Recuperação de Senha — AtualizaAí",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f0f2f5; padding: 32px 16px;">
                    <div style="background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">

                        <div style="background: #0d6efd; padding: 28px 32px; text-align: center;">
                            <h2 style="color: #fff; margin: 0; font-size: 20px; letter-spacing: 1px;">🔐 RECUPERAÇÃO DE SENHA</h2>
                            <p style="color: #c7dcff; margin: 6px 0 0; font-size: 13px;">AtualizaAí — Portal de Atualização Cadastral</p>
                        </div>

                        <div style="padding: 32px;">
                            <p style="color: #333; font-size: 15px; margin: 0 0 8px;">Olá, <strong>${usuario.nm_usuario}</strong>!</p>
                            <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                                Recebemos uma solicitação de recuperação de senha para sua conta.
                                Sua senha temporária é:
                            </p>

                            <div style="background: #f0f4ff; border: 2px dashed #0d6efd; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                                <p style="margin: 0 0 6px; font-size: 12px; color: #6c757d; text-transform: uppercase; letter-spacing: 1px;">Senha Temporária</p>
                                <span style="font-size: 28px; font-weight: bold; color: #0d6efd; letter-spacing: 4px; font-family: monospace;">${senhaTemp}</span>
                            </div>

                            <div style="background: #fff8e1; border-left: 4px solid #ffc107; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
                                <p style="margin: 0; font-size: 13px; color: #856404;">
                                    ⚠️ <strong>Importante:</strong> Por segurança, altere esta senha imediatamente após o login.
                                    Acesse <em>Menu → Gestão de Usuários → Alterar Senha</em>.
                                </p>
                            </div>

                            <p style="color: #888; font-size: 12px; margin: 0;">
                                Se você não solicitou a recuperação de senha, ignore este e-mail.
                                Sua senha anterior permanece inalterada apenas se você não clicar em nenhum link.
                            </p>
                        </div>

                        <div style="background: #f8f9fa; padding: 16px 32px; text-align: center; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0; font-size: 11px; color: #adb5bd;">
                                © 2026 AtualizaAI — Soluções Municipais. Todos os direitos reservados.
                            </p>
                        </div>
                    </div>
                </div>
            `
        });

        return res.json({ mensagem: "Senha temporária enviada para o e-mail cadastrado." });
    } catch (error) {
        console.error("Erro na recuperação de senha:", error);
        return res.status(500).json({ erro: "Erro ao processar a solicitação. Tente novamente." });
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
    recuperarSenha,
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
