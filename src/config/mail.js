const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS requer false para a porta 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Estas configurações abaixo são fundamentais para o Render não dar timeout
  connectionTimeout: 20000, // Aumenta para 20 segundos
  greetingTimeout: 20000,
  socketTimeout: 20000,
  tls: {
    rejectUnauthorized: false, // Ignora erros de certificado que o Render causa
    minVersion: "TLSv1.2"
  }
});

// Verificação imediata
transporter.verify((error, success) => {
  if (error) {
    console.error("[ERRO CRÍTICO MAIL.JS]:", error.message);
  } else {
    console.log("✅ VITÓRIA! Conexão com o Gmail estabelecida com sucesso.");
  }
});

module.exports = transporter;