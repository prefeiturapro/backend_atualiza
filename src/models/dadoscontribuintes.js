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
    // 1. Corrigimos hr_atualizacao para receber CURRENT_TIME
    // 2. Alinhamos a contagem: existem 26 colunas listadas abaixo, logo precisamos de $1 até $26
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
            ds_loteamento_atual,    -- $15
            ds_edificio_atual,      -- $16
            ds_protocolo,           -- $17
            st_editado_manual,      -- $18
            nm_rua_extr,            -- $19
            tp_rua_extr,            -- $20
            ds_numero_extr,         -- $21
            nr_cep_extr,            -- $22
            ds_bairro_extr,         -- $23
            ds_cidade_extr,         -- $24
            st_responsavel,         -- $25
            dt_atualizacao,         -- Gerado via SQL
            hr_atualizacao          -- Gerado via SQL
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
            CURRENT_DATE, 
            LOCALTIME(0) -- LOCALTIME(0) costuma ser aceito por tipos de hora customizados no Postgres
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
        dados.ds_loteamento_atual,   // $15
        dados.ds_edificio_atual,     // $16
        dados.ds_protocolo,          // $17
        dados.st_editado_manual,     // $18
        dados.nm_rua_extr,           // $19
        'RUA',                       // $20
        dados.ds_numero_extr,        // $21
        dados.nr_cep_extr,           // $23
        dados.ds_bairro_extr,        // $23
        dados.ds_cidade_extr,        // $24
        dados.st_responsavel         // $25
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