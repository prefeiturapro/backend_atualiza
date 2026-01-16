const pool = require("./connection");
const { buscaResponsavel } = require("./responsavel"); 
const { getIDContribuinte } = require("./contribuintes");


// Lista de colunas dinâmicas (Produtos)
const listaDeProdutos = [
    //salgadinhos de festa
    "vl_risfrango","vl_rispresque","vl_coxinha","vl_pastelcar","vl_pastelban",
    "vl_salsic","vl_quibe","vl_bolquei",

    //, "ds_obssalg"
    
    //tortas
    "ds_decoracao", "ds_recheio","vl_tamanho","ds_topo","ds_papel","ds_gliter","ds_redonda",
    "ds_quadrada",  "ds_menino","ds_menina","ds_mulher", "ds_homem", "ds_po", "ds_tabuleiro",
    "ds_cafeboard","ds_obstortas",

    //bolos
    "vl_bolpamon", "vl_bolmilho","vl_bolchoc","vl_bolintban","vl_bolmult","vl_boltoic",
    "vl_bolceno","vl_bolamend", "vl_bolbrownie","vl_bolprest","vl_bolbanana","vl_bolaveia",
    "vl_bollaranj","vl_bolcuca", "ds_obsbolo",
    
    //diversos
    "vl_assadfra","vl_assadcar","vl_assadcho", "vl_sandfr","vl_sandfra","vl_doccam",
    "vl_barc","vl_paofr","vl_paodoc", "vl_cricri","vl_tortsa","vl_maeben","vl_outros",
    "vl_cookie", "vl_paoque","vl_paocach","vl_paoham","vl_marr","vl_sonsere",
    "vl_sonavel","vl_sondoc","vl_sonbal", "vl_cava","vl_empad","vl_quich",
    "vl_empagr","vl_cacho","ds_obsdiv","ds_bolomilh","vl_sandfrint", "vl_mnipizza",
    "vl_pudin","vl_pizza", "ds_fototorta", "vl_paominix", "vl_pastmil", "vl_rispalm",
    
    //minis
    "ds_obsminis", "vl_mindonu","vl_minempa","vl_miniquic", "vl_minibaufr","vl_minibaupr","vl_minibauca",
    "vl_minicook","vl_minix","vl_minicacho", "vl_minipaoca","vl_minipaofr","vl_minisonre",
    "vl_minisoave"
];

// --- GRAVAR (INSERT) ---
const gravaEncomenda = async (dadosEncomenda) => {

    let idClienteFinal = 0;
    
    if (dadosEncomenda.id_contribuintes && dadosEncomenda.id_contribuintes !== '0') {
        idClienteFinal = dadosEncomenda.id_contribuintes;
    } 
    else if (dadosEncomenda.nr_telefone) {
        try {
            console.log(`[MODEL] Buscando ID para telefone: ${dadosEncomenda.nr_telefone}`);
            const resultado = await getIDContribuinte(dadosEncomenda.nr_telefone);
            
            if (resultado && resultado.length > 0) {
                idClienteFinal = resultado[0].id_contribuintes;
                console.log(`[MODEL] Cliente encontrado! ID: ${idClienteFinal}`);
            } else {
                console.log(`[MODEL] Cliente não encontrado para este telefone. Usando ID 0.`);
            }
        } catch (err) {
            console.error("Erro ao buscar ID do contribuinte:", err);
            // Em caso de erro na busca, mantém 0 para não travar a venda
        }
    }

    const colunas = ['id_usuarios', 'id_contribuintes', 'nm_nomefantasia', 'hr_horaenc', 'dt_abertura', 'st_status', 'observacao', 'nr_telefone'];
    
    const valores = [
        dadosEncomenda.id_usuarios || 1,
        idClienteFinal, 
        dadosEncomenda.nm_nomefantasia, 
        dadosEncomenda.hr_horaenc,      
        dadosEncomenda.dt_abertura,     
        dadosEncomenda.st_status || '1',
        dadosEncomenda.observacao || '',
        dadosEncomenda.nr_telefone || ''
    ];
    
    const placeholders = ['$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8'];

    listaDeProdutos.forEach((campo) => {
        const valor = dadosEncomenda[campo];
        if (valor !== undefined && valor !== "" && valor !== null && valor !== 0 && valor !== "0") {
            colunas.push(campo);           
            valores.push(valor);           
            placeholders.push(`$${valores.length}`); 
        }
    });

    const sql = `
        INSERT INTO bauhaus.ordemservicos (${colunas.join(', ')}) 
        VALUES (${placeholders.join(', ')}) 
        RETURNING id_ordemservicos
    `;

    try {
        const { rows } = await pool.query(sql, valores);
        console.log(`Nova encomenda gravada: ID ${rows[0].id_ordemservicos}`);
        return rows[0];
    } catch (error) {
        console.error("Erro ao gravar encomenda:", error);
        throw error;
    }
};

