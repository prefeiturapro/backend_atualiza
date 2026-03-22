const pool = require("./connection");
const vision = require('@google-cloud/vision');
const path = require('path');
const pdfParseRaw = require('pdf-parse');

const pdfParse = typeof pdfParseRaw === 'function' ? pdfParseRaw : pdfParseRaw.default;

/**
 * CONFIGURAÇÃO DO GOOGLE VISION
 */
let visionConfig = {};

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.trim() !== "") {
    try {
        visionConfig = { 
            credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) 
        };
        console.log("[VISION] Configuração carregada via variável de ambiente.");
    } catch (err) {
        console.error("[VISION] Erro crítico ao processar GOOGLE_APPLICATION_CREDENTIALS_JSON:", err.message);
    }
} else {
    try {
        visionConfig = { 
            keyFilename: path.join(__dirname, '../../config/google-key.json') 
        };
        console.log("[VISION] Configuração carregada via arquivo local.");
    } catch (err) {
        console.warn("[VISION] Arquivo local não encontrado.");
    }
}

const client = new vision.ImageAnnotatorClient(visionConfig);

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
        console.error("[VISION] Erro detalhado no Model:", error.message);
        throw error;
    }
}

/**
 * Persistência no Banco de Dados
 * ADICIONADO: suporte para buffer de arquivo e nome original
 */
async function atualizarContribuinte(dados, arquivoBuffer = null, nomeOriginal = null) {
    const sql = `
        INSERT INTO database.dados_contribuintes (
            ds_inscricao_imovel, cd_reduzido_imovel, cd_contribuinte, nm_contribuinte, 
            nr_cpf_atual, nr_telefone_atual, nm_rua_atual, 
            ds_numero_atual, nr_cep_atual, ds_bairro_atual, ds_cidade_atual, 
            ds_email_atual, ds_obs, ds_protocolo, st_editado_manual, 
            nm_rua_extr, tp_rua_extr, ds_numero_extr, nr_cep_extr, 
            ds_bairro_extr, ds_cidade_extr, st_responsavel, ds_loteamento_atual, 
            ds_edificio_atual, ds_complemento_atual, ds_loteamento_extr, 
            ds_edificio_extr, ds_complemento_extr, 
            dt_atualizacao, hr_atualizacao,
            ds_comprovante, nm_arquivo_original, st_validado_prefeitura, st_extracao,
            st_rua_extr, st_bairro_extr
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28,
            CURRENT_DATE, LOCALTIME(0),
            $29, $30, 'N', $31, $32, $33
        )
    `;

    const values = [
        dados.ds_inscricao_imovel || '',     // $1
        dados.cd_reduzido_imovel || 0,       // $2
        dados.cd_contribuinte || 0,          // $3
        dados.nm_contribuinte || '',         // $4
        dados.nr_cpf_atual || '',            // $5
        dados.nr_telefone_atual || '',       // $6
        dados.nm_rua_atual || '',            // $7
        dados.ds_numero_atual || '',         // $8
        (dados.nr_cep_atual || '').replace(/\D/g, ''),  // $9 — remove máscara (ex: "88810-421" → "88810421")
        dados.ds_bairro_atual || '',         // $10
        dados.ds_cidade_atual || '',         // $11
        dados.ds_email_atual || '',          // $12
        dados.ds_obs || 'Atualização Web',   // $13
        dados.ds_protocolo || '',            // $14
        dados.st_editado_manual || 'N',      // $15
        dados.nm_rua_extr || '',             // $16
        'RUA',                               // $17
        dados.ds_numero_extr || '',          // $18
        (dados.nr_cep_extr || '').replace(/\D/g, ''),   // $19 — remove máscara
        dados.ds_bairro_extr || '',          // $20
        dados.ds_cidade_extr || '',          // $21
        dados.st_responsavel || 'N',         // $22
        dados.ds_loteamento_atual || '',     // $23
        dados.ds_edificio_atual || '',       // $24
        dados.ds_complemento_atual || '',    // $25
        dados.ds_loteamento_extr || '',      // $26
        dados.ds_edificio_extr || '',        // $27
        dados.ds_complemento_extr || '',     // $28
        arquivoBuffer,                       // $29
        nomeOriginal,                        // $30
        dados.st_extracao || 'S',            // $31
        dados.st_rua_extr    || 'S',         // $32
        dados.st_bairro_extr || 'S'          // $33
    ];

    try {
        await pool.query(sql, values);
        return { sucesso: true };
    } catch (error) {
        // ESSA LINHA ABAIXO VAI TE DIZER EXATAMENTE QUAL COLUNA ESTÁ DANDO ERRO NO TERMINAL
        console.error("[DATABASE] Erro detalhado:", error.message);
        throw error;
    }
}

module.exports = {
    atualizarContribuinte,
    extrairTextoDocumento
};