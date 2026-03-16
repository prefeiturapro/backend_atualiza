const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Obrigatório false para 587
  pool: true,    // Mantém a conexão aberta para evitar novos timeouts
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Ignora bloqueios de certificado do Render
    minVersion: "TLSv1.2"
  }
});

// Verificação de segurança
transporter.verify((error, success) => {
  if (error) {
    console.error("[MAIL] Erro de Conexão:", error.message);
  } else {
    console.log("[MAIL] ✅ Conexão estabelecida com sucesso!");
  }
});

module.exports = transporter;