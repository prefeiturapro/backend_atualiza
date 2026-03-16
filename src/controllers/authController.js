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
 * CORREÇÃO: Usando 'from' direto com o nome aprovado para evitar erro 21703
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
        const chaveMemoria = telefoneLimpo; // Chave para salvar no objeto otpsSms

        if (telefoneLimpo.startsWith("55") && telefoneLimpo.length >= 12) {
            telefoneLimpo = "+" + telefoneLimpo;
        } else {
            telefoneLimpo = "+55" + telefoneLimpo;
        }

        // Salva na memória usando a string numérica pura
        otpsSms[chaveMemoria] = codigo;

        // ENVIO FORÇANDO O NOME APROVADO (Alpha Sender ID)
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
 * E-MAIL: Envia código OTP via Nodemailer
 */
const enviarOtpEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ erro: "E-mail é obrigatório" });

        const codigo = Math.floor(100000 + Math.random() * 900000).toString(); 
        otpsEmail[email.toLowerCase()] = codigo;

        const mailOptions = {
            from: `"PrefeituraPro - Verificação" <${process.env.EMAIL_USER}>`,
            to: email.toLowerCase(),
            subject: `${codigo} é o seu código de verificação`,
            html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #0d6efd; margin: 0;">PrefeituraPro</h2>
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

        await transporter.sendMail(mailOptions);
        console.log(`Código de e-mail enviado para: ${email}`);
        res.json({ sucesso: true, mensagem: "E-mail enviado!" });

    } catch (error) {
        console.error("ERRO FATAL NO ENVIO DE EMAIL:", error); // Isso vai aparecer no LOG do Render
        res.status(500).json({ 
            erro: "Falha interna no servidor de e-mail", 
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