const pool = require("../models/connection");
const modelDadosGerais = require("../models/dadosgerais");
const twilio = require("twilio");

/**
 * POST /comprovantesrec/salvar
 * Salva comprovante recusado pela IA (público — chamado pelo frontend do cidadão)
 */
const salvarComprovanteRecusado = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo enviado." });

        const agora = new Date();
        const dt_anexo = agora.toISOString().split("T")[0];
        const hr_anexo = agora.toTimeString().split(" ")[0];

        await pool.query(
            `INSERT INTO master.admincomprovantesrec (dt_anexo, hr_anexo, ds_comprovante)
             VALUES ($1, $2, $3)`,
            [dt_anexo, hr_anexo, req.file.buffer]
        );

        console.log(`[COMPREC] Comprovante recusado salvo — ${dt_anexo} ${hr_anexo}`);

        // Envia SMS de aviso se configurado
        try {
            const config = await modelDadosGerais.obterDadosGerais();
            if (config.st_avisacomprovanterec === 'S' && config.nr_telefoneadm) {
                const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                const telefone = `+55${config.nr_telefoneadm.replace(/\D/g, "")}`;
                await twilioClient.messages.create({
                    messagingServiceSid: process.env.TWILIO_MESSAGE_SERVICE_SID,
                    to: telefone,
                    body: `AtualizaAí: Comprovante recusado pela IA registrado em ${dt_anexo} às ${hr_anexo.slice(0,5)}. Acesse o painel para analisar.`
                });
                console.log(`[COMPREC] SMS de aviso enviado para ${telefone}`);
            }
        } catch (errSms) {
            console.warn("[COMPREC] Falha ao enviar SMS de aviso:", errSms.message);
        }

        return res.json({ sucesso: true });
    } catch (err) {
        console.error("[COMPREC] Erro ao salvar:", err.message);
        return res.status(500).json({ erro: "Erro ao salvar comprovante." });
    }
};

/**
 * GET /comprovantesrec/listar
 * Lista comprovantes recusados (requer auth)
 */
const listarComprovantesRecusados = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id_comprovantesrec, dt_anexo, hr_anexo
             FROM master.admincomprovantesrec
             ORDER BY dt_anexo DESC, hr_anexo DESC`
        );
        return res.json(rows);
    } catch (err) {
        console.error("[COMPREC] Erro ao listar:", err.message);
        return res.status(500).json({ erro: "Erro ao listar comprovantes." });
    }
};

/**
 * GET /comprovantesrec/download/:id
 * Faz download do comprovante (requer auth)
 */
const downloadComprovanteRecusado = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            `SELECT ds_comprovante, dt_anexo, hr_anexo
             FROM master.admincomprovantesrec
             WHERE id_comprovantesrec = $1`,
            [id]
        );
        if (!rows.length || !rows[0].ds_comprovante) {
            return res.status(404).json({ erro: "Comprovante não encontrado." });
        }

        const arquivo = rows[0];
        const buffer = Buffer.isBuffer(arquivo.ds_comprovante)
            ? arquivo.ds_comprovante
            : Buffer.from(arquivo.ds_comprovante);

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="comprovante_${id}.jpg"`);
        return res.send(buffer);
    } catch (err) {
        console.error("[COMPREC] Erro ao baixar:", err.message);
        return res.status(500).json({ erro: "Erro ao baixar comprovante." });
    }
};

module.exports = { salvarComprovanteRecusado, listarComprovantesRecusados, downloadComprovanteRecusado };