// --- BUSCA ENCOMENDAS (SEGURA E OTIMIZADA) ---
const buscaEncomendas = async () => {
    console.log(">>> PROCESSANDO PAINEL DE ENCOMENDAS NOVO (MODO ECONÔMICO) <<<");

    // 1. MÁGICA DO JS: Gera a lista de colunas dinamicamente, EXCLUINDO A FOTO
    // Isso evita erro de digitação e garante que a foto pesada não venha.
    const colunasSemFoto = listaDeProdutos
        .filter(coluna => coluna !== 'ds_fototorta') // Remove a foto
        .join(', '); // Junta tudo com vírgula

    const sql = `
        SELECT 
            id_ordemservicos, nm_nomefantasia, hr_horaenc, nr_telefone, st_status, dt_abertura,
            TO_CHAR(dt_abertura, 'DD/MM/YYYY') AS dt_formatada, 
            ${colunasSemFoto} 
        FROM relatorios.encomendas 
        WHERE st_status='1' AND dt_abertura=CURRENT_DATE 
        ORDER BY st_status, hr_horaenc ASC
    `;

    try {
        const { rows: encomendas } = await pool.query(sql);

        if (encomendas.length === 0) return [];
    
        console.log(`Encontradas ${encomendas.length} encomendas (LEVES) para processar...`);

        const promessas = encomendas.map(async (encomenda) => {
            
            const controleFlags = {
                inseriuUm: true, inseriuDois: true, inseriuTres: true,
                inseriuQuatro: true, inseriuCinco: true, inseriuSeis: true,
                inseriuSete: true, inseriuOito: true, inseriuNove: true, inseriuDez: true
            };

            const buscasParaFazer = [];
            
            listaDeProdutos.forEach((nomeDoCampo) => {
                const valorDoCampo = encomenda[nomeDoCampo];

                // O JavaScript vai tentar ler 'ds_fototorta', vai dar undefined (pois não veio do banco),
                // e esse IF vai pular ele. Perfeito.
                if (valorDoCampo && parseFloat(valorDoCampo) !== 0) {
                    
                    const buscaProcessada = buscaResponsavel(
                        encomenda.hr_horaenc, 
                        nomeDoCampo,           
                        valorDoCampo,
                        controleFlags
                    ).then((listaResponsaveis) => {
                        
                        if (!listaResponsaveis || listaResponsaveis.length === 0) return [];

                        const apenasValidos = listaResponsaveis.filter(item => item !== null);

                        return apenasValidos.map(item => ({
                            data: encomenda.dt_formatada,  
                            hora: encomenda.hr_horaenc,
                            cliente: encomenda.nm_nomefantasia,
                            // Campos importantes para chave única do React
                            id_ordemservicos: encomenda.id_ordemservicos,
                            st_status: encomenda.st_status,
                            ...item 
                        }));
                    });

                    buscasParaFazer.push(buscaProcessada);
                }
            });

            const resultadosDestaEncomenda = await Promise.all(buscasParaFazer);
            return resultadosDestaEncomenda.flat();
        });

        const resultadosAgrupados = await Promise.all(promessas);
        
        return resultadosAgrupados.flat().filter(item => item !== null);

    } catch (error) {
        console.error("Erro fatal ao processar painel de encomendas:", error);
        throw error;
     }
}

