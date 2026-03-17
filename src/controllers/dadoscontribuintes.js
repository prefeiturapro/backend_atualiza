const { atualizarContribuinte, extrairTextoDocumento } = require("../models/dadoscontribuintes");
const { buscaClientes } = require("../models/dadosclientes");
const pool = require("../models/connection"); 
const transporter = require("../config/mail"); 
const twilio = require('twilio');
const axios = require('axios');

// INSTÂNCIA DO CLIENTE TWILIO
const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Função para processar o comprovante via OCR ou Extração Direta
 */
const processarComprovante = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ erro: "Nenhum arquivo enviado." });
        }

        const isPdf = req.file.mimetype === 'application/pdf';
        const textoBruto = await extrairTextoDocumento(req.file.buffer, isPdf);

        console.log("--- TEXTO CAPTURADO (DIGITAL OU OCR) ---");
        console.log(textoBruto);
        console.log("----------------------------------------");

        if (!textoBruto || textoBruto.trim().length < 5) {
            return res.status(422).json({ erro: "Não foi possível extrair dados legíveis do documento." });
        }

        const textoLimpo = textoBruto.toUpperCase();
        const isCelesc = textoLimpo.includes("CELESC");
        
        let nomeCandidato = "NOME NÃO IDENTIFICADO";

        if (isCelesc) {
            const matchNomeCelesc = textoLimpo.match(/NOME[:\s]+([A-ZÀ-Ú\s\.\-]+?)(?:\s+UNIDADE|CPF|[\n\r])/i);
            if (matchNomeCelesc) nomeCandidato = matchNomeCelesc[1].trim();
        }

        if (nomeCandidato === "NOME NÃO IDENTIFICADO") {
            const linhas = textoLimpo.split('\n');
            const termosEmpresa = [
                "COOPERATIVA", "ALIANCA", "CELESC", "CASAN", "SANEAMENTO", "ENERGIA", 
                "LTDA", "CNPJ", "PREFEITURA", "SECRETARIA", "BANCO", "SA", "S/A", "SERVIÇOS",
                "SABESP", "COPASA", "CEDAE", "COMPESA", "SANEPAR", "ENEL", "CPFL", "EQUATORIAL",
                "ENERGISA", "COELBA", "LIGHT", "VIA POSTAL", "NOTA FISCAL", "ELETRONICA", "ESTATAL",
                "TOTAL A PAGAR", "VENCIMENTO", "CONSUMO"
            ];

            for (let linha of linhas) {
                const linhaTrimmada = linha.trim();
                if (linhaTrimmada.length > 10 && 
                    !termosEmpresa.some(t => linhaTrimmada.includes(t)) && 
                    /^[A-ZÀ-Ú\s\.\-]+$/.test(linhaTrimmada)) {
                    
                    nomeCandidato = linhaTrimmada;
                    if (linhaTrimmada.split(' ').length >= 3) break; 
                }
            }
        }

        const indexNome = textoLimpo.indexOf(nomeCandidato);
        const textoAposNome = indexNome !== -1 ? textoLimpo.substring(indexNome) : textoLimpo;
        const blocoEndereco = textoAposNome.substring(0, 450); 

        let matchRuaStr = "", matchNumStr = "", matchBairroStr = "CENTRO", matchCepStr = "";

        if (isCelesc) {
            const regexCelescRua = blocoEndereco.match(/ENDERECO[:\s]+([A-ZÀ-Ú\s\.\-]+?)\s+(\d{1,5})/i);
            
            if (regexCelescRua) {
                matchRuaStr = regexCelescRua[1].trim(); 
                matchNumStr = regexCelescRua[2];      
            } else {
                const linhaEnd = blocoEndereco.match(/ENDERECO[:\s]+(.+?)(?:\s+CEP|$)/i);
                if (linhaEnd) {
                    const textoEnd = linhaEnd[1];
                    const findNum = textoEnd.match(/(\d{1,5})/);
                    if (findNum) {
                        matchNumStr = findNum[1];
                        matchRuaStr = textoEnd.split(matchNumStr)[0].trim();
                    }
                }
            }

            const findBairro = blocoEndereco.match(/-\s+([A-ZÀ-Ú\s]+?)\s+CEP/i);
            if (findBairro) matchBairroStr = findBairro[1].trim();

        } else {
            const matchRua = blocoEndereco.match(/(?:RUA|AV|AVENIDA|ESTRADA)[:\s]+([A-ZÀ-Ú\s\d]+?)(?:\s\(|,)/i);
            const matchNumero = blocoEndereco.match(/,\s*(\d{1,5})/);
            const matchBairro = blocoEndereco.match(/([A-ZÀ-Ú\s]+)\s\/\s(?:BALNEÁRIO|CRICIÚMA|IÇARA)/i);
            
            matchRuaStr = matchRua ? matchRua[1].trim() : "";
            matchNumStr = matchNumero ? matchNumero[1].trim() : "";
            matchBairroStr = matchBairro ? matchBairro[1].trim() : "CENTRO";
        }

        const matchCep = blocoEndereco.match(/CEP[:\s]+(\d{2}\s?\d{3}-?\d{3})/i) || 
                         blocoEndereco.match(/(\d{5}-?\d{3})/);
        matchCepStr = matchCep ? (matchCep[1] || matchCep[0]).replace(/\D/g, "") : "";

        let cidadeFinal = "CRICIÚMA";
        if (blocoEndereco.includes("RINCÃO") || blocoEndereco.includes("RINCAO")) {
            cidadeFinal = "BALNEÁRIO RINCÃO";
        } else if (blocoEndereco.includes("IÇARA") || blocoEndereco.includes("ICARA")) {
            cidadeFinal = "IÇARA";
        }

        let matchLoteamento = "", matchEdificio = "", matchComplemento = "";
        
        const regexApto = blocoEndereco.match(/(?:APTO|APARTAMENTO|AP)\s?(\d+[A-Z]?)/i);
        const regexBloco = blocoEndereco.match(/(?:BL|BLOCO)\s?([A-Z0-9]+)/i);
        const regexEdif = blocoEndereco.match(/(?:EDIFÍCIO|EDIF|ED)\.?\s+([A-ZÀ-Ú\s0-9]+?)(?:,|\n|$)/i);
        const regexLote = blocoEndereco.match(/(?:LOTEAMENTO|LOTE)\s+([A-ZÀ-Ú\s0-9]+?)(?:,|\n|$)/i);

        if (regexApto) matchComplemento += `AP ${regexApto[1]} `;
        if (regexBloco) matchComplemento += `BL ${regexBloco[1]}`;
        if (regexEdif) matchEdificio = regexEdif[1].trim();
        if (regexLote) matchLoteamento = regexLote[1].trim();

        const dadosExtraidos = {
            nm_contribuinte: nomeCandidato,
            nr_cpf_atual: "",
            nr_cep_atual: matchCepStr,
            nm_rua_atual: matchRuaStr,
            ds_numero_atual: matchNumStr,
            ds_bairro_atual: matchBairroStr,
            ds_cidade_atual: cidadeFinal,
            ds_loteamento_extr: matchLoteamento,
            ds_edificio_extr: matchEdificio,
            ds_complemento_extr: matchComplemento.trim(),
            ds_loteamento_atual: matchLoteamento,
            ds_edificio_atual: matchEdificio,
            ds_complemento_atual: matchComplemento.trim(),
            ds_obs: `Extraído via ${isCelesc ? 'Celesc' : 'Cooperaliança'} (${isPdf ? 'PDF' : 'Imagem'})`
        };

        return res.json(dadosExtraidos);

    } catch (error) {
        console.error("Erro no Controller OCR:", error);
        return res.status(500).json({ erro: "Erro interno no OCR." });
    }
};

