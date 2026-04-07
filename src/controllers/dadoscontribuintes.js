const { atualizarContribuinte, extrairTextoDocumento } = require("../models/dadoscontribuintes");
const { buscaClientes } = require("../models/dadosclientes");
const pool = require("../models/connection");
const transporter = require("../config/mail");
const twilio = require('twilio');
const axios = require('axios');
const { sincronizarContribuinteBauhaus } = require("../services/bauhaus");

// INSTÂNCIA DO CLIENTE TWILIO
const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Normaliza string para comparação: remove acentos, maiúsculas, espaços extras
 */
// ─── Normalização ─────────────────────────────────────────────────────────────
function norm(str) {
    if (!str) return "";
    return str.toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\t/g, " ").replace(/ {2,}/g, " ").trim();
}

// ─── Helpers de extração ──────────────────────────────────────────────────────

function extrairCep(T) {
    const m = T.match(/(\d{5})[.\s-]?(\d{3})(?!\d)/);
    return m ? m[1] + m[2] : "";
}
function formatarCep(cep) {
    return cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;
}

const SKIP_NOME = /LTDA|S\.?A\.?|S\/A|PREFEITURA|CELESC|CASAN|SABESP|ENEL|CPFL|COPEL|EQUATORIAL|ENERGISA|COELBA|LIGHT|COMGAS|COOPERATIVA|CONCESSIONARIA|SECRETARIA|BANCO|COMPANHIA|NOTA FISCAL|FATURA|VENCIMENTO|CONSUMO|INTERNET|TELEFONE|ENERGIA|AGUA|GAS|TRIBUTO|IMPOSTO|SERVICO|CNPJ|PROTOCOLO|DOCUMENTO|DISTRIBUICAO|DANFE|ELETRONICA|CLIENTE|MEDIDOR|UNIDADE/;

function extrairNome(T) {
    // 1. Label explícito — usa [A-Z .] (sem \n) para não capturar a linha seguinte
    const mL = T.match(/(?:NOME|TITULAR|CLIENTE|CONSUMIDOR|CONTRIBUINTE|PROPRIETARIO|BENEFICIARIO)[:\s]+([A-Z][A-Z .]{5,55})(?=\n|CPF|CNPJ|END|RUA|AV|CEP|BAIRRO|NASC|DATA)/);
    if (mL) return mL[1].trim();
    // 2. Heurística: linha com 3+ palavras todas-letras sem keywords
    let cand = "";
    for (const linha of T.split('\n').map(l => l.trim()).filter(Boolean)) {
        if (linha.length < 8 || linha.length > 60) continue;
        if (!/^[A-Z][A-Z\s\.]+$/.test(linha) || SKIP_NOME.test(linha)) continue;
        const p = linha.split(' ').filter(Boolean).length;
        if (p >= 3) return linha;
        if (p === 2 && !cand) cand = linha;
    }
    return cand;
}

function extrairComplemento(T) {
    const partes = [];
    const rA = T.match(/\b(?:APTO?\.?|APARTAMENTO)\s*:?\s*(\d+[A-Z]?)\b/);
    const rS = T.match(/\bSALA\s*:?\s*(\d+[A-Z]?)\b/);
    const rC = T.match(/\bCASA\s*:?\s*(\d+[A-Z]?)\b/);
    const rB = T.match(/\b(?:BLOCO|BL)\s*:?\s*([A-Z0-9]+)\b/);
    if (rA) partes.push(`APTO ${rA[1]}`);
    if (rS) partes.push(`SALA ${rS[1]}`);
    if (rC && !rA) partes.push(`CASA ${rC[1]}`);
    if (rB) partes.push(`BL ${rB[1]}`);
    return partes.join(' ').trim();
}

/**
 * Parseia uma linha de endereço no formato mais comum dos comprovantes BR:
 * "LOGRADOURO NUMERO COMPLEMENTO - BAIRRO"  (CELESC/ENEL sem tipo de rua)
 * "RUA LOGRADOURO, NUMERO, COMPLEMENTO"      (com vírgulas)
 * "RUA LOGRADOURO NUMERO COMPLEMENTO"        (sem separadores)
 */
function parsearLinhaEndereco(linha) {
    let bairroExtr = "";

    // Separar bairro pelo " - " (lado direito)
    const dashIdx = linha.search(/\s+-\s+/);
    if (dashIdx > 0) {
        bairroExtr = linha.substring(dashIdx).replace(/^\s*-\s*/, "").trim();
        linha = linha.substring(0, dashIdx).trim();
    }

    // Limpa sufixos de cidade/sigla que podem vir junto ao bairro
    // Ex: "CENTRO ITAPEMA (ITP)" → "CENTRO"
    // Ex: "CENTRO FLORIANOPOLIS SC" → "CENTRO"
    bairroExtr = bairroExtr
        .replace(/\s+[A-Z][A-Z\s]{2,20}\s*\([A-Z]{2,4}\)\s*$/, "") // "ITAPEMA (ITP)"
        .replace(/\s+[A-Z]{2,20}\s+[A-Z]{2}\s*$/, "")               // "FLORIANOPOLIS SC"
        .replace(/\s+[A-Z]{2}\s*$/, "")                              // trailing UF isolado "SC"
        .trim();

    // Padrão com vírgula: "RUA NOME, 123, COMPLEMENTO"
    const mComma = linha.match(/^(.*?),\s*(\d{1,6}[A-Z]?),?\s*(.*)$/);
    if (mComma) {
        return { ruaExtr: mComma[1].trim(), numeroExtr: mComma[2].trim(), complementoExtr: (mComma[3] || "").trim(), bairroExtr };
    }

    // Padrão com "Nº / N. / N°"
    const mNLabel = linha.match(/^(.*?)\s+N[O°º]?\.?\s*(\d{1,6}[A-Z]?)\s*(.*)$/);
    if (mNLabel) {
        return { ruaExtr: mNLabel[1].trim(), numeroExtr: mNLabel[2].trim(), complementoExtr: mNLabel[3].trim(), bairroExtr };
    }

    // Padrão geral: primeiro número isolado = número da casa
    const mNum = linha.match(/^(.*?)\s+(\d{1,6}[A-Z]?)\s*(.*)$/);
    if (mNum) {
        return { ruaExtr: mNum[1].trim(), numeroExtr: mNum[2].trim(), complementoExtr: mNum[3].trim(), bairroExtr };
    }

    return { ruaExtr: linha, numeroExtr: "", complementoExtr: "", bairroExtr };
}

