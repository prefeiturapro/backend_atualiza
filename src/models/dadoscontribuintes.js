const pool = require("./connection");
const vision = require('@google-cloud/vision');
const path = require('path');
const pdfParseRaw = require('pdf-parse');

const pdfParse = typeof pdfParseRaw === 'function' ? pdfParseRaw : pdfParseRaw.default;

/**
 * CONFIGURAÇÃO DO GOOGLE VISION
 * Prioriza a variável de ambiente (Render) para evitar erros de arquivo inexistente
 */
let visionConfig = {};

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.trim() !== "") {
    // Para o Render: Lê o JSON direto da variável de ambiente
    try {
        visionConfig = { 
            credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) 
        };
        console.log("[VISION] Configuração carregada via variável de ambiente.");
    } catch (err) {
        console.error("[VISION] Erro crítico ao processar GOOGLE_APPLICATION_CREDENTIALS_JSON:", err.message);
    }
} else {
    // Para o PC Local: Usa o arquivo físico google-key.json
    try {
        visionConfig = { 
            keyFilename: path.join(__dirname, '../../config/google-key.json') 
        };
        console.log("[VISION] Configuração carregada via arquivo local.");
    } catch (err) {
        console.warn("[VISION] Arquivo local não encontrado. Certifique-se de configurar a variável no Render.");
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
 */
async function atualizarContribuinte(dados) {
    const sql = `
        INSERT INTO database.dados_contribuintes (
            ds_inscricao_imovel, cd_reduzido_imovel, cd_contribuinte, nm_contribuinte, 
            nr_cpf_atual, ds_comprovante, nr_telefone_atual, nm_rua_atual, 
            ds_numero_atual, nr_cep_atual, ds_bairro_atual, ds_cidade_atual, 
            ds_email_atual, ds_obs, ds_protocolo, st_editado_manual, 
            nm_rua_extr, tp_rua_extr, ds_numero_extr, nr_cep_extr, 
            ds_bairro_extr, ds_cidade_extr, st_responsavel, ds_loteamento_atual, 
            ds_edificio_atual, ds_complemento_atual, ds_loteamento_extr, 
            ds_edificio_extr, ds_complemento_extr, dt_atualizacao, hr_atualizacao
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 
            $26, $27, $28, $29, CURRENT_DATE, LOCALTIME(0)
        )
    `;

    const values = [
        dados.ds_inscricao_imovel, 
        dados.cd_reduzido_imovel, 
        dados.cd_contribuinte, 
        dados.nm_contribuinte, 
        dados.nr_cpf_atual || '0', 
        dados.ds_comprovante || '', 
        dados.nr_telefone_atual, 
        dados.nm_rua_atual, 
        dados.ds_numero_atual, 
        dados.nr_cep_atual, 
        dados.ds_bairro_atual, 
        dados.ds_cidade_atual, 
        dados.ds_email_atual, 
        dados.ds_obs, 
        dados.ds_protocolo, 
        dados.st_editado_manual, 
        dados.nm_rua_extr, 
        'RUA', 
        dados.ds_numero_extr, 
        dados.nr_cep_extr, 
        dados.ds_bairro_extr, 
        dados.ds_cidade_extr, 
        dados.st_responsavel, 
        dados.ds_loteamento_atual, 
        dados.ds_edificio_atual, 
        dados.ds_complemento_atual, 
        dados.ds_loteamento_extr, 
        dados.ds_edificio_extr, 
        dados.ds_complemento_extr
    ];

    try {
        await pool.query(sql, values);
        return { sucesso: true };
    } catch (error) {
        console.error("[DATABASE] Erro ao inserir registro:", error.message);
        throw error;
    }
}

module.exports = {
    atualizarContribuinte,
    extrairTextoDocumento
};