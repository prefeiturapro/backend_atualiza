const nodemailer = require('nodemailer');

/**
 * Configuração do Transportador de E-mail utilizando as credenciais do .env
 */
const transporter = nodemailer.createTransport({
  service: 'gmail', // Adicionar isso ajuda o Nodemailer a configurar os protocolos internos
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false // Essencial para evitar bloqueios de certificado em servidores de nuvem
  }
});

// Verifica se a conexão com o servidor de e-mail está funcionando ao iniciar
transporter.verify((error, success) => {
  if (error) {
    console.error("[MAIL] Erro na configuração do e-mail:", error.message);
  } else {
    console.log("[MAIL] Servidor de e-mail pronto para enviar mensagens.");
  }
});

module.exports = transporter;