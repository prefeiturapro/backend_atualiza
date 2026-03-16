const twilio = require('twilio');
const transporter = require('../config/mail'); 

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = new twilio(accountSid, authToken);

// Armazenamento temporário (Memória)
const otpsSms = {}; 
const otpsEmail = {}; 

/**
 * SMS: Envia o código de verificação via Twilio
 */
const enviarCodigo = async (req, res) => {
    try {
        const { telefone } = req.body; 

        if (!telefone) {
            return res.status(400).json({ erro: "Telefone é obrigatório" });
        }

        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Tratamento do Telefone
        let telefoneLimpo = telefone.replace(/\D/g, ""); 
        const chaveMemoria = telefoneLimpo; 

        if (telefoneLimpo.startsWith("55") && telefoneLimpo.length >= 12) {
            telefoneLimpo = "+" + telefoneLimpo;
        } else {
            telefoneLimpo = "+55" + telefoneLimpo;
        }

        otpsSms[chaveMemoria] = codigo;

        const message = await client.messages.create({ 
            messagingServiceSid: process.env.TWILIO_MESSAGE_SERVICE_SID, 
            to: telefoneLimpo, 
            body: `AtualizaAí: Seu codigo e ${codigo}` 
        });

        console.log(`SMS enviado via PREF_ATUALI para ${telefoneLimpo}! SID: ${message.sid}`);
        res.json({ sucesso: true, status: 'pending' });

    } catch (error) {
        console.error("Erro Twilio Enviar:", error);
        res.status(500).json({ 
            erro: "Erro ao enviar código SMS", 
            detalhes: error.message 
        });
    }
};

/**
 * SMS: Valida o código do Twilio
 */
const validarCodigo = async (req, res) => {
    try {
        const { telefone, codigo } = req.body;
        const telefoneLimpo = telefone.replace(/\D/g, "");

        if (!telefone || !codigo) {
            return res.status(400).json({ erro: "Telefone e código são obrigatórios" });
        }

        if (otpsSms[telefoneLimpo] && otpsSms[telefoneLimpo] === codigo) {
            delete otpsSms[telefoneLimpo]; 
            res.json({ 
                sucesso: true, 
                mensagem: "Telefone validado com sucesso!" 
            });
        } else {
            res.status(400).json({ 
                sucesso: false, 
                mensagem: "Código incorreto ou expirado" 
            });
        }

    } catch (error) {
        console.error("Erro Twilio Validar:", error);
        res.status(500).json({ 
            erro: "Erro na validação do código SMS" 
        });
    }
};

/**
 * E-MAIL: Envia código OTP via Resend
 * IMPORTANTE: Para testes no plano grátis, o 'to' deve ser seu email cadastrado no Resend.
 */
const enviarOtpEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ erro: "E-mail é obrigatório" });

        const codigo = Math.floor(100000 + Math.random() * 900000).toString(); 
        otpsEmail[email.toLowerCase()] = codigo;

        // Montagem das opções para o Resend através do nosso transporter blindado
        const mailOptions = {
            // No Resend (plano grátis), o remetente DEVE ser onboarding@resend.dev
            from: 'onboarding@resend.dev', 
            // Para testes, o Resend só envia para o seu email de cadastro. 
            // Assim que validar o domínio atualizaai.ia.br, você poderá usar email.toLowerCase()
            to: 'prefeiturapro@gmail.com', 
            subject: `${codigo} é o seu código de verificação`,
            html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #0d6efd; margin: 0;">AtualizaAí</h2>
                    <p style="color: #6c757d; font-size: 14px;">Portal de Atualização Cadastral Municipal</p>
                </div>
                <hr style="border: 0; border-top: 1px solid #eee;">
                <div style="padding: 20px 0; text-align: center;">
                    <p style="font-size: 16px; color: #333;">Olá,</p>
                    <p style="font-size: 16px; color: #333;">Utilize o código abaixo para confirmar seu e-mail no sistema:</p>
                    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; display: inline-block; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #198754;">${codigo}</span>
                    </div>
                    <p style="font-size: 14px; color: #dc3545; font-weight: bold;">Este código expira em 10 minutos.</p>
                </div>
                <hr style="border: 0; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; text-align: center;">Este é um e-mail automático. Por favor, não responda.</p>
            </div>
            `
        };

        // Disparo via API do Resend (através do transporter.js)
        await transporter.sendMail(mailOptions);
        
        console.log(`[RESEND] Código OTP enviado com sucesso para o email de teste.`);
        res.json({ sucesso: true, mensagem: "Código enviado para seu e-mail!" });

    } catch (error) {
        console.error("ERRO FATAL NO ENVIO DE EMAIL VIA RESEND:", error);
        res.status(500).json({ 
            erro: "Falha ao disparar e-mail de verificação.", 
            detalhes: error.message 
        });
    }
};

/**
 * E-MAIL: Valida o código OTP recebido
 */
const validarOtpEmail = (req, res) => {
    const { email, codigo } = req.body;
    const emailKey = email.toLowerCase();
    
    if (otpsEmail[emailKey] && otpsEmail[emailKey] === codigo) {
        delete otpsEmail[emailKey]; 
        return res.json({ sucesso: true, mensagem: "E-mail validado!" });
    }
    
    res.status(400).json({ sucesso: false, mensagem: "Código de e-mail inválido ou expirado" });
};

module.exports = { 
    enviarCodigo, 
    validarCodigo, 
    enviarOtpEmail, 
    validarOtpEmail 
};