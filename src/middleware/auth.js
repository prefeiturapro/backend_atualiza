const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware que exige token JWT válido no header Authorization.
 * Header esperado: Authorization: Bearer <token>
 */
function exigirAuth(req, res, next) {
    if (!JWT_SECRET) {
        console.error("[AUTH] JWT_SECRET não configurado no .env");
        return res.status(500).json({ erro: "Configuração de segurança ausente." });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ erro: "Acesso não autorizado. Faça login." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.usuario = payload; // disponibiliza id, nome, cd_usuario nas rotas
        next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ erro: "Sessão expirada. Faça login novamente." });
        }
        return res.status(401).json({ erro: "Token inválido." });
    }
}

module.exports = { exigirAuth };