/**
 * Separa o nome do edifício do campo complemento quando não há prefixo "ED."
 * Ex: "AP 203 MANHATTAN" → { complemento: "AP 203", edificio: "MANHATTAN" }
 * Ex: "AP 603 ED MONTMARTRE" → { complemento: "AP 603", edificio: "MONTMARTRE" }
 */
function separarEdificioDoComplemento(complementoExtr) {
    // Caso 1: prefixo explícito EDIFICIO / EDIF. / ED.
    const mEdif = complementoExtr.match(/\b(?:EDIFICIO|EDIF\.?|ED\.?)\s+([A-Z][A-Z\s0-9]{2,30})(?=\s*$)/);
    if (mEdif) {
        return {
            complemento: complementoExtr.substring(0, complementoExtr.lastIndexOf(mEdif[0])).trim(),
            edificio:    mEdif[1].trim()
        };
    }
    // Caso 2: sem prefixo — "AP 203 MANHATTAN" / "APTO 5 SOLAR DAS FLORES"
    const mSemPref = complementoExtr.match(/^((?:AP(?:TO)?\.?\s*\d+[A-Z]?|SL\s*\d+[A-Z]?|SALA\s*\d+[A-Z]?|CASA\s*\d+[A-Z]?))\s+([A-Z][A-Z0-9\s]{2,30})$/);
    if (mSemPref) {
        return {
            complemento: mSemPref[1].trim(),
            edificio:    mSemPref[2].trim()
        };
    }
    return { complemento: complementoExtr, edificio: "" };
}

// ─── Parsers específicos por tipo de comprovante ──────────────────────────────

/**
 * CELESC / COOPERALIANÇA
 * ENDERECO: LOGRADOURO NUMERO COMPLEMENTO - BAIRRO
 * CEP: XXXXX-XXX   CIDADE: CIDADE UF
 */
function parsearCelesc(T) {
    const nome = extrairNome(T);
    let ruaExtr = "", numeroExtr = "", complementoExtr = "", bairroExtr = "", cidadeExtr = "";
    let edificioExtr = "";

    const LABEL_RE = /^(?:CEP|CIDADE|CPF|CNPJ|REFERENCIA|VENCIMENTO|UNIDADE|GRUPO|CLIENTE|NOTA|CHAVE|PROTOCOLO|BANDEIRA|MEDIDOR|LEITURA)/;
    const mEnd = T.match(/ENDERECO[:\s]+([^\n]{5,150})(?:\n([^\n]{0,120}))?/);
    if (mEnd) {
        let linhaEnd = mEnd[1].trim();
        // Se a próxima linha for continuação do endereço (não começa com label conhecido), concatena
        if (mEnd[2]) {
            const cont = mEnd[2].trim();
            if (cont && !LABEL_RE.test(cont)) linhaEnd = linhaEnd + " " + cont;
        }
        const p = parsearLinhaEndereco(linhaEnd);
        ruaExtr = p.ruaExtr; numeroExtr = p.numeroExtr;
        complementoExtr = p.complementoExtr; bairroExtr = p.bairroExtr;

        const edifSep = separarEdificioDoComplemento(complementoExtr);
        complementoExtr = edifSep.complemento;
        if (edifSep.edificio) edificioExtr = edifSep.edificio;
    }

    // "CEP: 88800-000  CIDADE: CRICIUMA SC"
    const mCC = T.match(/CEP[:\s.]+(\d{5}[\s.-]?\d{3})\s+CIDADE[:\s]+([A-Z][A-Z\s]+?)\s+([A-Z]{2})(?=\s|\n|$)/);
    const cepRaw = mCC ? mCC[1].replace(/\D/g, "") : extrairCep(T);
    if (mCC) cidadeExtr = mCC[2].trim();

    if (!cidadeExtr) {
        const mCid = T.match(/CIDADE[:\s]+([A-Z][A-Z\s]+?)\s+([A-Z]{2})(?=\s|\n|$)/);
        if (mCid) cidadeExtr = mCid[1].trim();
    }

    return { nome, ruaExtr, numeroExtr, complementoExtr, bairroExtr, cidadeExtr, cepFormatado: formatarCep(cepRaw), edificioExtr, loteamentoExtr: "" };
}

/**
 * CASAN (água SC) / SABESP / COPASA / SANEPAR
 * Formato: campos individuais em linhas separadas
 * NOME: ...  ENDERECO: ...  BAIRRO: ...  CIDADE/UF: ...  CEP: ...
 */
function parsearSaneamento(T) {
    const nome = extrairNome(T);
    let ruaExtr = "", numeroExtr = "", complementoExtr = "", bairroExtr = "", cidadeExtr = "";

    const mEnd = T.match(/(?:ENDERECO|LOGRADOURO)[:\s]+([^\n]{5,150})/);
    if (mEnd) {
        const p = parsearLinhaEndereco(mEnd[1].trim());
        ruaExtr = p.ruaExtr; numeroExtr = p.numeroExtr;
        complementoExtr = p.complementoExtr; bairroExtr = p.bairroExtr;
    }
    if (!numeroExtr) {
        const mN = T.match(/(?:NUMERO|N[UÚ]MERO|NRO|N[O°º])[:\s]+(\d{1,6}[A-Z]?)/);
        if (mN) numeroExtr = mN[1];
    }
    const mBairro = T.match(/BAIRRO[:\s]+([A-Z][A-Z\s]{2,40})(?=\n|CEP|CIDADE|MUN|\/[A-Z]{2})/);
    if (mBairro && !bairroExtr) bairroExtr = mBairro[1].trim();

    const mCid = T.match(/(?:CIDADE|MUNICIPIO|MUN)[:\s]+([A-Z][A-Z\s]+?)\s+([A-Z]{2})(?=\s|\n|$|\/)/);
    if (mCid) cidadeExtr = mCid[1].trim();
    else {
        const mCidUF = T.match(/([A-Z][A-Z\s]{2,25}?)\/([A-Z]{2})\b/);
        if (mCidUF && !/RUA|AV|CNPJ|CPF/.test(mCidUF[1])) cidadeExtr = mCidUF[1].trim();
    }

    return { nome, ruaExtr, numeroExtr, complementoExtr, bairroExtr, cidadeExtr, cepFormatado: formatarCep(extrairCep(T)), edificioExtr: "", loteamentoExtr: "" };
}

