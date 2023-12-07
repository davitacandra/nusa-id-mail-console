"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showCompany = exports.deleteCompany = exports.addCompany = void 0;
const db_config_1 = __importDefault(require("./db-config"));
const addCompany = async (req, res) => {
    const { companyName, companyAddress, maxDomain, maxMailAccount, maxMailQuota } = req.body;
    if (!companyName || !companyAddress || !maxDomain || !maxMailAccount || !maxMailQuota) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    try {
        const insertQuery = `INSERT INTO mailgw_company (company_name, company_address, company_max_domain, company_max_account, company_mailbox_quota, company_registered_date) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        const [insertResult] = await db_config_1.default.promise().execute(insertQuery, [companyName, companyAddress, maxDomain, maxMailAccount, maxMailQuota]);
        if (insertResult) {
            return res.status(201).json({ message: 'Company added successfully' });
        }
        else {
            throw new Error('Failed to add company');
        }
    }
    catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ message: 'Error adding company' });
    }
};
exports.addCompany = addCompany;
const deleteCompany = async (req, res) => {
    const { companyId } = req.params;
    if (!companyId) {
        return res.status(400).json({ message: 'Company ID is required' });
    }
    try {
        const deleteQuery = `DELETE from mailgw_company WHERE company_id = ?`;
        const [deleteResult] = await db_config_1.default.promise().execute(deleteQuery, [companyId]);
        if (deleteResult.affectedRows > 0) {
            return res.status(200).json({ message: 'Company deleted successfully' });
        }
        else {
            return res.status(400).json({ message: 'Company not found' });
        }
    }
    catch (error) {
        console.error('Database query error: ', error);
        return res.status(500).json({ message: 'Error deleting company' });
    }
};
exports.deleteCompany = deleteCompany;
const showCompany = async (req, res) => {
    try {
        const query = `SELECT company_name, company_max_domain, company_max_account, company_mailbox_quota, company_registered_date FROM mailgw_company`;
        const [company] = await db_config_1.default.promise().query(query);
        return res.json(company);
    }
    catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ message: 'Error fetching companies' });
    }
};
exports.showCompany = showCompany;
