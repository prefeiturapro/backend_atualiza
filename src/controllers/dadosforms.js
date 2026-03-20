const modelForms = require("../models/dadosforms");

// Regex: apenas letras, números, underscores e espaços (sem caracteres especiais)
const REGEX_NM_FORM = /^[a-zA-Z0-9_ ]+$/;

function validarNmForm(nm_form) {
    return REGEX_NM_FORM.test(nm_form);
}

const listarForms = async (req, res) => {
    try {
        const dados = await modelForms.listarForms();
        return res.json(dados);
    } catch (error) {
        console.error("Erro ao listar forms:", error);
        return res.status(500).json({ erro: "Erro interno ao buscar forms." });
    }
};

const buscarFormPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const form = await modelForms.buscarFormPorId(id);
        if (!form) {
            return res.status(404).json({ erro: "Form não encontrado." });
        }
        return res.json(form);
    } catch (error) {
        console.error("Erro ao buscar form:", error);
        return res.status(500).json({ erro: "Erro interno ao buscar form." });
    }
};

const criarForm = async (req, res) => {
    const { nm_form, ds_caption, ds_observacao, st_formreport } = req.body;

    if (!nm_form || !ds_caption) {
        return res.status(400).json({ erro: "nm_form e ds_caption são obrigatórios." });
    }

    if (!validarNmForm(nm_form)) {
        return res.status(400).json({ erro: "nm_form não pode conter caracteres especiais." });
    }

    if (st_formreport !== 'S' && st_formreport !== 'N') {
        return res.status(400).json({ erro: "st_formreport deve ser 'S' ou 'N'." });
    }

    try {
        const novoForm = await modelForms.criarForm({ nm_form, ds_caption, ds_observacao, st_formreport });
        return res.status(201).json(novoForm);
    } catch (error) {
        console.error("Erro ao criar form:", error);
        return res.status(500).json({ erro: "Erro interno ao criar form." });
    }
};

const atualizarForm = async (req, res) => {
    const { id } = req.params;
    const { nm_form, ds_caption, ds_observacao, st_formreport } = req.body;

    if (!nm_form || !ds_caption) {
        return res.status(400).json({ erro: "nm_form e ds_caption são obrigatórios." });
    }

    if (!validarNmForm(nm_form)) {
        return res.status(400).json({ erro: "nm_form não pode conter caracteres especiais." });
    }

    if (st_formreport !== 'S' && st_formreport !== 'N') {
        return res.status(400).json({ erro: "st_formreport deve ser 'S' ou 'N'." });
    }

    try {
        const formAtualizado = await modelForms.atualizarForm(id, { nm_form, ds_caption, ds_observacao, st_formreport });
        if (!formAtualizado) {
            return res.status(404).json({ erro: "Form não encontrado." });
        }
        return res.json(formAtualizado);
    } catch (error) {
        console.error("Erro ao atualizar form:", error);
        return res.status(500).json({ erro: "Erro interno ao atualizar form." });
    }
};

const excluirForm = async (req, res) => {
    const { id } = req.params;
    try {
        const excluido = await modelForms.excluirForm(id);
        if (!excluido) {
            return res.status(404).json({ erro: "Form não encontrado." });
        }
        return res.json({ mensagem: "Form excluído com sucesso." });
    } catch (error) {
        console.error("Erro ao excluir form:", error);
        return res.status(500).json({ erro: "Erro interno ao excluir form." });
    }
};

module.exports = {
    listarForms,
    buscarFormPorId,
    criarForm,
    atualizarForm,
    excluirForm
};