/**
 * ENEL / CPFL / LIGHT / EQUATORIAL / ENERGISA / COPEL (energia)
 * Normalmente trazem "ENDERECO:" com RUA, NUM, COMPL e BAIRRO: separado
 */
function parsearEnergiaGenerica(T) {
    const nome = extrairNome(T);
    let ruaExtr = "", numeroExtr = "", complementoExtr = "", bairroExtr = "", cidadeExtr = "";

    const mEnd = T.match(/(?:ENDERECO|LOGRADOURO)[:\s]+([^\n]{5,150})/);
    if (mEnd) {
        const p = parsearLinhaEndereco(mEnd[1].trim());
        ruaExtr = p.ruaExtr; numeroExtr = p.numeroExtr;
        complementoExtr = p.complementoExtr; bairroExtr = p.bairroExtr;
    }
    if (!numeroExtr) {
        const mN = T.match(/(?:NUMERO|N[UÚ]MERO|NRO|N[O°º])[:\s]+(\d{1,6}[A-Z]?)/);
        if (mN) numeroExtr = mN[1];
    }
    if (!complementoExtr) complementoExtr = extrairComplemento(T);

    const mBairro = T.match(/BAIRRO[:\s]+([A-Z][A-Z\s]{2,40})(?=\n|CEP|CIDADE|MUN|\/[A-Z]{2})/);
    if (mBairro && !bairroExtr) bairroExtr = mBairro[1].trim();

    // Cidade: prefere label; fallback só após CEP (evita capturar cidade da empresa no header)
    const mCidLabel = T.match(/(?:CIDADE|MUNICIPIO|MUN)[:\s]+([A-Z][A-Z\s]+?)\s+([A-Z]{2})(?=\s|\n|$)/);
    if (mCidLabel) {
        cidadeExtr = mCidLabel[1].trim();
    } else {
        const cepRaw = extrairCep(T);
        if (cepRaw) {
            const afterCep = T.substring(T.indexOf(cepRaw) + cepRaw.length);
            const mCidUF = afterCep.match(/([A-Z][A-Z\s]{2,25}?)\/([A-Z]{2})\b/);
            if (mCidUF && !/RUA|AV|CNPJ|CPF/.test(mCidUF[1])) cidadeExtr = mCidUF[1].trim();
        }
    }

    const rEdif = T.match(/\b(?:EDIFICIO|EDIF)\s+([A-Z][A-Z\s0-9]{2,30})(?=,|\n|AP|BL)/);
    const rLote = T.match(/\bLOTEAMENTO\s+([A-Z][A-Z\s0-9]{2,30})(?=,|\n)/);
    let edificioExtr = rEdif ? rEdif[1].trim() : "";

    // Separa edificio do complemento quando não há prefixo explícito (ex: "AP 203 MANHATTAN")
    if (!edificioExtr && complementoExtr) {
        const edifSep = separarEdificioDoComplemento(complementoExtr);
        complementoExtr = edifSep.complemento;
        edificioExtr    = edifSep.edificio;
    }

    return {
        nome, ruaExtr, numeroExtr, complementoExtr, bairroExtr, cidadeExtr,
        cepFormatado: formatarCep(extrairCep(T)),
        edificioExtr,
        loteamentoExtr: rLote ? rLote[1].trim() : ""
    };
}

/**
 * SAMAE (Serviço Autônomo Municipal de Água e Esgoto)
 * O endereço fica na linha de inscrição: "NNN.NNN.NNN.NNNN.NNN R. NOME, NUM XXXX - BAIRRO CIDADE"
 * O CEP está na linha da empresa: "CIDADE UF NNNNN-NNN"
 * O label "ENDERECO DO IMOVEL" é um cabeçalho de seção, sem valor na mesma linha.
 */
function parsearSamae(T) {
    // Nome: "TITULAR:" ou "PROPRIETARIO:" — parar na primeira \n para não duplicar
    let nome = "";
    const mTit = T.match(/(?:TITULAR|PROPRIETARIO)[:\s]+([A-Z][A-Z .]{5,55})(?=\n)/);
    if (mTit) nome = mTit[1].trim();
    if (!nome) nome = extrairNome(T);

    let ruaExtr = "", numeroExtr = "", complementoExtr = "", bairroExtr = "", cidadeExtr = "";

    // Endereço: linha com número de inscrição (NNN.NNN.NNN.NNNN.NNN) seguido do logradouro
    const mAddr = T.match(/\d{3}(?:\.\d+){4}\s+(.+?)(?:\n|$)/);
    if (mAddr) {
        let addrLine = mAddr[1].trim();

        // Separar bairro/cidade pelo " - "
        const dashIdx = addrLine.search(/\s+-\s+/);
        if (dashIdx > 0) {
            bairroExtr = addrLine.substring(dashIdx).replace(/^\s*-\s*/, "").trim();
            addrLine = addrLine.substring(0, dashIdx).trim();
        }

        // Extrair número: ", NUM 1478" ou ", 1478"
        const mNum = addrLine.match(/,?\s*NUM\s+(\d{1,6}[A-Z]?)\s*(.*)$/) ||
                     addrLine.match(/,\s*(\d{1,6}[A-Z]?)\s*(.*)$/);
        if (mNum) {
            numeroExtr = mNum[1];
            complementoExtr = (mNum[2] || "").trim();
            addrLine = addrLine.substring(0, addrLine.lastIndexOf(mNum[0])).replace(/,\s*$/, "").trim();
        }

        // Remover prefixo de inscrição caso tenha sobrado
        addrLine = addrLine.replace(/^\d[\d.]*\s+/, "").trim();
        ruaExtr = addrLine;
    }

    // CEP e cidade: busca "CITY UF NNNNN-NNN" evitando capturar números de documento
    let cepRaw = "";
    const mCepAfterUF = T.match(/\b([A-Z]{2})\s+(\d{5})-(\d{3})\b/);
    if (mCepAfterUF) {
        cepRaw = mCepAfterUF[2] + mCepAfterUF[3];
        const idxMatch = T.indexOf(mCepAfterUF[0]);
        const lineStart = T.lastIndexOf('\n', idxMatch) + 1;
        const beforeUF = T.substring(lineStart, idxMatch).trim();
        cidadeExtr = beforeUF; // ex: "BALNEARIO RINCAO"
    } else {
        cepRaw = extrairCep(T);
    }

    // Limpar cidade do final do bairro (ex: "PRAIA DO RINCAO BALNEARIO" → "PRAIA DO RINCAO")
    if (cidadeExtr && bairroExtr) {
        const firstCityWord = cidadeExtr.split(' ')[0];
        if (bairroExtr.endsWith(' ' + firstCityWord)) {
            bairroExtr = bairroExtr.substring(0, bairroExtr.lastIndexOf(' ' + firstCityWord)).trim();
        }
    }

    return { nome, ruaExtr, numeroExtr, complementoExtr, bairroExtr, cidadeExtr,
             cepFormatado: formatarCep(cepRaw), edificioExtr: "", loteamentoExtr: "" };
}

