const pool = require("./connection");

// ─── LISTAR PERMISSÕES DE UM USUÁRIO ─────────────────────────────────────────

async function listarPermissoesUsuario(id_usuarios) {
    const sql = `
        SELECT fu.*, f.nm_form, f.ds_caption
        FROM master.forms_usuarios fu
        JOIN master.forms f ON f.id_forms = fu.id_forms
        WHERE fu.id_usuarios = $1
        ORDER BY f.nm_form
    `;
    try {
        const { rows } = await pool.query(sql, [id_usuarios]);
        return rows;
    } catch (error) {
        console.error("[MODEL] Erro ao listar permissões:", error.message);
        return [];
    }
}

// ─── SALVAR PERMISSÕES (apaga as antigas e insere as novas) ──────────────────

async function salvarPermissoes(id_usuarios, permissoes, id_usuarioautorizacao) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        await client.query(
            `DELETE FROM master.forms_usuarios WHERE id_usuarios = $1`,
            [id_usuarios]
        );

        for (const p of permissoes) {
            const temPermissao = [p.acessar, p.consultar, p.incluir, p.editar, p.imprimir, p.excluir]
                .some(v => v === 'S');

            if (temPermissao) {
                await client.query(
                    `INSERT INTO master.forms_usuarios
                        (id_forms, id_usuarios, acessar, consultar, incluir, editar, imprimir, excluir, id_usuarioautorizacao)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        p.id_forms,
                        id_usuarios,
                        p.acessar   || 'N',
                        p.consultar || 'N',
                        p.incluir   || 'N',
                        p.editar    || 'N',
                        p.imprimir  || 'N',
                        p.excluir   || 'N',
                        id_usuarioautorizacao || null
                    ]
                );
            }
        }

        await client.query("COMMIT");
        return true;
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("[MODEL] Erro ao salvar permissões:", error.message);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    listarPermissoesUsuario,
    salvarPermissoes
};
