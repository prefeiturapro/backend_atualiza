const pool = require("./connection");

async function buscaResponsavel(hora, campo, valorcampo, controleFlags) {
    
    if (!valorcampo || parseFloat(valorcampo) === 0) return [];
    if (!campo || !hora) return [];

    let horaFormatada = String(hora);
    if (!horaFormatada.includes(':')) {
        horaFormatada = `${horaFormatada}:00:00`;
    }

    try {
        const sql = `
            SELECT r.id_empregados, e.nm_nomefantasia, r.ds_grupo
            FROM bauhaus.responsavelenc r
            LEFT OUTER JOIN database.empregados e on (e.id_empregados=r.id_empregados)
            WHERE TRIM(r.ds_campo) ILIKE $2
            AND r.horaini <= $1::time
            AND r.horafim >= $1::time
        `;

        // console.log("Busca SQL -> Hora:", horaFormatada, "| Campo:", campo);

        const { rows } = await pool.query(sql, [horaFormatada, campo]);

        const resulResponsavel = rows.map((linha) => {

            // === ID 1 ===
            if (linha.id_empregados === 1) {
                if (controleFlags.inseriuUm === true) {
                    controleFlags.inseriuUm = false; 
                    return {
                        id_empregado: linha.id_empregados,
                        nm_empregado: linha.nm_nomefantasia,
                        ds_grupo: linha.ds_grupo
                    };
                }
            }
            
            // === ID 2 ===
            else if (linha.id_empregados === 2) {
                if (controleFlags.inseriuDois === true) {
                    controleFlags.inseriuDois = false;
                    return {
                        id_empregado: linha.id_empregados,
                        nm_empregado: linha.nm_nomefantasia,
                        ds_grupo: linha.ds_grupo
                    };
                }
            }
            
            // === ID 3 ===
            else if (linha.id_empregados === 3) {
                if (controleFlags.inseriuTres === true) {
                    controleFlags.inseriuTres = false;
                    return {
                        id_empregado: linha.id_empregados,
                        nm_empregado: linha.nm_nomefantasia,
                        ds_grupo: linha.ds_grupo
                    };
                }
            }

            // === ID 4 ===
            else if (linha.id_empregados === 4) {
                if (controleFlags.inseriuQuatro === true) {
                    controleFlags.inseriuQuatro = false;
                    return {
                        id_empregado: linha.id_empregados,
                        nm_empregado: linha.nm_nomefantasia,
                        ds_grupo: linha.ds_grupo
                    };
                }
            }

            // === ID 5 ===
            else if (linha.id_empregados === 5) {
                if (controleFlags.inseriuQuatro === true) {
                    controleFlags.inseriuQuatro = false;
                    return {
                        id_empregado: linha.id_empregados,
                        nm_empregado: linha.nm_nomefantasia,
                        ds_grupo: linha.ds_grupo
                    };
                }
            }


            // === ID 6 ===
            else if (linha.id_empregados === 6) {
                if (controleFlags.inseriuQuatro === true) {
                    controleFlags.inseriuQuatro = false;
                    return {
                        id_empregado: linha.id_empregados,
                        nm_empregado: linha.nm_nomefantasia,
                        ds_grupo: linha.ds_grupo
                    };
                }
            }


            // === ID 7 ===
            else if (linha.id_empregados === 7) {
                if (controleFlags.inseriuQuatro === true) {
                    controleFlags.inseriuQuatro = false;
                    return {
                        id_empregado: linha.id_empregados,
                        nm_empregado: linha.nm_nomefantasia,
                        ds_grupo: linha.ds_grupo
                    };
                }
            }

            // === ID 8 ===
            else if (linha.id_empregados === 8) {
                if (controleFlags.inseriuQuatro === true) {
                    controleFlags.inseriuQuatro = false;
                    return {
                        id_empregado: linha.id_empregados,
                        nm_empregado: linha.nm_nomefantasia,
                        ds_grupo: linha.ds_grupo
                    };
                }
            }

            // === ID 9 ===
            else if (linha.id_empregados === 9) {
                if (controleFlags.inseriuQuatro === true) {
                    controleFlags.inseriuQuatro = false;
                    return {
                        id_empregado: linha.id_empregados,
                        nm_empregado: linha.nm_nomefantasia,
                        ds_grupo: linha.ds_grupo
                    };
                }
            }

            // === ID 10 ===
            else if (linha.id_empregados === 10) {
                if (controleFlags.inseriuQuatro === true) {
                    controleFlags.inseriuQuatro = false;
                    return {
                        id_empregado: linha.id_empregados,
                        nm_empregado: linha.nm_nomefantasia,
                        ds_grupo: linha.ds_grupo
                    };
                }
            }

            // ... (Repita para os outros IDs até o 10) ...

            // === PONTO CRUCIAL DA CORREÇÃO ===
            // Se chegou aqui e não entrou em nenhum IF (ou a flag era false),
            // retornamos null explicitamente.
            return null; 
        });

        // === LIMPEZA FINAL ===
        // Removemos qualquer item que seja null.
        // Isso garante que o encomendas.js só receba dados reais.
        return resulResponsavel.filter(item => item !== null);

    } catch (error) {
        console.error(`Erro ao buscar responsável (${campo}):`, error.message);
        return [];
    }
}

module.exports = {
    buscaResponsavel
};