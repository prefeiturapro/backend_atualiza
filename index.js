require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path"); 

// Importa a configuração de e-mail para validar a conexão no boot
require('./src/config/mail'); 

const app = express();

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", 'GET,PUT,POST,DELETE');
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// === IMPORTAÇÃO DOS CONTROLLERS / ROTAS ===
const rotaUsuario = require("./src/routes/usuarios");
const rotaDadosImoveis = require("./src/routes/dadosimoveis"); 
const dadosClientesRoutes = require("./src/routes/dadosclientes");
const dadosContribuintesRoutes = require("./src/routes/dadoscontribuintes");
const notificacaoRoutes = require("./src/routes/notificacao"); 
const dadosBairrosRoutes = require("./src/routes/dadosbairros");
const dadosLogradourosRoutes = require("./src/routes/dadoslogradouros"); 
const dadosMunicipiosRoutes = require("./src/routes/dadosmunicipios"); 
const dadosGeraisRoutes = require("./src/routes/dadosgerais");

const { 
    enviarCodigo, 
    validarCodigo, 
    enviarOtpEmail, 
    validarOtpEmail 
} = require('./src/controllers/authController'); 

// === ROTAS DE AUTENTICAÇÃO ===
app.post('/api/auth/enviar-otp', enviarCodigo);
app.post('/api/auth/validar-otp', validarCodigo);
app.post('/api/auth/enviar-otp-email', enviarOtpEmail);
app.post('/api/auth/validar-otp-email', validarOtpEmail);

// === OUTRAS ROTAS ===
app.use("/usuarios", rotaUsuario);
app.use("/dadosimoveis", rotaDadosImoveis); 
app.use("/dadosclientes", dadosClientesRoutes);
app.use("/dadoscontribuintes", dadosContribuintesRoutes);
app.use("/api/notificacao", notificacaoRoutes); 
app.use("/dadosbairros", dadosBairrosRoutes); 
app.use("/dadoslogradouros", dadosLogradourosRoutes); 
app.use("/dadosmunicipios", dadosMunicipiosRoutes); 
app.use("/dadosgerais", dadosGeraisRoutes);

module.exports = app;