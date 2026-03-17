const { Resend } = require('resend');

// Pegamos a chave primeiro
const apiKey = process.env.RESEND_API_KEY;

// Só instanciamos se a chave existir, para não dar o erro de "Missing API Key"
const resend = apiKey ? new Resend(apiKey) : null;

const transporter = {
    sendMail: async (options) => {
        if (!resend) {
            console.error("[RESEND] ❌ Tentativa de envio sem API Key configurada.");
            throw new Error("Configuração de e-mail ausente.");
        }
        try {
            const { data, error } = await resend.emails.send({
                from: 'AtualizaAí <contato@atualizaai.ia.br>',
                to: options.to,
                subject: options.subject,
                html: options.html,
            });

            if (error) throw error;
            console.log("[RESEND] ✅ E-mail enviado:", data.id);
            return data;
        } catch (err) {
            console.error("[RESEND] ❌ Erro no envio:", err.message);
            throw err;
        }
    },
    verify: (callback) => {
        if (apiKey) {
            console.log("✅ Resend: API Key detectada.");
            callback(null, true);
        } else {
            console.warn("⚠️ Resend: API Key não encontrada no .env");
            callback(new Error("Missing Key"), null);
        }
    }
};

module.exports = transporter;