/**
 * COOPERALIANÇA
 * O endereço do cliente aparece logo após o nome, sem label "ENDERECO:".
 * Bairro e cidade estão no formato "BAIRRO / CIDADE-UF".
 * CEP pode ter espaço no meio: "88 836-000".
 */
function parsearCooperalianca(T) {
    const nome = extrairNome(T);
    let ruaExtr = "", numeroExtr = "", complementoExtr = "", bairroExtr = "", cidadeExtr = "";

    // Endereço do cliente: primeira linha com tipo de logradouro que aparece APÓS o nome
    // (evita capturar a rua da empresa, que vem antes do nome no texto)
    if (nome) {
        const idxNome = T.indexOf(nome);
        if (idxNome >= 0) {
            const aposNome = T.substring(idxNome + nome.length);
            const mEnd = aposNome.match(/\n([A-Z]{2,10}\.?\s+[^\n]{5,150})/);
            if (mEnd) {
                const p = parsearLinhaEndereco(mEnd[1].trim());
                ruaExtr = p.ruaExtr; numeroExtr = p.numeroExtr; complementoExtr = p.complementoExtr;
            }
        }
    }

    // Bairro / Cidade-UF: "RINCAO ZONA SUL / BALNEARIO RINCAO-SC"
    const mBC = T.match(/([A-Z][A-Z\s]+?)\s*\/\s*([A-Z][A-Z\s]+?)-([A-Z]{2})\b/);
    if (mBC) {
        bairroExtr = mBC[1].trim();
        cidadeExtr = mBC[2].trim();
    }

    // CEP: "CEP: 88 836-000" — dois dígitos separados por espaço antes do hífen
    const mCep = T.match(/CEP[:\s]+(\d{2})\s*(\d{3})-(\d{3})/);
    const cepRaw = mCep ? mCep[1] + mCep[2] + mCep[3] : extrairCep(T);

    return { nome, ruaExtr, numeroExtr, complementoExtr, bairroExtr, cidadeExtr,
             cepFormatado: formatarCep(cepRaw), edificioExtr: "", loteamentoExtr: "" };
}

/**
 * Parser genérico — fallback para qualquer comprovante não identificado.
 * Combina todas as estratégias disponíveis.
 */
function parsearGenerico(T) {
    // Usa o parser de energia genérica como base (mais abrangente)
    const resultado = parsearEnergiaGenerica(T);

    // Se não extraiu rua ainda, tenta linha começando por tipo de logradouro
    if (!resultado.ruaExtr) {
        const TIPOS = 'RUA|AVENIDA|AV|TRAVESSA|TV|ALAMEDA|AL|ESTRADA|RODOVIA|ROD|PRACA|PCA|LARGO|VIELA|SERVIDAO|CAMINHO|LINHA|QUADRA';
        const tiposRx = new RegExp(`^(${TIPOS})\\.?\\s+(.+)$`);
        for (const linha of T.split('\n').map(l => l.trim())) {
            if (tiposRx.test(linha)) {
                const p = parsearLinhaEndereco(linha);
                resultado.ruaExtr = p.ruaExtr;
                resultado.numeroExtr = p.numeroExtr || resultado.numeroExtr;
                resultado.complementoExtr = p.complementoExtr || resultado.complementoExtr;
                if (!resultado.bairroExtr) resultado.bairroExtr = p.bairroExtr;
                break;
            }
        }
    }

    return resultado;
}

/**
 * Dispatcher — detecta o tipo de comprovante e chama o parser adequado.
 */
function parsearVivo(T) {
    // Nome: bloco após o header da Telefônica — primeira linha em maiúsculas após "CNPJ"
    let nome = "";
    const mNome = T.match(/CNPJ[^\n]*\n([A-Z][A-Z\s.]{5,60})(?=\n)/);
    if (mNome) nome = mNome[1].trim();
    if (!nome) nome = extrairNome(T);

    let ruaExtr = "", numeroExtr = "", complementoExtr = "", bairroExtr = "", cidadeExtr = "";

    // O endereço fica nas 3 linhas após o nome:
    // Linha 1: "R GUILHERMINA DA SILVA 400"  (rua + número)
    // Linha 2: "LARANJINHA"                  (bairro)
    // Linha 3: "88818-677 CRICIUMA - SC"     (cep cidade-uf)
    if (nome) {
        const idxNome = T.indexOf(nome);
        if (idxNome >= 0) {
            const aposNome = T.substring(idxNome + nome.length).trimStart();
            const linhas = aposNome.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            if (linhas.length >= 1) {
                const p = parsearLinhaEndereco(linhas[0]);
                ruaExtr     = p.ruaExtr     || linhas[0].replace(/\s+\d{1,6}[A-Z]?\s*$/, "").trim();
                numeroExtr  = p.numeroExtr  || (linhas[0].match(/\s+(\d{1,6}[A-Z]?)\s*$/) || [])[1] || "";
                complementoExtr = p.complementoExtr || "";
            }
            if (linhas.length >= 2 && !/^\d{5}/.test(linhas[1])) {
                bairroExtr = linhas[1];
            }
            // Linha com CEP: "88818-677 CRICIUMA - SC" ou "88818-677 CRICIUMA-SC"
            const linhaCep = linhas.find(l => /^\d{5}-?\d{3}/.test(l));
            if (linhaCep) {
                const mCidUF = linhaCep.match(/^\d{5}-?\d{3}\s+([A-Z][A-Z\s]+?)\s*[-/]\s*[A-Z]{2}\b/);
                if (mCidUF) cidadeExtr = mCidUF[1].trim();
                if (!bairroExtr) {
                    // Se bairro não foi capturado, tenta pegar da linha antes do CEP
                    const idxCep = linhas.indexOf(linhaCep);
                    if (idxCep > 1) bairroExtr = linhas[idxCep - 1];
                }
            }
        }
    }

    return {
        nome, ruaExtr, numeroExtr, complementoExtr, bairroExtr, cidadeExtr,
        cepFormatado: formatarCep(extrairCep(T)),
        edificioExtr: "", loteamentoExtr: ""
    };
}

