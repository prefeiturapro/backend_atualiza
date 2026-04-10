require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const { otpLimiter } = require("./src/middleware/rateLimiters");

// Importa a configuração de e-mail para validar a conexão no boot
require('./src/config/mail');

const app = express();

// ─── SEGURANÇA: HELMET ─────────────────────────────────────────────────────
// Adiciona ~15 headers HTTP de segurança automaticamente
app.use(helmet());

// ─── SEGURANÇA: CORS RESTRITO ──────────────────────────────────────────────
// Defina ALLOWED_ORIGINS no .env (ex: "https://seudominio.com.br,https://admin.seudominio.com.br")
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Permite requisições sem origin (ex: Postman em desenvolvimento, apps mobile)
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origem '${origin}' não permitida pelo CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    credentials: true
}));

// ─── CORPO DA REQUISIÇÃO ───────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── ARQUIVOS ESTÁTICOS ────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── IMPORTAÇÃO DAS ROTAS ──────────────────────────────────────────────────
const rotaUsuario               = require("./src/routes/usuarios");
const rotaDadosImoveis          = require("./src/routes/dadosimoveis");
const dadosClientesRoutes       = require("./src/routes/dadosclientes");
const dadosContribuintesRoutes  = require("./src/routes/dadoscontribuintes");
const notificacaoRoutes         = require("./src/routes/notificacao");
const dadosBairrosRoutes        = require("./src/routes/dadosbairros");
const dadosLogradourosRoutes    = require("./src/routes/dadoslogradouros");
const dadosMunicipiosRoutes     = require("./src/routes/dadosmunicipios");
const dadosGeraisRoutes         = require("./src/routes/dadosgerais");
const dadosFormsRoutes          = require("./src/routes/dadosforms");
const formsUsuariosRoutes       = require("./src/routes/formsUsuarios");
const dashboardRoutes           = require("./src/routes/dashboard");
const comprovantesRecusadosRoutes = require("./src/routes/comprovantesrecusados");

const {
    enviarCodigo,
    validarCodigo,
    enviarOtpEmail,
    validarOtpEmail
} = require('./src/controllers/authController');

// ─── ROTAS DE AUTENTICAÇÃO (com rate limiting) ─────────────────────────────
app.post('/api/auth/enviar-otp',         otpLimiter, enviarCodigo);
app.post('/api/auth/validar-otp',        otpLimiter, validarCodigo);
app.post('/api/auth/enviar-otp-email',   otpLimiter, enviarOtpEmail);
app.post('/api/auth/validar-otp-email',  otpLimiter, validarOtpEmail);

// ─── ROTAS (rate limiters de login/OCR são aplicados dentro dos arquivos de rota) ──
app.use("/usuarios",            rotaUsuario);
app.use("/dadosimoveis",        rotaDadosImoveis);
app.use("/dadosclientes",       dadosClientesRoutes);
app.use("/dadoscontribuintes",  dadosContribuintesRoutes);
app.use("/api/notificacao",     notificacaoRoutes);
app.use("/dadosbairros",        dadosBairrosRoutes);
app.use("/dadoslogradouros",    dadosLogradourosRoutes);
app.use("/dadosmunicipios",     dadosMunicipiosRoutes);
app.use("/dadosgerais",         dadosGeraisRoutes);
app.use("/dadosforms",          dadosFormsRoutes);
app.use("/formsUsuarios",       formsUsuariosRoutes);
app.use("/dashboard",           dashboardRoutes);
app.use("/comprovantesrecusados", comprovantesRecusadosRoutes);

// ─── VERIFICAÇÃO DO SERVIÇO DE E-MAIL ──────────────────────────────────────
const transporter = require('./src/config/mail');
transporter.verify((error) => {
    if (error) {
        console.log("⚠️  Resend aguardando configuração ou com erro.");
    } else {
        console.log("✅ Resend: Sistema de e-mail pronto!");
    }
});

module.exports = app;