const salvarDadosContribuinte = async (req, res) => {
    const dados = req.body;
    if (!dados.cd_contribuinte) return res.status(400).json({ erro: "Código obrigatório." });
    try {
        await atualizarContribuinte(dados);
        return res.json({ mensagem: "Sucesso!" });
    } catch (error) {
        console.error("Erro salvar:", error);
        return res.status(500).json({ erro: "Erro banco." });
    }
};

/**
 * Envia o e-mail de confirmação (Protocolo)
 */
const enviarComprovante = async (req, res) => {
    console.log("🚀 BOTÃO CLICADO: Tentando enviar e-mail..."); // Se isso não aparecer no log, o problema é no Front-end!
    const { email, nome, protocolo } = req.body;
    try {
        const clientes = await buscaClientes();
        const nomePrefeitura = (clientes && clientes.length > 0) 
            ? clientes[0].nm_cliente 
            : "Prefeitura Municipal";

        console.log(`[DEBUG] Enviando comprovante para ${email}`);

        await transporter.sendMail({
            from: 'AtualizaAí <contato@atualizaai.ia.br>',
            to: email,
            subject: `Protocolo de Atualização: ${protocolo}`,
            html: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #198754; text-align: center;">Olá, ${nome}!</h2>
                    <p style="font-size: 16px;">Sua solicitação de atualização cadastral para a <strong>${nomePrefeitura}</strong> foi recebida.</p>
                    <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #666;">Seu Número de Protocolo:</p>
                        <strong style="font-size: 24px; color: #0d6efd;">${protocolo}</strong>
                    </div>
                    <p style="font-size: 14px; color: #555;">Agora nossa equipe técnica irá validar as informações e o documento anexado. Você receberá uma notificação assim que o processo for concluído.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999; text-align: center;">Atenciosamente,<br/><strong>${nomePrefeitura}</strong></p>
                </div>
            `
        });
        
        res.json({ sucesso: true });
    } catch (error) {
        console.error("Erro e-mail comprovante:", error.message);
        res.status(500).json({ erro: "Erro ao enviar e-mail de protocolo." });
    }
};

const listarPedidosPendentes = async (req, res) => {
    const { status } = req.query; 
    let sql = `
        SELECT st_responsavel, *, nm_contribuinte as solicitante
        FROM database.dados_contribuintes 
        WHERE st_validado_prefeitura = 'N'
    `;
    
    const params = [];
    if (status && status !== 'TODOS') {
        sql += ` AND st_editado_manual = $1`;
        params.push(status);
    }
    
    sql += ` ORDER BY dt_atualizacao DESC, hr_atualizacao DESC`;
    
    try {
        const { rows } = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error("Erro ao listar pedidos:", error);
        res.status(500).json({ erro: "Erro ao carregar a lista." });
    }
};

const validarPedidoPrefeitura = async (req, res) => {
    const { id, acao } = req.body; 
    try {
        const pedidoQuery = await pool.query("SELECT * FROM database.dados_contribuintes WHERE id_dados_contribuintes = $1", [id]);
        if (pedidoQuery.rows.length === 0) return res.status(404).json({ erro: "Não encontrado." });
        const pedido = pedidoQuery.rows[0];

        if (acao === 'CANCELAR') {
            // SMS via Twilio
            try {
                await client.messages.create({
                    messagingServiceSid: process.env.TWILIO_MESSAGE_SERVICE_SID,
                    to: `+55${pedido.nr_telefone_atual.replace(/\D/g, "")}`,
                    body: `AtualizaAí: Ola ${pedido.nm_contribuinte.split(' ')[0]}, seu pedido foi indeferido. Verifique seu e-mail.`
                });
            } catch (err) { console.error("Erro SMS:", err.message); }

            // E-mail via Resend
            if (pedido.ds_email_atual) {
                try {
                    await transporter.sendMail({
                        from: 'AtualizaAí <contato@atualizaai.ia.br>',
                        to: pedido.ds_email_atual,
                        subject: "Pedido de Atualização Indeferido",
                        html: `
                            <h3>Olá, ${pedido.nm_contribuinte}</h3>
                            <p>Seu pedido de atualização cadastral foi analisado e <strong>indeferido</strong> devido a inconsistências nos dados ou no documento enviado.</p>
                            <p>Favor procurar o setor de Cadastro Imobiliário da Prefeitura para regularizar sua situação.</p>
                        `
                    });
                } catch (err) { console.error("Erro Email Indeferimento:", err.message); }
            }
            await pool.query("UPDATE database.dados_contribuintes SET st_validado_prefeitura = 'C' WHERE id_dados_contribuintes = $1", [id]);
            return res.json({ sucesso: true });
        } else {
            await pool.query("UPDATE database.dados_contribuintes SET st_validado_prefeitura = 'S' WHERE id_dados_contribuintes = $1", [id]);
            return res.json({ sucesso: true });
        }
    } catch (error) {
        console.error("Erro ao validar:", error);
        res.status(500).json({ erro: "Erro ao processar validação." });
    }
};

async function validarCpfReceita(req, res) {
    const { cpf } = req.params;
    const token = "199026855WVdHwXRyQK359336952"; 
    try {
        const response = await axios.get(`https://ws.hubdodesenvolvedor.com.br/v2/nome_cpf/?cpf=${cpf}&token=${token}`);
        return res.json(response.data);
    } catch (error) {
        return res.status(500).json({ status: false });
    }
}

const verificarStatusImovel = async (req, res) => {
    const { reduzido } = req.params;
    try {
        const result = await pool.query(
            `SELECT st_validado_prefeitura 
             FROM database.dados_contribuintes 
             WHERE cd_reduzido_imovel = $1 
             ORDER BY dt_atualizacao DESC, hr_atualizacao DESC LIMIT 1`,
            [reduzido]
        );

        if (result.rows.length > 0) {
            const status = result.rows[0].st_validado_prefeitura;
            if (status === 'S' || status === 'C') {
                return res.json({ 
                    jaProcessado: true, 
                    descricaoStatus: status === 'S' ? 'APROVADO' : 'INDEFERIDO' 
                });
            }
        }
        res.json({ jaProcessado: false });
    } catch (error) {
        console.error("Erro ao verificar status:", error);
        res.status(500).json({ erro: "Erro ao consultar status." });
    }
};

module.exports = { 
    salvarDadosContribuinte, 
    processarComprovante,
    listarPedidosPendentes,
    validarPedidoPrefeitura,
    validarCpfReceita,
    verificarStatusImovel,
    enviarComprovante
};