const pool = require("../models/connection");

/**
 * KPIs gerais: totais de imóveis, cobertura, status
 */
const buscarResumo = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM database.dados_imoveis)                              AS total_imoveis,

                (SELECT COUNT(DISTINCT cd_reduzido_imovel)
                 FROM database.dados_contribuintes)                                        AS total_atualizados,

                (SELECT COUNT(*)
                 FROM database.dados_imoveis di
                 WHERE NOT EXISTS (
                     SELECT 1 FROM database.dados_contribuintes dc
                     WHERE dc.cd_reduzido_imovel = di.cd_reduzido
                 ))                                                                         AS sem_atualizacao,

                (SELECT COUNT(*) FROM database.dados_contribuintes
                 WHERE st_validado_prefeitura = 'N')                                       AS pendentes,

                (SELECT COUNT(*) FROM database.dados_contribuintes
                 WHERE st_validado_prefeitura = 'S')                                       AS aprovados,

                (SELECT COUNT(*) FROM database.dados_contribuintes
                 WHERE st_validado_prefeitura = 'C')                                       AS indeferidos,

                (SELECT COUNT(*) FROM database.dados_contribuintes
                 WHERE st_extracao = 'N')                                                  AS recusados
        `);
        const r = rows[0];
        const total = parseInt(r.total_imoveis) || 0;
        const atualiz = parseInt(r.total_atualizados) || 0;
        res.json({
            total_imoveis:    total,
            total_atualizados: atualiz,
            sem_atualizacao:  parseInt(r.sem_atualizacao)  || 0,
            pendentes:        parseInt(r.pendentes)         || 0,
            aprovados:        parseInt(r.aprovados)         || 0,
            indeferidos:      parseInt(r.indeferidos)       || 0,
            recusados:        parseInt(r.recusados)         || 0,
            taxa_cobertura:   total > 0 ? ((atualiz / total) * 100).toFixed(1) : "0.0"
        });
    } catch (error) {
        console.error("Erro dashboard/resumo:", error);
        res.status(500).json({ erro: "Erro ao carregar resumo." });
    }
};

/**
 * Evolução diária de atualizações (últimos N dias, padrão 30)
 */
const buscarEvolucao = async (req, res) => {
    const dias = Math.min(parseInt(req.query.dias) || 30, 365);
    try {
        const { rows } = await pool.query(`
            SELECT
                dt_atualizacao::date                                     AS dia,
                COUNT(*)                                                 AS total,
                COUNT(*) FILTER (WHERE st_validado_prefeitura = 'S')    AS aprovados,
                COUNT(*) FILTER (WHERE st_validado_prefeitura = 'C')    AS indeferidos,
                COUNT(*) FILTER (WHERE st_validado_prefeitura = 'N')    AS pendentes
            FROM database.dados_contribuintes
            WHERE dt_atualizacao >= CURRENT_DATE - $1
            GROUP BY dt_atualizacao::date
            ORDER BY dia ASC
        `, [dias]);
        res.json(rows.map(r => ({
            dia:        r.dia,
            total:      parseInt(r.total),
            aprovados:  parseInt(r.aprovados),
            indeferidos: parseInt(r.indeferidos),
            pendentes:  parseInt(r.pendentes)
        })));
    } catch (error) {
        console.error("Erro dashboard/evolucao:", error);
        res.status(500).json({ erro: "Erro ao carregar evolução." });
    }
};

/**
 * Atualizações por bairro (top 15)
 */
const buscarPorBairro = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                COALESCE(NULLIF(TRIM(ds_bairro_atual), ''), 'Não informado') AS bairro,
                COUNT(*)                                                       AS total,
                COUNT(*) FILTER (WHERE st_validado_prefeitura = 'S')          AS aprovados,
                COUNT(*) FILTER (WHERE st_validado_prefeitura = 'C')          AS indeferidos,
                COUNT(*) FILTER (WHERE st_validado_prefeitura = 'N')          AS pendentes
            FROM database.dados_contribuintes
            GROUP BY 1
            ORDER BY total DESC
            LIMIT 15
        `);
        res.json(rows.map(r => ({
            bairro:     r.bairro,
            total:      parseInt(r.total),
            aprovados:  parseInt(r.aprovados),
            indeferidos: parseInt(r.indeferidos),
            pendentes:  parseInt(r.pendentes)
        })));
    } catch (error) {
        console.error("Erro dashboard/por-bairro:", error);
        res.status(500).json({ erro: "Erro ao carregar por bairro." });
    }
};

/**
 * Imóveis SEM atualização agrupados por bairro do imóvel (top 15)
 */
const buscarSemAtualizacaoPorBairro = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                COALESCE(NULLIF(TRIM(nm_bairro_imovel), ''), 'Não informado') AS bairro,
                COUNT(*) AS total
            FROM database.dados_imoveis di
            WHERE NOT EXISTS (
                SELECT 1 FROM database.dados_contribuintes dc
                WHERE dc.cd_reduzido_imovel = di.cd_reduzido
            )
            GROUP BY 1
            ORDER BY total DESC
            LIMIT 15
        `);
        res.json(rows.map(r => ({
            bairro: r.bairro,
            total:  parseInt(r.total)
        })));
    } catch (error) {
        console.error("Erro dashboard/sem-atualizacao:", error);
        res.status(500).json({ erro: "Erro ao carregar sem atualização." });
    }
};

module.exports = { buscarResumo, buscarEvolucao, buscarPorBairro, buscarSemAtualizacaoPorBairro };
