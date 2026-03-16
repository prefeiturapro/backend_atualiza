const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // OBRIGATÓRIO false para porta 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    // Isso evita que o Render bloqueie a conexão por falta de certificado local
    rejectUnauthorized: false,
    minVersion: "TLSv1.2"
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error("[ERRO NO MAIL.JS]:", error.message);
  } else {
    console.log("✅ Conexão com o Gmail estabelecida!");
  }
});

module.exports = transporter;