/**
 * CONASA / AGUAS DE ITAPEMA
 * Layout: empresa no topo, depois bloco do cliente ("VIA DO CONTRIBUINTE")
 * com 3 linhas: rua+num / bairro / cidade+UF+CEP.
 * Nome confiável: "NOME: FULANO" no rodapé do boleto.
 */
function parsearConasa(T) {
    // Nome: label no rodapé é o mais confiável
    let nome = "";
    const mNomeLabel = T.match(/\bNOME:\s*([A-Z][A-Z\s.]{5,60})(?=\n|DIGITO|MATRICULA|$)/);
    if (mNomeLabel) nome = mNomeLabel[1].trim();
    if (!nome) nome = extrairNome(T);

    let ruaExtr = "", numeroExtr = "", complementoExtr = "", bairroExtr = "", cidadeExtr = "", cepFormatado = "";

    // Bloco do cliente após "VIA DO CONTRIBUINTE" — 3 linhas: rua+num, bairro, cidade+cep
    const mBloco = T.match(/VIA DO CONTRIBUINTE\s*\n([^\n]+)\n([^\n]+)\n([^\n]+)/);
    if (mBloco) {
        const linha1 = mBloco[1].trim(); // ex: "R. 0126, 83"
        const linha2 = mBloco[2].trim(); // ex: "CENTRO"
        const linha3 = mBloco[3].trim(); // ex: "ITAPEMA SC CEP: 88220-000"

        const p = parsearLinhaEndereco(linha1);
        ruaExtr = p.ruaExtr;
        numeroExtr = p.numeroExtr;
        complementoExtr = p.complementoExtr;

        // Bairro: linha 2 se não contiver CEP
        if (!/\d{5}/.test(linha2) && linha2.length > 1) bairroExtr = linha2;

        // Cidade: "ITAPEMA SC CEP: 88220-000" → "ITAPEMA"
        const mCid = linha3.match(/^([A-Z][A-Z\s]+?)\s+[A-Z]{2}\s+(?:CEP[:\s]*)?\d/);
        if (mCid) cidadeExtr = mCid[1].trim();

        // CEP da linha 3
        const mCep = linha3.match(/(\d{5}-?\d{3})/);
        if (mCep) cepFormatado = formatarCep(mCep[1].replace('-', ''));
    }

    if (!cepFormatado) cepFormatado = formatarCep(extrairCep(T));

    return { nome, ruaExtr, numeroExtr, complementoExtr, bairroExtr, cidadeExtr, cepFormatado, edificioExtr: "", loteamentoExtr: "" };
}

function parsearComprovante(T) {
    if (T.includes("CELESC"))         return parsearCelesc(T);
    if (T.includes("COOPERALIANCA"))  return parsearCooperalianca(T);
    if (T.includes("SAMAE"))          return parsearSamae(T);
    if (T.includes("CONASA") ||
        T.includes("AGUAS DE ITAPEMA") ||
        T.includes("AGUASDEITAPEMA")) return parsearConasa(T);
    if (T.includes("CASAN") ||
        T.includes("SABESP") ||
        T.includes("SANEPAR") ||
        T.includes("COPASA") ||
        T.includes("CEDAE"))          return parsearSaneamento(T);
    if (T.includes("ENEL") ||
        T.includes("CPFL") ||
        T.includes("COPEL") ||
        T.includes("EQUATORIAL") ||
        T.includes("ENERGISA") ||
        T.includes("COELBA") ||
        T.includes("LIGHT"))          return parsearEnergiaGenerica(T);
    if (T.includes("TELEFONICA") ||
        T.includes("VIVO"))           return parsearVivo(T);
    return parsearGenerico(T);
}

/**
 * Busca a correspondência mais próxima de uma cidade em database.municipios
 */
async function buscarMunicipioDB(nomeCidade) {
    if (!nomeCidade) return null;
    try {
        const { rows } = await pool.query(`
            SELECT id_municipios, nm_municipio,
                   similarity(unaccent(nm_municipio), unaccent($1)) AS score
            FROM database.municipios
            WHERE unaccent(nm_municipio) % unaccent($1)
               OR unaccent(nm_municipio) ILIKE unaccent('%' || $1 || '%')
            ORDER BY score DESC LIMIT 1
        `, [nomeCidade]);
        return (rows.length > 0 && rows[0].score > 0.2) ? rows[0] : null;
    } catch (e) {
        console.error("[OCR] Erro ao buscar município:", e.message);
        return null;
    }
}

/**
 * Retorna o id_municipios configurado em master.dados_gerais
 */
async function buscarIdMunicipioSede() {
    try {
        const { rows } = await pool.query(`SELECT id_municipios FROM master.dados_gerais LIMIT 1`);
        return rows[0]?.id_municipios ?? null;
    } catch (e) {
        console.error("[OCR] Erro ao buscar sede:", e.message);
        return null;
    }
}

/**
 * Busca loteamento mais similar em database.loteamentos
 */
async function buscarLoteamentoDB(nome) {
    if (!nome) return null;
    try {
        const { rows } = await pool.query(`
            SELECT id_loteamentos, ds_loteamento,
                   similarity(unaccent(ds_loteamento), unaccent($1)) AS score
            FROM database.loteamentos
            WHERE unaccent(ds_loteamento) % unaccent($1)
               OR unaccent(ds_loteamento) ILIKE unaccent('%' || $1 || '%')
            ORDER BY score DESC LIMIT 1
        `, [nome]);
        return (rows.length > 0 && rows[0].score > 0.25) ? rows[0] : null;
    } catch (e) {
        console.error("[OCR] Erro ao buscar loteamento:", e.message);
        return null;
    }
}

/**
 * Busca edifício mais similar em database.edificios
 */
