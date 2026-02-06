const modelMunicipios = require("../models/dadosmunicipios");

/**
 * Retorna o município configurado nos Dados Gerais da Prefeitura
 */
async function buscarMunicipioSede(req, res) {
    try {
        const municipio = await modelMunicipios.buscarMunicipioPadrao();
        
        if (!municipio) {
            return res.status(404).json({ 
                erro: "Município padrão não configurado nos dados gerais." 
            });
        }

        // Retorna o nome oficial para comparação no frontend
        return res.json({
            id_municipios: municipio.id_municipios,
            nm_municipio: municipio.nm_municipio.toUpperCase().trim()
        });

    } catch (error) {
        console.error("[CONTROLLER] Erro ao buscar município sede:", error.message);
        res.status(500).json({ erro: "Erro interno ao localizar município sede." });
    }
}

module.exports = { buscarMunicipioSede };