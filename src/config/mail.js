const nodemailer = require('nodemailer');

/**
 * Configuração do Transportador de E-mail utilizando as credenciais do .env
 */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // smtp.gmail.com
  port: 465,                    // Porta padrão para conexões seguras (SSL)
  secure: true,                 // true para porta 465, false para outras portas
  auth: {
    user: process.env.EMAIL_USER, // atualizaai.cadastro@gmail.com
    pass: process.env.EMAIL_PASS, // xphjdutdcfgvjwuy (Senha de App)
  },
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