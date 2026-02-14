const { buscaImoveis } = require("../models/dadosimoveis");
const pool = require("../models/connection"); // Importe o pool aqui para a busca direta

const dadosimoveis = async (req, res) => {
    // Agora aceitamos também o 'reduzido'
    const { inscricao, cpf, reduzido } = req.body;

    try {
        let dados;

        if (reduzido) {
            // Busca direta para o Admin usando o código reduzido
            const sqlAdmin = `SELECT * FROM database.dados_imoveis WHERE cd_reduzido = $1`;
            const result = await pool.query(sqlAdmin, [reduzido]);
            dados = result.rows;
        } else {
            // Busca original do Contribuinte
            if (!inscricao || !cpf) {
                return res.status(400).json({ erro: "Inscrição e CPF são obrigatórios." });
            }
            dados = await buscaImoveis(inscricao, cpf);
        }

        if (!dados || dados.length === 0) {
            return res.status(404).json({ erro: "Cadastro não encontrado." });
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
        console.error("Erro na busca:", error);
        return res.status(500).json({ erro: "Erro interno do servidor." });
    }
}

module.exports = { dadosimoveis };