const { Pool } = require('pg');
require('dotenv').config();

// Pega a string de conexão do arquivo .env
const connectionString = process.env.DATABASE_URL;

// Validação de segurança: se não tiver link, nem tenta iniciar
if (!connectionString) {
    console.error("ERRO CRÍTICO: A variável DATABASE_URL não foi definida no .env");
    process.exit(1);
}

// Configuração da conexão (Blindada para Nuvem/Neon)
const pool = new Pool({ 
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false // Obrigatório para o Neon
    },
    // --- CONFIGURAÇÕES DE ESTABILIDADE ---
    max: 20,                  // Máximo de conexões simultâneas
    idleTimeoutMillis: 30000, // Fecha conexões inativas após 30seg (Vital para o Neon não derrubar a gente)
    connectionTimeoutMillis: 10000, // Se demorar mais de 2s para conectar, desiste (evita travamento)
});

// --- O PULO DO GATO (AIRBAG) ---
// Se o Neon derrubar uma conexão inativa, esse evento captura o erro
// e impede que o seu backend (Node.js) crashe inteiro.
pool.on('error', (err, client) => {
    console.error('Erro inesperado em uma conexão inativa (O sistema segue rodando normalmente)', err);    
});

// Teste rápido ao iniciar
pool.connect()
    .then(client => {
        console.log('✅ Conectado ao Banco de Dados (Neon) com sucesso!');
        client.release(); // Solta a conexão de teste imediatamente
    })
    .catch((err) => console.error('❌ Erro ao conectar ao Banco:', err.message));

module.exports = pool;