const rateLimit = require("express-rate-limit");

// Login: máx. 10 tentativas por IP a cada 15 minutos (anti-brute force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' },
    standardHeaders: true,
    legacyHeaders: false
});

// OTP (SMS/email): máx. 3 envios por IP a cada 5 minutos
const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    message: { erro: 'Limite de envios de código atingido. Aguarde 5 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

// OCR (processamento de comprovante): máx. 5 por minuto por IP
const ocrLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { erro: 'Limite de processamentos atingido. Aguarde um momento.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Recuperação de senha: máx. 5 por hora por IP
const recuperarSenhaLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { erro: 'Muitas solicitações de recuperação de senha. Aguarde 1 hora.' },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = { loginLimiter, otpLimiter, ocrLimiter, recuperarSenhaLimiter };
