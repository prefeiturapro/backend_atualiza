const { atualizarContribuinte, extrairTextoDocumento } = require("../models/dadoscontribuintes");
const pool = require("../models/connection"); 
const transporter = require("../config/mail"); 
const twilio = require('twilio');
const axios = require('axios');

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

        // --- 2. LÓGICA DE EXTRAÇÃO DE ENDEREÇO (REESCRITA PARA PRECISÃO) ---
        const indexNome = textoLimpo.indexOf(nomeCandidato);
        const textoAposNome = indexNome !== -1 ? textoLimpo.substring(indexNome) : textoLimpo;
        const blocoEndereco = textoAposNome.substring(0, 450); 

        let matchRuaStr = "", matchNumStr = "", matchBairroStr = "CENTRO", matchCepStr = "", matchCpfStr = "";

        const matchCpf = textoLimpo.match(/(?:CPF|CNPJ)[:\s]*([\d\.\-\/]{11,18})/i);
        if (matchCpf) matchCpfStr = matchCpf[1].replace(/\D/g, "");

        if (isCelesc) {
            // REGEX PARA CELESC: Busca tudo entre "ENDERECO:" e o primeiro grupo de números que tenha espaço antes
            // Isso isola "PRES JUSCELINO" ou "ARARANGUA" perfeitamente.
            const regexCelescRua = blocoEndereco.match(/ENDERECO[:\s]+([A-ZÀ-Ú\s\.\-]+?)\s+(\d{1,5})/i);
            
            if (regexCelescRua) {
                matchRuaStr = regexCelescRua[1].trim(); // Pega o grupo 1 (Rua)
                matchNumStr = regexCelescRua[2];      // Pega o grupo 2 (Número)
            } else {
                // Fallback caso o padrão acima falhe
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

            // Bairro: Pega o que está após o último hífen antes do CEP
            const findBairro = blocoEndereco.match(/-\s+([A-ZÀ-Ú\s]+?)\s+CEP/i);
            if (findBairro) matchBairroStr = findBairro[1].trim();

        } else {
            // Padrão Cooperaliança ou Outros
            const matchRua = blocoEndereco.match(/(?:RUA|AV|AVENIDA|ESTRADA)[:\s]+([A-ZÀ-Ú\s\d]+?)(?:\s\(|,)/i);
            const matchNumero = blocoEndereco.match(/,\s*(\d{1,5})/);
            const matchBairro = blocoEndereco.match(/([A-ZÀ-Ú\s]+)\s\/\s(?:BALNEÁRIO|CRICIÚMA|IÇARA)/i);
            
            matchRuaStr = matchRua ? matchRua[1].trim() : "";
            matchNumStr = matchNumero ? matchNumero[1].trim() : "";
            matchBairroStr = matchBairro ? matchBairro[1].trim() : "CENTRO";
        }

        // CEP
        const matchCep = blocoEndereco.match(/CEP[:\s]+(\d{2}\s?\d{3}-?\d{3})/i) || 
                         blocoEndereco.match(/(\d{5}-?\d{3})/);
        matchCepStr = matchCep ? (matchCep[1] || matchCep[0]).replace(/\D/g, "") : "";

        // Cidade
        let cidadeFinal = "CRICIÚMA";
        if (blocoEndereco.includes("RINCÃO") || blocoEndereco.includes("RINCAO")) {
            cidadeFinal = "BALNEÁRIO RINCÃO";
        } else if (blocoEndereco.includes("IÇARA") || blocoEndereco.includes("ICARA")) {
            cidadeFinal = "IÇARA";
        }

        const dadosExtraidos = {
            nm_contribuinte: nomeCandidato,
            nr_cpf_atual: matchCpfStr,
            nr_cep_atual: matchCepStr,
            nm_rua_atual: matchRuaStr,
            ds_numero_atual: matchNumStr,
            ds_bairro_atual: matchBairroStr,
            ds_cidade_atual: cidadeFinal,
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

// --- FUNÇÕES DE ADMINISTRAÇÃO ---
const listarPedidosPendentes = async (req, res) => {
    const { status } = req.query; 
    let sql = `SELECT * FROM database.dados_contribuintes WHERE st_validado_prefeitura = 'N'`;
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
        res.status(500).json({ erro: "Erro listar." });
    }
};

const validarPedidoPrefeitura = async (req, res) => {
    const { id, acao } = req.body; 
    try {
        const pedidoQuery = await pool.query("SELECT * FROM database.dados_contribuintes WHERE id_dados_contribuintes = $1", [id]);
        if (pedidoQuery.rows.length === 0) return res.status(404).json({ erro: "Não encontrado." });
        const pedido = pedidoQuery.rows[0];

        if (acao === 'CANCELAR') {
            try {
                const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                await client.messages.create({
                    body: `AtualizaAI: Ola ${pedido.nm_contribuinte}, seu pedido foi indeferido.`,
                    to: `+55${pedido.nr_telefone_atual.replace(/\D/g, "")}`,
                    from: process.env.TWILIO_NUMBER
                });
            } catch (err) { console.error("Erro SMS:", err.message); }

            if (pedido.ds_email_atual) {
                try {
                    await transporter.sendMail({
                        from: `"Prefeitura" <${process.env.EMAIL_USER}>`,
                        to: pedido.ds_email_atual,
                        subject: "Pedido Indeferido",
                        html: `<p>Olá ${pedido.nm_contribuinte}, seu pedido foi cancelado.</p>`
                    });
                } catch (err) { console.error("Erro Email:", err.message); }
            }
            await pool.query("UPDATE database.dados_contribuintes SET st_validado_prefeitura = 'C' WHERE id_dados_contribuintes = $1", [id]);
            return res.json({ sucesso: true });
        } else {
            await pool.query("UPDATE database.dados_contribuintes SET st_validado_prefeitura = 'S' WHERE id_dados_contribuintes = $1", [id]);
            return res.json({ sucesso: true });
        }
    } catch (error) {
        res.status(500).json({ erro: "Erro interno." });
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

module.exports = { 
    salvarDadosContribuinte, 
    processarComprovante,
    listarPedidosPendentes,
    validarPedidoPrefeitura,
    validarCpfReceita
};