async function buscarEdificioDB(nome) {
    if (!nome) return null;
    try {
        const { rows } = await pool.query(`
            SELECT id_edificios, ds_edificio,
                   similarity(unaccent(ds_edificio), unaccent($1)) AS score
            FROM database.edificios
            WHERE unaccent(ds_edificio) % unaccent($1)
               OR unaccent(ds_edificio) ILIKE unaccent('%' || $1 || '%')
            ORDER BY score DESC LIMIT 1
        `, [nome]);
        return (rows.length > 0 && rows[0].score > 0.25) ? rows[0] : null;
    } catch (e) {
        console.error("[OCR] Erro ao buscar edifício:", e.message);
        return null;
    }
}

/**
 * Busca logradouro mais similar em database.logradouros
 */
async function buscarLogradouroDB(nome) {
    if (!nome) return null;
    try {
        const { rows } = await pool.query(`
            SELECT l.id_logradouros, l.nm_logradouro, b.nm_bairro AS nm_bairro_padrao, b.id_bairros AS id_bairros_padrao,
                   similarity(unaccent(l.nm_logradouro), unaccent($1)) AS score
            FROM database.logradouros l
            LEFT JOIN database.bairros b ON b.id_bairros = l.id_bairros
            WHERE unaccent(l.nm_logradouro) % unaccent($1)
               OR unaccent(l.nm_logradouro) ILIKE unaccent('%' || $1 || '%')
            ORDER BY score DESC LIMIT 1
        `, [nome]);
        return (rows.length > 0 && rows[0].score > 0.25) ? rows[0] : null;
    } catch (e) {
        console.error("[OCR] Erro ao buscar logradouro:", e.message);
        return null;
    }
}

/**
 * Busca bairro mais similar em database.bairros
 */
async function buscarBairroDB(nome) {
    if (!nome) return null;
    try {
        const { rows } = await pool.query(`
            SELECT id_bairros, nm_bairro,
                   similarity(unaccent(nm_bairro), unaccent($1)) AS score
            FROM database.bairros
            WHERE unaccent(nm_bairro) % unaccent($1)
               OR unaccent(nm_bairro) ILIKE unaccent('%' || $1 || '%')
            ORDER BY score DESC LIMIT 1
        `, [nome]);
        return (rows.length > 0 && rows[0].score > 0.25) ? rows[0] : null;
    } catch (e) {
        console.error("[OCR] Erro ao buscar bairro:", e.message);
        return null;
    }
}

/**
 * Processa o comprovante via OCR (Google Vision) e enriquece com dados do banco
 */
const processarComprovante = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo enviado." });

        const isPdf = req.file.mimetype === 'application/pdf';
        const textoBruto = await extrairTextoDocumento(req.file.buffer, isPdf);

        console.log("--- TEXTO OCR CAPTURADO ---");
        console.log(textoBruto);
        console.log("---------------------------");

        if (!textoBruto || textoBruto.trim().length < 5) {
            return res.status(422).json({ erro: "Não foi possível extrair dados legíveis do documento." });
        }

        // ── 1. Dispatcher de parsers por tipo de comprovante ─────────────────
        const T = norm(textoBruto);
        const { nome, ruaExtr, numeroExtr, complementoExtr, bairroExtr, cidadeExtr, cepFormatado, edificioExtr, loteamentoExtr } = parsearComprovante(T);

        // ── 2. Resolver cidade no banco ──────────────────────────────────────
        const municipioMatch = await buscarMunicipioDB(cidadeExtr);
        const cidadeOficial = municipioMatch ? municipioMatch.nm_municipio : cidadeExtr;
        const idMunicipioEncontrado = municipioMatch ? municipioMatch.id_municipios : null;

        // ── 3. Verificar se é o mesmo município da sede ──────────────────────
        const idSede = await buscarIdMunicipioSede();
        const isMesmoMunicipio = idSede !== null && idSede === idMunicipioEncontrado;

        // ── 4. Resolver logradouro, bairro, loteamento e edifício (só se mesmo município) ──
        let ruaOficial = ruaExtr;
        let bairroOficial = bairroExtr;
        let loteamentoOficial = loteamentoExtr;
        let edificioOficial = edificioExtr;
        let logradouroMatchFound = false;
        let bairroMatchFound = false;
        let idLogradouros = null;
        let idBairros = null;
        let idLoteamentos = null;
        let idEdificios = null;

        if (isMesmoMunicipio) {
            const logradouroMatch = await buscarLogradouroDB(ruaExtr);
            if (logradouroMatch) {
                ruaOficial = logradouroMatch.nm_logradouro;
                idLogradouros = logradouroMatch.id_logradouros;
                logradouroMatchFound = true;
            }

            // Tenta localizar bairro pela extração OCR
            const bairroExtracaoCurta = !bairroExtr || bairroExtr.trim().length < 4;
            const bairroMatch = !bairroExtracaoCurta ? await buscarBairroDB(bairroExtr) : null;

            if (bairroMatch) {
                bairroOficial = bairroMatch.nm_bairro;
                idBairros = bairroMatch.id_bairros;
                bairroMatchFound = true;
            } else if (logradouroMatch?.nm_bairro_padrao) {
                // Fallback: bairro padrão associado ao logradouro no banco
                bairroOficial = logradouroMatch.nm_bairro_padrao;
                idBairros = logradouroMatch.id_bairros_padrao ?? null;
                bairroMatchFound = true;
            }

            if (loteamentoExtr) {
                const loteamentoMatch = await buscarLoteamentoDB(loteamentoExtr);
                if (loteamentoMatch) {
                    loteamentoOficial = loteamentoMatch.ds_loteamento;
                    idLoteamentos = loteamentoMatch.id_loteamentos;
                }
            }

            if (edificioExtr) {
                const edificioMatch = await buscarEdificioDB(edificioExtr);
                if (edificioMatch) {
                    edificioOficial = edificioMatch.ds_edificio;
                    idEdificios = edificioMatch.id_edificios;
                }
            }
        }
        // Se outro município: deixa os campos com o valor extraído para edição manual

        // ── 5. Definir flag de qualidade da extração ─────────────────────────
        // 'N' = extração falhou em campo crítico (nome, logradouro ou bairro no mesmo município)
        let st_extracao = 'S';
        if (!nome) {
            st_extracao = 'N';
        } else if (isMesmoMunicipio && (!logradouroMatchFound || !bairroMatchFound)) {
            st_extracao = 'N';
        }

        // ── 6. Retorno ───────────────────────────────────────────────────────
        return res.json({
            nm_contribuinte:     nome,
            nr_cpf_atual:        "",
            nr_cep_atual:        cepFormatado,
            nm_rua_extr:         ruaExtr,
            nm_rua_atual:        ruaOficial,
            ds_numero_extr:      numeroExtr,
            ds_numero_atual:     numeroExtr,
            ds_bairro_extr:      bairroExtr,
            ds_bairro_atual:     bairroOficial,
            ds_cidade_extr:      cidadeExtr,
            ds_cidade_atual:     cidadeOficial,
            nr_cep_extr:         cepFormatado,
            ds_loteamento_extr:  loteamentoExtr,
            ds_loteamento_atual: loteamentoOficial,
            ds_edificio_extr:    edificioExtr,
            ds_edificio_atual:   edificioOficial,
            id_logradouros:      idLogradouros,
            id_bairros:          idBairros,
            id_loteamentos:      idLoteamentos,
            id_edificios:        idEdificios,
            id_municipioatual:   idMunicipioEncontrado,
            ds_complemento_extr: complementoExtr,
            ds_complemento_atual: complementoExtr,
            ds_obs: `Extraído via OCR (${isPdf ? 'PDF' : 'Imagem'})`,
            isMesmoMunicipio,
            st_extracao,
            st_rua_extr:    isMesmoMunicipio ? (logradouroMatchFound ? 'S' : 'N') : 'S',
            st_bairro_extr: isMesmoMunicipio ? (bairroMatchFound    ? 'S' : 'N') : 'S'
        });

    } catch (error) {
        console.error("Erro no Controller OCR:", error);
        return res.status(500).json({ erro: "Erro interno no OCR." });
    }
};

