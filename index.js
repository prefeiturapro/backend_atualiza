require("dotenv").config();
const express = require("express");

const cors = require("cors");


const app = express();

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));


app.use(cors({
    origin: '*' // Depois de ter o domínio, troque '*' pelo 'https://seusite.com.br'
}));


// === ROTAS ===
const rotaEncomenda     = require("./src/routes/encomendas"   );
const rotaEmpregado     = require("./src/routes/empregados"   );
const rotaResponsavel   = require("./src/routes/responsavel"  );
const rotaUsuario       = require("./src/routes/usuarios"     );
const rotaContribuinte  = require("./src/routes/contribuintes");

app.use("/encomendas"   , rotaEncomenda    );
app.use("/empregados"   , rotaEmpregado    );
app.use("/responsavel"  , rotaResponsavel  );
app.use("/usuarios"     , rotaUsuario      );
app.use("/contribuintes", rotaContribuinte );

const porta = 3001;

app.listen(porta, () => {
  console.log(`Servidor rodando na porta ${porta}`);
});

module.exports = app;