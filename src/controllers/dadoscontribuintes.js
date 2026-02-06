const { atualizarContribuinte, extrairTextoDocumento } = require("../models/dadoscontribuintes");
const pool = require("../models/connection"); // Importação necessária para as consultas da Prefeitura
const transporter = require("../config/mail"); // Para notificações de cancelamento
const twilio = require('twilio');

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
        
        // --- 1. LÓGICA DE IDENTIFICAÇÃO DO NOME ---
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

        // --- 2. LÓGICA DE EXTRAÇÃO ANCORADA ---
        const indexNome = textoLimpo.indexOf(nomeCandidato);
        const textoAposNome = indexNome !== -1 ? textoLimpo.substring(indexNome) : textoLimpo;
        const blocoEndereco = textoAposNome.substring(0, 450); 

        let matchRua, matchNumero, matchBairro, matchCep;

        if (isCelesc) {
            // LÓGICA CELESC: Captura Rua e Número
            const regexCelescEnd = blocoEndereco.match(/ENDERECO[:\s]+([A-ZÀ-Ú\s\d]+?)\s+(\d{1,5})/i);
            
            if (regexCelescEnd) {
                matchRua = { 1: regexCelescEnd[1].replace(/\sVL$/, "").trim() };
                matchNumero = { 1: regexCelescEnd[2] };
                
                // BUSCA DE BAIRRO CELESC (BLINDADA)
                const regexBairroCelesc = blocoEndereco.match(/(?:\d{1,5})\s+(?:LD|LT|QD|QUADRA|LOTE)?\s?\d*\s?-?\s?([A-ZÀ-Ú\s]{3,20})(?:\s+-|CEP|CIDADE|$|\n)/i);
                
                if (regexBairroCelesc && !regexBairroCelesc[1].includes("CONSULTE") && !regexBairroCelesc[1].includes("CHAVE")) {
                    matchBairro = { 1: regexBairroCelesc[1].trim() };
                } else {
                    const fallbackBairro = blocoEndereco.match(/-\s+([A-ZÀ-Ú\s]+?)\s+CEP/i);
                    matchBairro = { 1: fallbackBairro ? fallbackBairro[1].trim() : "CENTRO" };
                }
            }
        } else {
            // Padrão Cooperaliança
            matchRua = blocoEndereco.match(/(?:RUA|AV|AVENIDA|ESTRADA)[:\s]+([A-ZÀ-Ú\s\d]+?)(?:\s\(|,)/i);
            matchNumero = blocoEndereco.match(/,\s*(\d{1,5})/);
            matchBairro = blocoEndereco.match(/([A-ZÀ-Ú\s]+)\s\/\s(?:BALNEÁRIO|CRICIÚMA|IÇARA)/i);
        }

        // CEP e Cidade
        matchCep = blocoEndereco.match(/CEP[:\s]+(\d{2}\s?\d{3}-?\d{3})/i) || 
                   blocoEndereco.match(/(\d{5}-?\d{3})/);

        let cidadeFinal = "CRICIÚMA";
        if (blocoEndereco.includes("RINCÃO") || blocoEndereco.includes("RINCAO")) {
            cidadeFinal = "BALNEÁRIO RINCÃO";
        } else if (blocoEndereco.includes("IÇARA") || blocoEndereco.includes("ICARA")) {
            cidadeFinal = "IÇARA";
        }

        const dadosExtraidos = {
            nm_contribuinte: nomeCandidato,
            nr_cep_atual: matchCep ? (matchCep[1] || matchCep[0]).replace(/\D/g, "") : "",
            nm_rua_atual: matchRua ? matchRua[1].trim() : "",
            ds_numero_atual: matchNumero ? matchNumero[1].trim() : "",
            ds_bairro_atual: matchBairro ? matchBairro[1].trim() : "CENTRO",
            ds_cidade_atual: cidadeFinal,
            ds_obs: `Extraído via ${isCelesc ? 'Celesc' : 'Cooperaliança'} (${isPdf ? 'PDF' : 'Imagem'})`
        };

        return res.json(dadosExtraidos);

    } catch (error) {
        console.error("Erro no Controller OCR:", error);
        return res.status(500).json({ erro: "Erro interno ao processar os dados do documento." });
    }
};

