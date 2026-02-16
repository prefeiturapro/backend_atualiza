const { buscaImoveisDinamica } = require("../models/dadosimoveis");
const pool = require("../models/connection"); // Importe o pool aqui para a busca direta

const dadosimoveis = async (req, res) => {
    // Captura todos os campos possíveis enviados pelo formulário dinâmico
    const { 
        ds_inscricao, 
        nr_cpf_resp, 
        cd_reduzido, 
        cd_responsavel, 
        nm_responsavel,
        reduzido // campo usado pelo Admin
    } = req.body;

    try {
        let dados;

        // Se houver 'reduzido' vindo da busca direta do Admin
        if (reduzido) {
            const sqlAdmin = `SELECT * FROM database.dados_imoveis WHERE cd_reduzido = $1`;
            const result = await pool.query(sqlAdmin, [reduzido]);
            dados = result.rows;
        } else {
            // Busca dinâmica para o Contribuinte baseada no que ele preencheu
            // Passamos o objeto completo para o Model
            dados = await buscaImoveisDinamica(req.body);
        }

        if (!dados || dados.length === 0) {
            return res.status(404).json({ erro: "Cadastro não encontrado com os dados informados." });
        }

        const imovel = dados[0];

        const formatarFoto = (campo) => {
            if (campo && Buffer.isBuffer(campo)) {
                return `data:image/jpeg;base64,${campo.toString('base64')}`;
            }
            return null;
        };

        return res.json({
            auth: true,
            ...imovel,
            ds_fotoimovel: formatarFoto(imovel.ds_fotoimovel),
            ds_foto_resp: formatarFoto(imovel.ds_foto_resp)
        });

    } catch (error) {
        console.error("Erro na busca de imóveis:", error);
        return res.status(500).json({ erro: "Erro interno do servidor." });
    }
}

module.exports = { dadosimoveis };