// --- FILTRA ENCOMENDAS (AGORA INTELIGENTE E CORRIGIDA) ---
// Adicionei parâmetros opcionais no final: id_ordemservicos e trazerFoto
const FiltraEncomendas = async (nr_telefone, nm_nomefantasia, hr_horaenc, dt_abertura, id_ordemservicos, trazerFoto = false) => {
    
    // LÓGICA DE COLUNAS: 
    // Se trazerFoto for false, usamos a lista limpa (sem foto). Se for true (detalhes), usamos SELECT * (que inclui a foto).
    let selectClause = "re.*"; // Padrão antigo (pesado, usado apenas quando clicar no card)
    
    // Verifica se trazerFoto é falso (ou string "false" caso venha do JSON)
    if (trazerFoto === false || trazerFoto === "false") {
        
        // Modo LEVE: Monta string com todas as colunas MENOS a foto
        const colunasSemFoto = listaDeProdutos
            .filter(coluna => coluna !== 'ds_fototorta')
            .join(', ');
            
        // CORREÇÃO: Removi 're.id_empregado' pois estava dando erro.
        // Adicionamos apenas as colunas que temos certeza que existem na view.
        selectClause = `
            re.id_ordemservicos, re.id_usuarios, re.id_contribuintes,
            re.nm_nomefantasia, re.nr_telefone, re.hr_horaenc, re.dt_abertura, 
            re.st_status, re.st_producao, re.observacao,
            ${colunasSemFoto}
        `;
    }

    let sql = `
        SELECT 
            ${selectClause}, 
            TO_CHAR(re.dt_abertura, 'DD/MM/YYYY') AS dt_formatada                                        
        FROM relatorios.encomendas re
        LEFT JOIN database.contribuintes c ON c.id_contribuintes = re.id_contribuintes
        WHERE 1=1
    `;

    const valores = []; 
    let contador = 1; 

    // Filtros
    if (nr_telefone && nr_telefone.trim() !== "") {
        sql += ` AND re.nr_telefone = $${contador}`;
        valores.push(nr_telefone);
        contador++;
    }

    if (nm_nomefantasia && nm_nomefantasia.trim() !== "") {
        sql += ` AND re.nm_nomefantasia ILIKE $${contador}`;
        valores.push(`%${nm_nomefantasia}%`);
        contador++;
    }

    if (hr_horaenc && hr_horaenc.trim() !== "") {
        sql += ` AND re.hr_horaenc = $${contador}`;
        valores.push(hr_horaenc);
        contador++;
    }

    if (dt_abertura && dt_abertura.trim() !== "") {
        sql += ` AND re.dt_abertura = $${contador}`;
        valores.push(dt_abertura);
        contador++;
    }

    // NOVO: Filtro por ID (para buscar o detalhe da torta ao clicar)
    if (id_ordemservicos) {
        sql += ` AND re.id_ordemservicos = $${contador}`;
        valores.push(id_ordemservicos);
        contador++;
    }

    sql += ` ORDER BY st_status, re.dt_abertura ASC, re.hr_horaenc ASC`;

    try {
        const { rows } = await pool.query(sql, valores);
        return rows;
    } catch (error) {
        console.error("Erro ao filtrar encomendas:", error);
        throw error;
    }
}


// --- ATUALIZAR (UPDATE) ---
const atualizaEncomenda = async (id, dadosEncomenda) => {
    
    const colunasParaAtualizar = [];
    const valores = [];
    let contador = 1;

    // Campos Fixos
    if (dadosEncomenda.nm_nomefantasia) {
        colunasParaAtualizar.push(`nm_nomefantasia = $${contador}`);
        valores.push(dadosEncomenda.nm_nomefantasia);
        contador++;
    }
    if (dadosEncomenda.hr_horaenc) {
        colunasParaAtualizar.push(`hr_horaenc = $${contador}`);
        valores.push(dadosEncomenda.hr_horaenc);
        contador++;
    }
    if (dadosEncomenda.dt_abertura) {
        colunasParaAtualizar.push(`dt_abertura = $${contador}`);
        valores.push(dadosEncomenda.dt_abertura);
        contador++;
    }
    if (dadosEncomenda.st_status) {
        colunasParaAtualizar.push(`st_status = $${contador}`);
        valores.push(dadosEncomenda.st_status);
        contador++;
    }

    if (dadosEncomenda.observacao !== undefined) {
        colunasParaAtualizar.push(`observacao = $${contador}`);
        valores.push(dadosEncomenda.observacao);
        contador++;
    }
    
    if (dadosEncomenda.id_contribuintes) {
        colunasParaAtualizar.push(`id_contribuintes = $${contador}`);
        valores.push(dadosEncomenda.id_contribuintes);
        contador++;
    }

    // Campos Dinâmicos
    listaDeProdutos.forEach((campo) => {
        const valor = dadosEncomenda[campo];
        
        if (campo === 'ds_fototorta' && !valor) {
            return; 
        }

        if (valor !== undefined) {
            colunasParaAtualizar.push(`${campo} = $${contador}`);
            valores.push(valor);
            contador++;
        }
    });

    if (colunasParaAtualizar.length === 0) {
        return { id_ordemservicos: id };
    }

    valores.push(id);
    
    const sql = `
        UPDATE bauhaus.ordemservicos 
        SET ${colunasParaAtualizar.join(', ')}
        WHERE id_ordemservicos = $${contador} 
        RETURNING id_ordemservicos
    `;

    try {
        const { rows } = await pool.query(sql, valores);
        return rows[0];
    } catch (error) {
        console.error("Erro ao atualizar encomenda:", error);
        throw error;
    }
};

const atualizaStatusProducao = async (id, status) => {
    const { rows } = await pool.query(
        'UPDATE encomendas SET st_producao = $1 WHERE id_encomendas = $2 RETURNING *',
        [status, id]
    );
    return rows[0];
};


module.exports = { 
    buscaEncomendas, 
    gravaEncomenda,
    FiltraEncomendas,
    atualizaEncomenda,
    atualizaStatusProducao
};