const pool = require("./connection");
const vision = require('@google-cloud/vision');
const path = require('path');
const pdfParseRaw = require('pdf-parse');

const pdfParse = typeof pdfParseRaw === 'function' ? pdfParseRaw : pdfParseRaw.default;

const client = new vision.ImageAnnotatorClient({
    keyFilename: path.join(__dirname, '../../config/google-key.json')
});

/**
 * Função para extrair texto de Imagem ou PDF
 */
async function extrairTextoDocumento(buffer, isPdf) {
    try {
        if (isPdf) {
            const request = {
                requests: [{
                    inputConfig: {
                        mimeType: 'application/pdf',
                        content: buffer,
                    },
                    features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
                }],
            };

            const [result] = await client.batchAnnotateFiles(request);
            const responses = result.responses[0].responses;
            let textoCompleto = "";
            
            responses.forEach(res => {
                if (res.fullTextAnnotation) {
                    textoCompleto += res.fullTextAnnotation.text + "\n";
                }
            });

            return textoCompleto;
        }

        const request = {
            image: { content: buffer },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: { languageHints: ['pt'] }
        };

        const [result] = await client.annotateImage(request);
        return result.fullTextAnnotation ? result.fullTextAnnotation.text : '';

    } catch (error) {
        console.error("Erro detalhado no Model Vision:", error.message);
        throw error;
    }
}

/**
 * Persistência no Banco de Dados
 * AJUSTADO: Correção de tipos e alinhamento de parâmetros
 */
async function atualizarContribuinte(dados) {
    const sql = `
        INSERT INTO database.dados_contribuintes (
            ds_inscricao_imovel,    -- $1
            cd_reduzido_imovel,     -- $2
            cd_contribuinte,        -- $3
            nm_contribuinte,        -- $4
            nr_cpf_atual,           -- $5
            ds_comprovante,         -- $6
            nr_telefone_atual,      -- $7
            nm_rua_atual,           -- $8
            ds_numero_atual,        -- $9
            nr_cep_atual,           -- $10
            ds_bairro_atual,        -- $11
            ds_cidade_atual,        -- $12
            ds_email_atual,         -- $13
            ds_obs,                 -- $14
            ds_protocolo,           -- $15
            st_editado_manual,      -- $16
            nm_rua_extr,            -- $17
            tp_rua_extr,            -- $18
            ds_numero_extr,         -- $19
            nr_cep_extr,            -- $20
            ds_bairro_extr,         -- $21
            ds_cidade_extr,         -- $22
            st_responsavel,         -- $23
            ds_loteamento_atual,    -- $24
            ds_edificio_atual,      -- $25
            ds_complemento_atual,   -- $26
            ds_loteamento_extr,     -- $27
            ds_edificio_extr,       -- $28
            ds_complemento_extr,    -- $29
            dt_atualizacao,         -- Gerado via SQL
            hr_atualizacao          -- Gerado via SQL
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 
            $26, $27, $28, $29, CURRENT_DATE, LOCALTIME(0)
        )
    `;

    const values = [
        dados.ds_inscricao_imovel,   // $1
        dados.cd_reduzido_imovel,    // $2
        dados.cd_contribuinte,       // $3
        dados.nm_contribuinte,       // $4
        dados.nr_cpf_atual || '0',   // $5
        dados.ds_comprovante || '',  // $6
        dados.nr_telefone_atual,     // $7
        dados.nm_rua_atual,          // $8
        dados.ds_numero_atual,       // $9
        dados.nr_cep_atual,          // $10
        dados.ds_bairro_atual,       // $11
        dados.ds_cidade_atual,       // $12
        dados.ds_email_atual,        // $13
        dados.ds_obs,                // $14
        dados.ds_protocolo,          // $15
        dados.st_editado_manual,     // $16
        dados.nm_rua_extr,           // $17
        'RUA',                       // $18
        dados.ds_numero_extr,        // $19
        dados.nr_cep_extr,           // $20
        dados.ds_bairro_extr,        // $21
        dados.ds_cidade_extr,        // $22
        dados.st_responsavel,        // $23
        dados.ds_loteamento_atual,   // $24
        dados.ds_edificio_atual,     // $25
        dados.ds_complemento_atual,  // $26
        dados.ds_loteamento_extr,    // $27
        dados.ds_edificio_extr,      // $28
        dados.ds_complemento_extr    // $29
    ];

    try {
        await pool.query(sql, values);
        return { sucesso: true };
        } catch (error) {
            console.error("Erro ao inserir novo registro de contribuinte no banco:", error);
            throw error;
        }
    }

module.exports = {
    atualizarContribuinte,
    extrairTextoDocumento
};