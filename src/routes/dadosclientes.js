const express    = require("express");
const router     = express.Router();
const multer     = require("multer");
const { exigirAuth } = require("../middleware/auth");
const { dadosclientes, buscarConfig, salvarConfig } = require("../controllers/dadosclientes");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB por imagem
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
        else cb(new Error("Apenas imagens JPG, PNG ou WebP são permitidas."));
    }
});

// Pública — usada pelo formulário do cidadão e login
router.get("/config",          buscarConfig);
router.post("/dados",          dadosclientes); // compatibilidade legado

// Admin — protegidas
router.put("/config/:id", exigirAuth, upload.fields([
    { name: "by_brasao",         maxCount: 1 },
    { name: "by_brasaoprefeitura", maxCount: 1 }
]), salvarConfig);

module.exports = router;
