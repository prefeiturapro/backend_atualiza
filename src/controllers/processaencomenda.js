const pool = require("../models/connection");

// Lista todos os campos da tabela encomendas que são produtos
const camposProdutos = [
    "ds_decoracao","ds_recheio","vl_tamanho","ds_topo","ds_papel","ds_gliter","ds_redonda","ds_quadrada",
    "ds_menino","ds_menina","ds_mulher", "ds_homem", "ds_po",
    "ds_tabuleiro","ds_cafeboard","ds_obstortas","vl_risfrango","vl_rispresque",
    "vl_coxinha","vl_pastelcar","vl_pastelban","vl_salsic","vl_quibe","vl_bolquei","vl_bolpamon",
    "vl_bolmilho","vl_bolchoc","vl_bolintban","vl_bolmult","vl_boltoic","vl_bolceno","vl_bolamend",
    "vl_bolbrownie","vl_bolprest","vl_bolbanana","vl_bolaveia","vl_bollaranj","vl_bolcuca",
    "ds_obsbolo","vl_assadfra","vl_assadcar","vl_assadcho","vl_mindonu","vl_minempa","vl_miniquic",
    "vl_minibaufr","vl_minibaupr","vl_minibauca","vl_minicook","vl_minix","vl_minicacho",
    "vl_minipaoca","vl_minipaofr","vl_minisonre","vl_minisoave","vl_barc","vl_paofr","vl_paodoc",
    "vl_sandfr","vl_sandfra","vl_doccam","vl_cricri","vl_tortsa","vl_maeben","vl_outros","vl_cookie",
    "vl_paoque","vl_paocach","vl_paoham","vl_marr","vl_sonsere","vl_sonavel","vl_sondoc","vl_sonbal",
    "vl_cava","vl_empad","vl_quich","vl_empagr","vl_cacho","ds_obsdiv","ds_bolomilh","vl_sandfrint",
    "vl_mnipizza","vl_pudin","vl_pizza"
];

async function listarEncomendasPorFuncionario(idFuncionario) {
    try {
        console.log("🔥 Controller chamado para o funcionário:", idFuncionario);

        // 1️⃣ Buscar a encomenda do dia
        const encomendaSQL = `
            SELECT *
            FROM relatorios.encomendas
            WHERE dt_abertura = CURRENT_DATE
        `;

        console.log("🟦 Encomenda encontrada:", rows[0]);

        const { rows } = await pool.query(encomendaSQL);

        if (rows.length === 0) {
            return [];
        }

        const encomenda = rows[0];
        const horaEncomenda = encomenda.hr_horaenc;

        let itensDoFuncionario = [];

        // 2️⃣ Para cada campo de produto, verificar se quantidade > 0
        for (const campo of camposProdutos) {
            const quantidade = encomenda[campo];

            console.log(`Campo: ${campo} | Quantidade no banco:`, quantidade);

            if (quantidade != null && quantidade !== '' && Number(quantidade) > 0) {

                const responsavelSQL = `
                    SELECT *
                    FROM bauhaus.responsavelenc
                    WHERE ds_campo = $1
                    AND horaini <= $2
                    AND horafim >= $2
                    AND id_empregados = $3
                    LIMIT 1
                `;

               console.log("⏱ Testando horário:", {
                           campo,
                            quantidade,
                            horaEncomenda,
                            idFuncionario
                        });
                        
                const responsavel = await pool.query(responsavelSQL, [
                    campo,
                    horaEncomenda,
                    idFuncionario
                ]);

                if (responsavel.rows.length > 0) {
                    itensDoFuncionario.push({
                        campo,
                        grupo: responsavel.rows[0].ds_grupo,
                        quantidade,
                        hora: horaEncomenda,
                        data: encomenda.dt_abertura,
                        cliente: encomenda.nm_nomefantasia
                    });
                }
            }
        }

        return itensDoFuncionario;

    } catch (err) {
        console.error("❌ ERRO NO PROCESSAMENTO:", err);
        throw err; // deixa o router responder com erro
    }
}

module.exports = listarEncomendasPorFuncionario;