const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // Deixe o Nodemailer gerenciar os detalhes
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // ADICIONE ESTE BLOCO ABAIXO:
  pool: true, // Usa conexões persistentes
  maxConnections: 1,
  maxMessages: Infinity,
  connectionTimeout: 10000, // 10 segundos
});

transporter.verify((error, success) => {
  if (error) {
    console.error("[ERRO NO MAIL.JS]:", error.message);
  } else {
    console.log("✅ Conexão com o Gmail estabelecida!");
  }
});

module.exports = transporter;