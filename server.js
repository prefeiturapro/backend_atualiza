require("dotenv").config();
const app = require("./index");
const pool = require("./src/models/connection");

const PORT = process.env.PORT || 3002;

// ÚNICO listen do sistema
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);

    try {
        const { rows } = await pool.query("SELECT 1 AS ok");
        if (rows?.[0]?.ok === 1) {
            console.log("🟢 Conexão ao Postgres feita com sucesso!");
        }
    } catch (err) {
        console.error("❌ Erro ao conectar ao Postgres:", err.message);
    }
});