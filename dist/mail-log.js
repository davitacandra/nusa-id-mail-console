"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showEmailLog = void 0;
const db_config_1 = __importDefault(require("./db-config"));
const showEmailLog = async (req, res) => {
    const companyId = req.companyId; // Assuming companyId is set by the attachUserInfo middleware
    if (!companyId) {
        return res.status(403).json({ message: 'Unauthorized access. Company ID is required.' });
    }
    try {
        const emailLogQuery = `
            SELECT ms.id, ms.sent_date, mm.mail AS 'From', ms.mail_destination AS 'To', ms.mail_subject AS 'Subject'
            FROM mailgw_mail_sent ms
            JOIN mailgw_mail mm ON ms.mail_source_id = mm.id
            JOIN mailgw_domain md ON mm.domain_id = md.domain_id
            WHERE md.company_id = ?`;
        const [emailLogs] = await db_config_1.default.promise().execute(emailLogQuery, [companyId]);
        if (emailLogs.length === 0) {
            return res.status(404).json({ message: 'No email logs found for your company.' });
        }
        return res.status(200).json(emailLogs);
    }
    catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ message: 'Error retrieving email logs' });
    }
};
exports.showEmailLog = showEmailLog;
