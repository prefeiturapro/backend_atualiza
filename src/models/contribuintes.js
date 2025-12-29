const pool = require("./connection");

// Função de busca ajustada para ignorar espaços em branco
async function buscaContribuintes(nr_telefone) {
    // TRIM remove espaços antes e depois, garantindo que ' 48-999 ' vire '48-999'
    const sql = "SELECT * FROM database.contribuintes WHERE TRIM(nr_telefone)=$1";
    
    // removemos espaços do parametro também
    const telefoneLimpo = nr_telefone ? nr_telefone.trim() : "";
    
    const { rows } = await pool.query(sql, [telefoneLimpo]);
    return rows;
}

async function buscaCodContribuinte() {
    const sql = "SELECT COALESCE(MAX(cd_contribuinte), 0) + 1 AS proximo_id FROM database.contribuintes";
    const { rows } = await pool.query(sql);
    return rows[0].proximo_id; 
}

async function getIDContribuinte(nr_telefone) {
    // TRIM remove espaços antes e depois, garantindo que ' 48-999 ' vire '48-999'
    const sql = "SELECT id_contribuintes FROM database.contribuintes WHERE TRIM(nr_telefone)=$1";
    
    // removemos espaços do parametro também
    const telefoneLimpo = nr_telefone ? nr_telefone.trim() : "";
    
    const { rows } = await pool.query(sql, [telefoneLimpo]);
    return rows;
}

const gravaContribuinte = async (dadosContribuinte) => {
    try {
        // --- PASSO 1: VERIFICAR SE JÁ EXISTE (EVITA DUPLICIDADE) ---
        const telefoneParaGravar = dadosContribuinte.nr_telefone.trim();
        
        // Antes de tudo, verifica se esse telefone já está no banco
        const existentes = await buscaContribuintes(telefoneParaGravar);
        
        if (existentes && existentes.length > 0) {
            console.log(`[MODEL] Cliente já existe (ID: ${existentes[0].id_contribuintes}). Retornando o existente.`);
            // Retorna o cliente que já estava lá, sem criar duplicata
            return existentes[0]; 
        }

        // --- PASSO 2: SE NÃO EXISTE, CRIA NOVO ---
        const novoCodigo = await buscaCodContribuinte();

        // 11 Colunas
        const colunas = [
            'nr_telefone', 'nm_nomefantasia', 'nm_razaocomplemento', 
            'ds_email', 'nm_logradouro', 'nm_bairro', 
            'cd_contribuinte','id_logradouros', 'id_bairros',
            'tp_pessoa', 'tp_rua', 'id_municipios'
        ];
        
        const valores = [
            telefoneParaGravar, // Telefone limpo (sem espaços extras)
            dadosContribuinte.nm_nomefantasia.toUpperCase(), // Força maiúsculo para padronizar
            dadosContribuinte.nm_nomefantasia.toUpperCase(), 
            dadosContribuinte.ds_email,     
            dadosContribuinte.nm_logradouro,
            dadosContribuinte.nm_bairro,
            novoCodigo, 
            99, 
            99,
            'F',
            'RUA',
            1 
        ];
        
        // 12 Placeholders
        const placeholders = ['$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8', '$9', '$10', '$11', '$12'];

        const sql = `
            INSERT INTO database.contribuintes (${colunas.join(', ')}) 
            VALUES (${placeholders.join(', ')}) 
            RETURNING id_contribuintes
        `;

        console.log("--------------- GRAVANDO NOVO CLIENTE ---------------");
        console.log("Telefone:", telefoneParaGravar);
        console.log("Nome:", dadosContribuinte.nm_nomefantasia);
        console.log("-----------------------------------------------------");

        const { rows } = await pool.query(sql, valores);
        
        if (rows && rows.length > 0) {
            return rows[0];
        } else {
            throw new Error("Erro ao inserir: Nenhum ID retornado.");
        }

    } catch (error) {
        console.error("Erro ao gravar contribuinte no Model:", error);
        throw error;
    }
}

module.exports = { 
    buscaContribuintes,
    gravaContribuinte,
    getIDContribuinte
}