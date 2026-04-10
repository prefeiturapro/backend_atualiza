const { listar, buscarPorId } = require("../models/comprovantesrecusados");

/**
 * GET /comprovantesrecusados/listar
 * Lista os comprovantes recusados pelo OCR (requer auth)
 */
const listarComprovantesRecusados = async (req, res) => {
    try {
        const rows = await listar();
        return res.json(rows);
    } catch (err) {
        console.error("[COMPRECUSADOS] Erro ao listar:", err.message);
        return res.status(500).json({ erro: "Erro ao listar comprovantes recusados." });
    }
};

/**
 * GET /comprovantesrecusados/download/:id
 * Faz download do comprovante recusado (requer auth)
 */
const downloadComprovanteRecusado = async (req, res) => {
    try {
        const { id } = req.params;
        const registro = await buscarPorId(id);

        if (!registro || !registro.ds_comprovanterecusado) {
            return res.status(404).json({ erro: "Comprovante não encontrado." });
        }

        const buffer = Buffer.isBuffer(registro.ds_comprovanterecusado)
            ? registro.ds_comprovanterecusado
            : Buffer.from(registro.ds_comprovanterecusado);

        // Detecta extensão pelos magic numbers
        let ext = "bin";
        let contentType = "application/octet-stream";
        if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
            ext = "pdf"; contentType = "application/pdf";
        } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            ext = "jpg"; contentType = "image/jpeg";
        } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            ext = "png"; contentType = "image/png";
        } else if (buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21) {
            ext = "rar"; contentType = "application/x-rar-compressed";
        } else if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
            ext = "zip"; contentType = "application/zip";
        } else if (buffer[0] === 0x37 && buffer[1] === 0x7A) {
            ext = "7z"; contentType = "application/x-7z-compressed";
        }

        const filename = `comprovante_recusado_${id}.${ext}`;
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(buffer);
    } catch (err) {
        console.error("[COMPRECUSADOS] Erro ao baixar:", err.message);
        return res.status(500).json({ erro: "Erro ao baixar comprovante." });
    }
};

module.exports = { listarComprovantesRecusados, downloadComprovanteRecusado };
