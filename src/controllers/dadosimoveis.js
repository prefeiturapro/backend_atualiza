const { buscaImoveisDinamica } = require("../models/dadosimoveis");
const modelDadosGerais = require("../models/dadosgerais"); // Precisamos dele para ler a trava
const pool = require("../models/connection");

const dadosimoveis = async (req, res) => {
    const { reduzido } = req.body;

    try {
        let dados;

        // 1. BUSCA O IMÓVEL (Sua lógica original)
        if (reduzido) {
            const sqlAdmin = `SELECT * FROM database.dados_imoveis WHERE cd_reduzido = $1`;
            const result = await pool.query(sqlAdmin, [reduzido]);
            dados = result.rows;
        } else {
            dados = await buscaImoveisDinamica(req.body);
        }

        if (!dados || dados.length === 0) {
            return res.status(404).json({ erro: "Cadastro não encontrado." });
        }

        const imovel = dados[0];

        // 2. BUSCA CONFIGURAÇÃO DE BLOQUEIO (Tabela master.dados_gerais)
        const configGeral = await modelDadosGerais.obterDadosGerais();
        
        // Verifica se a trava está ATIVA (N = Bloqueia quem tem CMC)
        const bloqueioAtivo = configGeral.st_bloqueiacmc === 'N';
        
        // Verifica se o imóvel possui um CMC preenchido (diferente de nulo e zero)
        const temCMC = imovel.cd_cmc && imovel.cd_cmc !== 0 && imovel.cd_cmc !== "0";

        // 3. REGRA DE BLOQUEIO
        // Se a prefeitura bloqueia (N) E o imóvel tem CMC, retorna erro 403 (Proibido)
        if (bloqueioAtivo && temCMC) {
            return res.status(403).json({ 
                erro: "Este cadastro possui vínculo com CMC e não permite atualização online. Procure a prefeitura.",
                bloqueadoPeloCMC: true 
            });
        }

        // 4. SE PASSOU PELA REGRA, FORMATA AS FOTOS E RETORNA
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