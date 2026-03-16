const twilio = require('twilio');
const transporter = require('../config/mail'); // Este aqui agora é o motor do Resend

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

        console.log(`SMS enviado para ${telefoneLimpo}! SID: ${message.sid}`);
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
 */
const enviarOtpEmail = async (req, res) => {
    try {
        const { email } = req.body;
        console.log(`[DEBUG] Tentando enviar e-mail para: ${email}`);

        if (!email) return res.status(400).json({ erro: "E-mail é obrigatório" });

        const codigo = Math.floor(100000 + Math.random() * 900000).toString(); 
        otpsEmail[email.toLowerCase()] = codigo;

        const mailOptions = {
            from: 'onboarding@resend.dev', // OBRIGATÓRIO no plano grátis
            to: 'prefeiturapro@gmail.com',  // OBRIGATÓRIO seu e-mail de cadastro para teste
            subject: `Seu código AtualizaAí: ${codigo}`,
            html: `
            <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                <h2>Confirmação de E-mail</h2>
                <p>Seu código de verificação é:</p>
                <h1 style="color: #0d6efd; letter-spacing: 5px;">${codigo}</h1>
                <p>Use este código para continuar sua atualização.</p>
            </div>
            `
        };

        console.log("[DEBUG] Chamando transporter.sendMail via Resend...");
        
        // Chamada da função que configuramos no mail.js
        await transporter.sendMail(mailOptions);
        
        console.log(`[DEBUG] Sucesso! E-mail disparado para o Resend.`);
        res.json({ sucesso: true, mensagem: "Código enviado!" });

    } catch (error) {
        console.error("[DEBUG] ERRO NO ENVIO DE EMAIL:", error.message);
        res.status(500).json({ 
            erro: "Falha ao enviar e-mail", 
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