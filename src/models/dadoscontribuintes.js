const pool = require("./connection");
const vision = require('@google-cloud/vision');
const path = require('path');
const pdfParseRaw = require('pdf-parse');

// Garante que pdfParse será sempre uma função independente do ambiente
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
            console.log("Enviando PDF para Google Vision (Modo Documento)...");
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

        console.log(`Enviando imagem para Google Vision. Tamanho: ${buffer.length} bytes`);
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
 * Inclui campos de auditoria para dados extraídos originalmente pela IA
 */
async function atualizarContribuinte(dados) {
    const sql = `
        INSERT INTO database.dados_contribuintes (
            id_dados_imoveis,
            ds_inscricao_imovel,
            cd_reduzido_imovel,
            cd_contribuinte,
            nm_contribuinte,
            nr_cpf_atual,
            ds_comprovante,
            nr_telefone_atual,
            nm_rua_atual,
            ds_numero_atual,
            nr_cep_atual,
            ds_bairro_atual,
            ds_cidade_atual,
            ds_email_atual,
            ds_obs,
            dt_atualizacao,
            hr_atualizacao,
            ds_loteamento_atual,
            ds_edificio_atual, 
            ds_protocolo,
            st_editado_manual,
            -- NOVOS CAMPOS DE EXTRAÇÃO ORIGINAL
            nm_rua_extr,
            tp_rua_extr,
            ds_numero_extr,
            nr_cep_extr,
            ds_bairro_extr,
            ds_cidade_extr
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            CURRENT_DATE, CURRENT_TIME, $16, $17, $18, $19,
            -- VALORES DA EXTRAÇÃO ORIGINAL
            $20, $21, $22, $23, $24, $25
        )
        ON CONFLICT (id_dados_imoveis) 
        DO UPDATE SET
            ds_inscricao_imovel = EXCLUDED.ds_inscricao_imovel,
            cd_reduzido_imovel = EXCLUDED.cd_reduzido_imovel,
            cd_contribuinte = EXCLUDED.cd_contribuinte,
            nm_contribuinte = EXCLUDED.nm_contribuinte,
            nr_cpf_atual = EXCLUDED.nr_cpf_atual,
            ds_comprovante = EXCLUDED.ds_comprovante,
            nr_telefone_atual = EXCLUDED.nr_telefone_atual,
            nm_rua_atual = EXCLUDED.nm_rua_atual,
            ds_numero_atual = EXCLUDED.ds_numero_atual,
            nr_cep_atual = EXCLUDED.nr_cep_atual,
            ds_bairro_atual = EXCLUDED.ds_bairro_atual,
            ds_cidade_atual = EXCLUDED.ds_cidade_atual,
            ds_email_atual = EXCLUDED.ds_email_atual,
            ds_obs = EXCLUDED.ds_obs,
            dt_atualizacao = CURRENT_DATE,
            hr_atualizacao = CURRENT_TIME,
            ds_loteamento_atual = EXCLUDED.ds_loteamento_atual,
            ds_edificio_atual = EXCLUDED.ds_edificio_atual,
            ds_protocolo = EXCLUDED.ds_protocolo,
            st_editado_manual = EXCLUDED.st_editado_manual,
            -- ATUALIZAÇÃO DOS CAMPOS DE EXTRAÇÃO
            nm_rua_extr = EXCLUDED.nm_rua_extr,
            tp_rua_extr = EXCLUDED.tp_rua_extr,
            ds_numero_extr = EXCLUDED.ds_numero_extr,
            nr_cep_extr = EXCLUDED.nr_cep_extr,
            ds_bairro_extr = EXCLUDED.ds_bairro_extr,
            ds_cidade_extr = EXCLUDED.ds_cidade_extr;
    `;

    const values = [
        dados.id_dados_imoveis,     // $1
        dados.ds_inscricao_imovel,   // $2
        dados.cd_reduzido_imovel,    // $3
        dados.cd_contribuinte,       // $4
        dados.nm_contribuinte,       // $5
        dados.nr_cpf_atual || '0',   // $6
        dados.ds_comprovante || '',  // $7
        dados.nr_telefone_atual,     // $8
        dados.nm_rua_atual,          // $9
        dados.ds_numero_atual,       // $10
        dados.nr_cep_atual,          // $11
        dados.ds_bairro_atual,       // $12
        dados.ds_cidade_atual,       // $13
        dados.ds_email_atual,        // $14
        dados.ds_obs,                // $15
        dados.ds_loteamento_atual,   // $16
        dados.ds_edificio_atual,     // $17
        dados.ds_protocolo,          // $18
        dados.st_editado_manual,     // $19
        // MAPEMANTO DOS NOVOS CAMPOS EXTR
        dados.nm_rua_extr,           // $20
        'RUA',                       // $21 - Fixo conforme solicitado
        dados.ds_numero_extr,        // $22
        dados.nr_cep_extr,           // $23
        dados.ds_bairro_extr,        // $24
        dados.ds_cidade_extr         // $25
    ];

    try {
        await pool.query(sql, values);
        return { sucesso: true };
    } catch (error) {
        console.error("Erro ao atualizar contribuinte no banco:", error);
        throw error;
    }
}

module.exports = {
    atualizarContribuinte,
    extrairTextoDocumento
};