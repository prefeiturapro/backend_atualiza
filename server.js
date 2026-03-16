require("dotenv").config();

const app = require("./index");          // Importa seu app Express
const pool = require("./src/models/connection");  // Importa a conexão

const PORT = process.env.PORT || 3002;

app.listen(PORT, async () => {
  console.log(`🚀 API rodando na porta ${PORT}`);

  try {
    const { rows } = await pool.query("SELECT 1 AS ok");
    if (rows?.[0]?.ok === 1) {
      console.log("🟢 Conexão ao Postgres feita com sucesso!");
    }
  } catch (err) {
    console.error("❌ Erro ao conectar ao Postgres:", err);
  }
});