const salvarDadosContribuinte = async (req, res) => {
    console.log("--- DEBUG: INÍCIO DO SALVAMENTO ---");
    try {
        console.log("Arquivo recebido:", req.file ? req.file.originalname : "NENHUM ARQUIVO");

        if (!req.body.dados) {
            console.error("ERRO: req.body.dados está vazio!");
            return res.status(400).json({ erro: "Dados ausentes no corpo da requisição." });        
        }
        
        // CORREÇÃO: Extraindo dados do FormData e arquivo do buffer
        if (!req.body.dados) return res.status(400).json({ erro: "Dados ausentes." });
        
        const dados = JSON.parse(req.body.dados);
        console.log("Dados parseados com sucesso para o contribuinte:", dados.nm_contribuinte);
        
        const arquivoBinario = req.file ? req.file.buffer : null;
        const nomeArquivoOriginal = req.file ? req.file.originalname : null;

        if (dados.cd_contribuinte == null) return res.status(400).json({ erro: "Código obrigatório." });

        console.log("Chamando atualizarContribuinte no Model...");
        const resultado = await atualizarContribuinte(dados, arquivoBinario, nomeArquivoOriginal);

        console.log("--- DEBUG: SALVO COM SUCESSO ---");
        return res.json({
            mensagem: "Sucesso!",
            nr_protocolo: resultado.nr_protocolo,
            nr_exercicio: resultado.nr_exercicio
        });
    } catch (error) {
        console.error("--- 🚨 ERRO CRÍTICO NO CONTROLLER 🚨 ---");
        console.error("Mensagem:", error.message);
        console.error("Erro salvar:", error);
       return res.status(500).json({ 
            erro: "Erro interno no servidor.", 
            detalhes: error.message 
        });
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

const listarHistoricoPedidos = async (req, res) => {
    const { status, edicao } = req.query;
    const stFiltro = status === "C" ? "C" : "S";

    let sql = `
        SELECT dc.*,
               ua.nm_usuario AS nm_usuarioaprov,
               ur.nm_usuario AS nm_usuariorepr
        FROM database.dados_contribuintes dc
        LEFT JOIN master.usuarios ua ON ua.id_usuarios = dc.id_usuarioaprov
        LEFT JOIN master.usuarios ur ON ur.id_usuarios = dc.id_usuariorepr
        WHERE dc.st_validado_prefeitura = $1
    `;

    const params = [stFiltro];

    if (edicao && edicao !== "TODOS") {
        sql += ` AND dc.st_editado_manual = $${params.length + 1}`;
        params.push(edicao);
    }

    sql += ` ORDER BY dc.dt_atualizacao DESC, dc.hr_atualizacao DESC`;

    try {
        const { rows } = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error("Erro ao listar histórico:", error);
        res.status(500).json({ erro: "Erro ao carregar histórico." });
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
    const { id, acao, id_usuarioaprov, dt_aprov, hr_aprov, id_usuariorepr, dt_repro, hr_repro } = req.body;
    try {
        const pedidoQuery = await pool.query("SELECT * FROM database.dados_contribuintes WHERE id_dados_contribuintes = $1", [id]);
        if (pedidoQuery.rows.length === 0) return res.status(404).json({ erro: "Não encontrado." });
        const pedido = pedidoQuery.rows[0];

        // Se cd_contribuinte = 0, busca localmente se já existe código Bauhaus para esse CPF
        // (necessário pois a API Bauhaus retorna 500 no GET por CPF mesmo quando o contribuinte existe)
        if ((parseInt(pedido.cd_contribuinte) || 0) === 0 && pedido.nr_cpf_atual) {
            const cpfLimpo = (pedido.nr_cpf_atual || "").replace(/\D/g, "");
            console.log(`[VALIDAR] cd_contribuinte=0, buscando código Bauhaus local para CPF "${cpfLimpo}"`);
            try {
                const localQuery = await pool.query(
                    `SELECT cd_contribuinte
                       FROM database.dados_contribuintes
                      WHERE REGEXP_REPLACE(nr_cpf_atual, '[^0-9]', '', 'g') = $1
                        AND cd_contribuinte > 0
                      ORDER BY dt_atualizacao DESC, hr_atualizacao DESC
                      LIMIT 1`,
                    [cpfLimpo]
                );
                if (localQuery.rows.length > 0) {
                    pedido.cd_contribuinte = localQuery.rows[0].cd_contribuinte;
                    console.log(`[VALIDAR] ✔ Código Bauhaus encontrado localmente: cd_contribuinte=${pedido.cd_contribuinte}`);
                } else {
                    console.log(`[VALIDAR] Nenhum código Bauhaus local encontrado para esse CPF — será feito POST`);
                }
            } catch (e) {
                console.warn("[VALIDAR] Erro na busca local de cd_contribuinte:", e.message);
            }
        }

        console.log(`[VALIDAR] Nome para Bauhaus: "${pedido.nm_contribuinte}" (cd_contribuinte=${pedido.cd_contribuinte})`);

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
            await pool.query(
                `UPDATE database.dados_contribuintes
                 SET st_validado_prefeitura = 'C',
                     id_usuariorepr = $2,
                     dt_repro = $3,
                     hr_repro = $4
                 WHERE id_dados_contribuintes = $1`,
                [id, id_usuariorepr || null, dt_repro || null, hr_repro || null]
            );
            return res.json({ sucesso: true });
        } else {
            // Verifica se a aprovação via API é obrigatória
            const configQuery = await pool.query(`SELECT st_aprovacaoaut FROM master.dados_gerais LIMIT 1`);
            const valorFlag = configQuery.rows[0]?.st_aprovacaoaut;
            console.log(`[VALIDAR] st_aprovacaoaut = '${valorFlag}' | apiObrigatoria = ${valorFlag === 'S'}`);
            const apiObrigatoria = valorFlag === 'S';

            if (apiObrigatoria) {
                // Bloqueante: só aprova se a API retornar sucesso
                const resultadoBauhaus = await sincronizarContribuinteBauhaus(pedido);
                console.log("[BAUHAUS] Resultado:", resultadoBauhaus);

                if (!resultadoBauhaus.sucesso) {
                    const detalhe = typeof resultadoBauhaus.erro === 'object'
                        ? JSON.stringify(resultadoBauhaus.erro)
                        : resultadoBauhaus.erro;
                    return res.status(400).json({
                        erro: `Não foi possível atualizar a API externa antes de efetivar. Verifique a configuração da API e tente novamente.`,
                        detalhe
                    });
                }

                // Salva código Bauhaus para evitar duplicatas em aprovações futuras
                if (["incluido", "atualizado_via_cpf"].includes(resultadoBauhaus.acao) && resultadoBauhaus.codigo > 0) {
                    try {
                        await pool.query(
                            `UPDATE database.dados_contribuintes SET cd_contribuinte = $1 WHERE id_dados_contribuintes = $2`,
                            [resultadoBauhaus.codigo, id]
                        );
                        console.log(`[BAUHAUS] cd_contribuinte=${resultadoBauhaus.codigo} salvo em dados_contribuintes (acao=${resultadoBauhaus.acao})`);
                    } catch (e) {
                        console.warn("[BAUHAUS] Falha ao salvar cd_contribuinte:", e.message);
                    }
                }
            }

            await pool.query(
                `UPDATE database.dados_contribuintes
                 SET st_validado_prefeitura = 'S',
                     id_usuarioaprov = $2,
                     dt_aprov = $3,
                     hr_aprov = $4
                 WHERE id_dados_contribuintes = $1`,
                [id, id_usuarioaprov || null, dt_aprov || null, hr_aprov || null]
            );

            // Se a API não é obrigatória, dispara em background mesmo assim (best-effort)
            if (!apiObrigatoria) {
                sincronizarContribuinteBauhaus(pedido)
                    .then(r => {
                        console.log("[BAUHAUS] Resultado:", r);
                        // Salva código Bauhaus para evitar duplicatas futuras
                        if (["incluido", "atualizado_via_cpf"].includes(r.acao) && r.codigo > 0) {
                            pool.query(
                                `UPDATE database.dados_contribuintes SET cd_contribuinte = $1 WHERE id_dados_contribuintes = $2`,
                                [r.codigo, id]
                            ).then(() => console.log(`[BAUHAUS] cd_contribuinte=${r.codigo} salvo (background)`))
                             .catch(e => console.warn("[BAUHAUS] Falha ao salvar cd_contribuinte (background):", e.message));
                        }
                    })
                    .catch(e => console.error("[BAUHAUS] Falha inesperada:", e.message));
            }

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

const downloadComprovante = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            `SELECT ds_comprovante, nm_arquivo_original FROM database.dados_contribuintes WHERE id_dados_contribuintes = $1`,
            [id]
        );
        if (!rows.length || !rows[0].ds_comprovante) {
            return res.status(404).json({ erro: "Arquivo não encontrado." });
        }
        const { ds_comprovante, nm_arquivo_original } = rows[0];
        const nomeArquivo = nm_arquivo_original || `comprovante_${id}`;
        const ext = nomeArquivo.split('.').pop().toLowerCase();
        const mimeTypes = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
        res.send(ds_comprovante);
    } catch (error) {
        console.error("Erro ao baixar comprovante:", error);
        res.status(500).json({ erro: "Erro ao recuperar arquivo." });
    }
};

const listarComprovantesRecusados = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id_dados_contribuintes, nr_protocolo, nr_exercicio, nm_contribuinte,
                   nm_rua_atual, nm_rua_extr, st_rua_extr,
                   ds_bairro_atual, ds_bairro_extr, st_bairro_extr,
                   ds_cidade_atual, ds_cidade_extr, nr_cep_atual,
                   st_validado_prefeitura, dt_atualizacao, hr_atualizacao,
                   nm_arquivo_original
            FROM database.dados_contribuintes
            WHERE st_extracao = 'N'
            ORDER BY dt_atualizacao DESC, hr_atualizacao DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error("Erro ao listar comprovantes recusados:", error);
        res.status(500).json({ erro: "Erro ao carregar lista." });
    }
};

const listarLoteamentos = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id_loteamentos, cd_loteamento, ds_loteamento FROM database.loteamentos ORDER BY ds_loteamento`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ erro: "Erro ao listar loteamentos." });
    }
};

const listarEdificios = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id_edificios, cd_edificio, ds_edificio FROM database.edificios ORDER BY ds_edificio`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ erro: "Erro ao listar edifícios." });
    }
};

module.exports = {
    salvarDadosContribuinte,
    processarComprovante,
    listarPedidosPendentes,
    listarHistoricoPedidos,
    validarPedidoPrefeitura,
    validarCpfReceita,
    verificarStatusImovel,
    enviarComprovante,
    listarComprovantesRecusados,
    downloadComprovante,
    listarLoteamentos,
    listarEdificios
};