const salvarDadosContribuinte = async (req, res) => {
    const dados = req.body;
    if (!dados.cd_contribuinte) return res.status(400).json({ erro: "Código do contribuinte é obrigatório." });

    try {
        await atualizarContribuinte(dados);
        return res.json({ mensagem: "Dados atualizados com sucesso!" });
    } catch (error) {
        console.error("Erro ao salvar:", error);
        return res.status(500).json({ erro: "Erro ao salvar dados no banco." });
    }
};

// ============================================================
// --- NOVAS FUNÇÕES PARA O USUÁRIO DA PREFEITURA ---
// ============================================================

/**
 * Lista todos os pedidos que aguardam validação da Prefeitura
 */
const listarPedidosPendentes = async (req, res) => {
    const { status } = req.query; // Filtro: TODOS, N (Original), S (Alterado)
    
    let sql = `
        SELECT 
            id_dados_contribuintes, cd_reduzido_imovel, ds_inscricao_imovel, 
            cd_contribuinte, nm_contribuinte, st_editado_manual,
            nm_rua_extr, ds_numero_extr, nr_cep_extr, ds_bairro_extr, ds_cidade_extr,
            nm_rua_atual, ds_numero_atual, nr_cep_atual, ds_bairro_atual, ds_cidade_atual,
            nr_telefone_atual, ds_email_atual, dt_atualizacao, hr_atualizacao, ds_protocolo
        FROM database.dados_contribuintes
        WHERE st_validado_prefeitura IS NULL
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
        res.status(500).json({ erro: "Erro ao buscar pedidos na base." });
    }
};

/**
 * Executa a atualização definitiva ou cancela o pedido notificando o contribuinte
 */
const validarPedidoPrefeitura = async (req, res) => {
    const { id, acao } = req.body; 

    try {
        const pedidoQuery = await pool.query(
            "SELECT ds_protocolo, nr_telefone_atual, ds_email_atual, nm_contribuinte FROM database.dados_contribuintes WHERE id_dados_contribuintes = $1", 
            [id]
        );
        
        if (pedidoQuery.rows.length === 0) {
            return res.status(404).json({ erro: "Pedido não encontrado." });
        }

        const pedido = pedidoQuery.rows[0];

        if (acao === 'CANCELAR') {
            // 1. Notificação SMS via Twilio
            try {
                const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                await client.messages.create({
                    body: `AtualizaAI: Ola ${pedido.nm_contribuinte}, seu pedido de atualizacao ${pedido.ds_protocolo} foi indeferido. Verifique seu e-mail.`,
                    to: `+55${pedido.nr_telefone_atual.replace(/\D/g, "")}`,
                    from: process.env.TWILIO_NUMBER
                });
            } catch (err) { console.error("Erro ao enviar SMS de cancelamento:", err.message); }

            // 2. Notificação E-mail via Nodemailer
            if (pedido.ds_email_atual) {
                try {
                    await transporter.sendMail({
                        from: `"Prefeitura de Paraíba do Sul" <${process.env.EMAIL_USER}>`,
                        to: pedido.ds_email_atual,
                        subject: "Pedido de Atualização Indeferido",
                        html: `<p>Olá ${pedido.nm_contribuinte}, seu pedido de protocolo <b>${pedido.ds_protocolo}</b> foi cancelado pela administração municipal.</p>`
                    });
                } catch (err) { console.error("Erro ao enviar E-mail de cancelamento:", err.message); }
            }

            await pool.query("UPDATE database.dados_contribuintes SET st_validado_prefeitura = 'C' WHERE id_dados_contribuintes = $1", [id]);
            return res.json({ sucesso: true, mensagem: "Pedido cancelado e notificações enviadas." });

        } else {
            // AÇÃO: EXECUTAR
            await pool.query("UPDATE database.dados_contribuintes SET st_validado_prefeitura = 'S' WHERE id_dados_contribuintes = $1", [id]);
            return res.json({ sucesso: true, mensagem: "Atualização realizada!" });
        }

    } catch (error) {
        console.error("Erro ao processar pedido:", error);
        res.status(500).json({ erro: "Erro interno no processamento da validação." });
    }
};

module.exports = { 
    salvarDadosContribuinte, 
    processarComprovante,
    listarPedidosPendentes,
    validarPedidoPrefeitura
};