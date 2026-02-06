const nodemailer = require('nodemailer');

/**
 * Envia e-mail de confirmação com o protocolo gerado
 */
async function enviarEmailProtocolo(req, res) {
    const { email, nome, protocolo } = req.body;

    // Configuração do transportador (Exemplo usando Gmail ou Outlook)
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true, // Obrigatório para a porta 465
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            // Isso impede que o Node.js bloqueie a conexão por certificados locais
            rejectUnauthorized: false 
        }
    });

    const mailOptions = {
        from: '"AtualizaAi - Prefeitura" <no-reply@prefeitura.gov.br>',
        to: email,
        subject: `Protocolo de Atualização Cadastral: ${protocolo}`,
        html: `
            <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                <h2>Olá, ${nome}!</h2>
                <p>Sua atualização cadastral foi recebida com sucesso pelo nosso sistema.</p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; border-left: 5px solid #28a745;">
                    <strong>Número do Protocolo:</strong><br/>
                    <span style="font-size: 20px; color: #007bff;">${protocolo}</span>
                </div>
                <p>Nossa equipe tributária analisará os documentos anexados e entrará em contato se necessário.</p>
                <hr/>
                <small>Este é um e-mail automático, por favor não responda.</small>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Protocolo ${protocolo} enviado para ${email}`);
        return res.json({ sucesso: true });
    } catch (error) {
        console.error("[EMAIL] Erro ao enviar e-mail:", error.message);
        return res.status(500).json({ erro: "Erro ao processar envio de e-mail" });
    }
}

module.exports = { enviarEmailProtocolo };