const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Isso é fundamental para debug no Render
transporter.verify((error, success) => {
  if (error) {
    console.error("[ERRO NO MAIL.JS]:", error.message);
  } else {
    console.log("[SUCESSO]: Servidor de e-mail pronto para decolar!");
  }
});

module.exports = transporter;