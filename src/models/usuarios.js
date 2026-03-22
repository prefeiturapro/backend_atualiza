const pool = require("./connection");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fotoParaBuffer(by_foto) {
    if (!by_foto) return null;
    if (Buffer.isBuffer(by_foto)) return by_foto;
    // Remove prefixo data:image/...;base64, se existir
    const base64 = by_foto.includes(",") ? by_foto.split(",")[1] : by_foto;
    return Buffer.from(base64, "base64");
}

function bufferParaBase64(buffer) {
    if (!buffer) return null;
    const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer.data || buffer);
    return `data:image/jpeg;base64,${data.toString("base64")}`;
}

function formatarUsuario(row) {
    if (!row) return null;
    return {
        ...row,
        by_foto: row.by_foto ? bufferParaBase64(row.by_foto) : null
    };
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

async function buscaUsuarios(nome, senha) {
    if (!nome || !senha) return null;

    const sql = `SELECT * FROM master.usuarios WHERE nm_usuario ILIKE $1 LIMIT 1`;
    try {
        const { rows } = await pool.query(sql, [nome]);
        if (rows.length === 0) return null;

        const usuario = rows[0];
        const senhaValida = await bcrypt.compare(senha, usuario.ds_password);
        if (!senhaValida) return null;

        return formatarUsuario(usuario);
    } catch (error) {
        console.error("[MODEL] Erro no login:", error.message);
        return null;
    }
}

// ─── LISTAR ───────────────────────────────────────────────────────────────────

async function listarUsuarios() {
    const sql = `
        SELECT
            id_usuarios, cd_usuario, nm_usuario, nr_cpf, ds_email,
            dt_nascimento, dt_cadastro, st_bloqueado, dt_bloqueio,
            st_exibirfoto, id_usuarioscadastro, id_usuariosbloqueio, by_foto
        FROM master.usuarios
        ORDER BY nm_usuario
    `;
    try {
        const { rows } = await pool.query(sql);
        return rows.map(formatarUsuario);
    } catch (error) {
        console.error("[MODEL] Erro ao listar usuários:", error.message);
        return [];
    }
}

// ─── BUSCAR POR ID ────────────────────────────────────────────────────────────

async function buscarUsuarioPorId(id) {
    const sql = `
        SELECT
            id_usuarios, cd_usuario, nm_usuario, nr_cpf, ds_email,
            dt_nascimento, dt_cadastro, st_bloqueado, dt_bloqueio,
            st_exibirfoto, id_usuarioscadastro, id_usuariosbloqueio, by_foto
        FROM master.usuarios
        WHERE id_usuarios = $1
    `;
    try {
        const { rows } = await pool.query(sql, [id]);
        return formatarUsuario(rows[0] || null);
    } catch (error) {
        console.error("[MODEL] Erro ao buscar usuário:", error.message);
        return null;
    }
}

// ─── BUSCAR POR CPF ───────────────────────────────────────────────────────────

async function buscarUsuarioPorCpf(nr_cpf) {
    const sql = `
        SELECT id_usuarios, nm_usuario, ds_email, st_bloqueado
        FROM master.usuarios
        WHERE nr_cpf = $1
        LIMIT 1
    `;
    try {
        const { rows } = await pool.query(sql, [nr_cpf]);
        return rows[0] || null;
    } catch (error) {
        console.error("[MODEL] Erro ao buscar por CPF:", error.message);
        return null;
    }
}

// ─── VERIFICAR DUPLICIDADE ────────────────────────────────────────────────────

async function verificarUsuarioExistente(nm_usuario, ignorarId = null) {
    const sql = ignorarId
        ? `SELECT id_usuarios FROM master.usuarios WHERE nm_usuario ILIKE $1 AND id_usuarios <> $2 LIMIT 1`
        : `SELECT id_usuarios FROM master.usuarios WHERE nm_usuario ILIKE $1 LIMIT 1`;
    const params = ignorarId ? [nm_usuario, ignorarId] : [nm_usuario];
    const { rows } = await pool.query(sql, params);
    return rows.length > 0;
}

async function verificarCpfExistente(nr_cpf, ignorarId = null) {
    if (!nr_cpf) return false;
    const sql = ignorarId
        ? `SELECT id_usuarios FROM master.usuarios WHERE nr_cpf = $1 AND id_usuarios <> $2 LIMIT 1`
        : `SELECT id_usuarios FROM master.usuarios WHERE nr_cpf = $1 LIMIT 1`;
    const params = ignorarId ? [nr_cpf, ignorarId] : [nr_cpf];
    const { rows } = await pool.query(sql, params);
    return rows.length > 0;
}

// ─── PRÓXIMO CD_USUARIO ───────────────────────────────────────────────────────

async function proximoCdUsuario() {
    const sql = `SELECT COALESCE(MAX(cd_usuario), 0) + 1 AS proximo FROM master.usuarios`;
    const { rows } = await pool.query(sql);
    return rows[0].proximo;
}

// ─── CRIAR ────────────────────────────────────────────────────────────────────

async function criarUsuario({ nm_usuario, nr_cpf, dt_nascimento, ds_email, ds_password, by_foto, st_exibirfoto, id_usuarioscadastro }) {
    const hash = await bcrypt.hash(ds_password, SALT_ROUNDS);
    const fotoBuffer = fotoParaBuffer(by_foto);
    const cd_usuario = await proximoCdUsuario();

    const sql = `
        INSERT INTO master.usuarios (
            cd_usuario, nm_usuario, nr_cpf, dt_nascimento, ds_email, ds_password,
            by_foto, st_exibirfoto, st_bloqueado, dt_cadastro, id_usuarioscadastro
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'N', NOW(), $9)
        RETURNING
            id_usuarios, cd_usuario, nm_usuario, nr_cpf, ds_email,
            dt_nascimento, dt_cadastro, st_bloqueado, st_exibirfoto, by_foto
    `;
    const { rows } = await pool.query(sql, [
        cd_usuario,
        nm_usuario,
        nr_cpf || null,
        dt_nascimento || null,
        ds_email || null,
        hash,
        fotoBuffer,
        st_exibirfoto || 'S',
        id_usuarioscadastro || null
    ]);
    return formatarUsuario(rows[0]);
}

// ─── ATUALIZAR ────────────────────────────────────────────────────────────────

async function atualizarUsuario(id, { nm_usuario, nr_cpf, dt_nascimento, ds_email, by_foto, st_exibirfoto }) {
    const fotoBuffer = fotoParaBuffer(by_foto);

    // Se não enviou nova foto, mantém a atual
    const sql = fotoBuffer
        ? `
            UPDATE master.usuarios
            SET nm_usuario=$1, nr_cpf=$2, dt_nascimento=$3, ds_email=$4, st_exibirfoto=$5, by_foto=$6
            WHERE id_usuarios=$7
            RETURNING
                id_usuarios, cd_usuario, nm_usuario, nr_cpf, ds_email,
                dt_nascimento, dt_cadastro, st_bloqueado, st_exibirfoto, by_foto
          `
        : `
            UPDATE master.usuarios
            SET nm_usuario=$1, nr_cpf=$2, dt_nascimento=$3, ds_email=$4, st_exibirfoto=$5
            WHERE id_usuarios=$6
            RETURNING
                id_usuarios, cd_usuario, nm_usuario, nr_cpf, ds_email,
                dt_nascimento, dt_cadastro, st_bloqueado, st_exibirfoto, by_foto
          `;

    const params = fotoBuffer
        ? [nm_usuario, nr_cpf || null, dt_nascimento || null, ds_email || null, st_exibirfoto, fotoBuffer, id]
        : [nm_usuario, nr_cpf || null, dt_nascimento || null, ds_email || null, st_exibirfoto, id];

    const { rows } = await pool.query(sql, params);
    return formatarUsuario(rows[0] || null);
}

// ─── ALTERAR SENHA ────────────────────────────────────────────────────────────

async function atualizarSenha(id, novaSenha) {
    const hash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    const sql = `UPDATE master.usuarios SET ds_password = $1 WHERE id_usuarios = $2 RETURNING id_usuarios`;
    const { rows } = await pool.query(sql, [hash, id]);
    return rows[0] || null;
}

// ─── BLOQUEAR / DESBLOQUEAR ───────────────────────────────────────────────────

async function bloquearUsuario(id, id_usuariosbloqueio) {
    const sql = `
        UPDATE master.usuarios
        SET st_bloqueado = 'S', dt_bloqueio = NOW(), id_usuariosbloqueio = $2
        WHERE id_usuarios = $1
        RETURNING id_usuarios, nm_usuario, st_bloqueado, dt_bloqueio
    `;
    const { rows } = await pool.query(sql, [id, id_usuariosbloqueio || null]);
    return rows[0] || null;
}

async function desbloquearUsuario(id) {
    const sql = `
        UPDATE master.usuarios
        SET st_bloqueado = 'N', dt_bloqueio = NULL, id_usuariosbloqueio = NULL
        WHERE id_usuarios = $1
        RETURNING id_usuarios, nm_usuario, st_bloqueado
    `;
    const { rows } = await pool.query(sql, [id]);
    return rows[0] || null;
}

// ─── EXCLUIR ──────────────────────────────────────────────────────────────────

async function excluirUsuario(id) {
    const sql = `DELETE FROM master.usuarios WHERE id_usuarios = $1 RETURNING id_usuarios`;
    const { rows } = await pool.query(sql, [id]);
    return rows[0] || null;
}

module.exports = {
    buscaUsuarios,
    listarUsuarios,
    buscarUsuarioPorId,
    buscarUsuarioPorCpf,
    verificarUsuarioExistente,
    verificarCpfExistente,
    proximoCdUsuario,
    criarUsuario,
    atualizarUsuario,
    atualizarSenha,
    bloquearUsuario,
    desbloquearUsuario,
    excluirUsuario
};
