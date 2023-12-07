"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeEmailStatus = exports.resetPassword = exports.showEmail = exports.deleteEmail = exports.addEmail = void 0;
const db_config_1 = __importDefault(require("./db-config"));
const bcrypt_1 = __importDefault(require("bcrypt"));
// Function to get the domain name by its ID
async function getDomainNameById(domainId) {
    const query = 'SELECT domain_name FROM mailgw_domain WHERE domain_id = ?';
    const [rows] = await db_config_1.default.promise().query(query, [domainId]);
    if (rows.length > 0) {
        return rows[0].domain_name;
    }
    else {
        throw new Error('Domain not found');
    }
}
const addEmail = async (req, res) => {
    const { localPart, domainId, password } = req.body;
    const companyId = req.companyId;
    const mail_insert_by = req.user?.id; // User ID from the request
    // Validate the incoming data
    if (!localPart || !domainId || !password) {
        return res.status(400).json({ message: 'localPart, domainId, and password are required' });
    }
    try {
        // Check if the domain belongs to the user's company
        const domainCompanyCheckQuery = 'SELECT company_id FROM mailgw_domain WHERE domain_id = ?';
        const [domainCompanyCheckResult] = await db_config_1.default.promise().execute(domainCompanyCheckQuery, [domainId]);
        if (domainCompanyCheckResult.length === 0 || domainCompanyCheckResult[0].company_id !== companyId) {
            return res.status(403).json({ message: 'Domain not found or not owned by your company' });
        }
        // Check if the company has reached its max account limit
        const companyAccountLimitQuery = 'SELECT company_max_account FROM mailgw_company WHERE company_id = ?';
        const [companyAccountLimitResult] = await db_config_1.default.promise().execute(companyAccountLimitQuery, [companyId]);
        const companyMaxAccount = companyAccountLimitResult[0].company_max_account;
        const currentAccountCountQuery = 'SELECT COUNT(*) AS accountCount FROM mailgw_mail WHERE domain_id = ?';
        const [currentAccountCountResult] = await db_config_1.default.promise().execute(currentAccountCountQuery, [domainId]);
        const currentAccountCount = currentAccountCountResult[0].accountCount;
        if (currentAccountCount >= companyMaxAccount) {
            return res.status(400).json({ message: 'Maximum number of email accounts reached for the company' });
        }
        // Insert the new email account
        const email = `${localPart}@${domainId}`; // Construct the email address
        const hashedPassword = await bcrypt_1.default.hash(password, 10); // Hash the password
        const insertEmailQuery = `
            INSERT INTO mailgw_mail (mail, mail_mailbox_quota, status, mail_insert_by, domain_id, mail_insert_date, mail_last_update)
            VALUES (?, 10737418240, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        const [insertResult] = await db_config_1.default.promise().execute(insertEmailQuery, [email, hashedPassword, mail_insert_by, domainId]);
        if (insertResult.affectedRows > 0) {
            return res.status(201).json({ message: 'Email account added successfully' });
        }
        else {
            return res.status(400).json({ message: 'Failed to add email account' });
        }
    }
    catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ message: 'Error adding email account' });
    }
};
exports.addEmail = addEmail;
const deleteEmail = async (req, res) => {
    const { emailId } = req.params;
    const companyId = req.companyId; // Provided by the attachUserInfo middleware
    if (!emailId) {
        return res.status(400).json({ message: 'Email ID is required' });
    }
    try {
        // Check if the email belongs to a domain owned by the user's company
        const emailDomainCheckQuery = `SELECT mm.id FROM mailgw_mail mm JOIN mailgw_domain md ON mm.domain_id = md.domain_id WHERE mm.id = ? AND md.company_id = ?`;
        const [emailDomainCheckResult] = await db_config_1.default.promise().execute(emailDomainCheckQuery, [emailId, companyId]);
        if (emailDomainCheckResult.length === 0) {
            return res.status(403).json({ message: 'Email not found or you do not have permission to delete it' });
        }
        // Proceed with deletion since the email is associated with the user's company
        const deleteQuery = `DELETE FROM mailgw_mail WHERE id = ?`;
        const [deleteResult] = await db_config_1.default.promise().execute(deleteQuery, [emailId]);
        if (deleteResult.affectedRows > 0) {
            return res.status(200).json({ message: 'Email deleted successfully' });
        }
        else {
            return res.status(404).json({ message: 'Email not found' });
        }
    }
    catch (error) {
        console.error('Database query error: ', error);
        return res.status(500).json({ message: 'Error deleting email' });
    }
};
exports.deleteEmail = deleteEmail;
const showEmail = async (req, res) => {
    const companyId = req.companyId; // Provided by attachUserInfo middleware
    try {
        // Update the query to join with mailgw_domain and filter by the logged-in user's company_id
        const query = `SELECT mm.mail, mm.mail_insert_date, ma.admin_fullname, mm.mail_mailbox_quota, mm.status FROM mailgw_mail mm JOIN mailgw_admin ma ON mm.mail_insert_by = ma.admin_id JOIN mailgw_domain md ON mm.domain_id = md.domain_id WHERE md.company_id = ?`;
        // Execute the query with the company_id to filter the emails
        const [emails] = await db_config_1.default.promise().query(query, [companyId]);
        return res.json(emails);
    }
    catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ message: 'Error fetching emails' });
    }
};
exports.showEmail = showEmail;
const resetPassword = async (req, res) => {
    const { emailId } = req.params;
    const { newPassword } = req.body;
    const companyId = req.companyId; // Provided by attachUserInfo middleware
    // Check for password length
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: 'The new password must be at least 8 characters long' });
    }
    if (!emailId) {
        return res.status(400).json({ message: 'Email ID is required' });
    }
    try {
        // First, verify that the email ID belongs to a domain owned by the user's company
        const domainCheckQuery = `SELECT me.id FROM mailgw_mail me JOIN mailgw_domain md ON me.domain_id = md.domain_id WHERE me.id = ? AND md.company_id = ?`;
        const [domainCheckResult] = await db_config_1.default.promise().execute(domainCheckQuery, [emailId, companyId]);
        // If the email ID is not associated with a domain from the user's company, deny the reset
        if (domainCheckResult.length === 0) {
            return res.status(403).json({ message: 'You can only reset passwords for email accounts that belong to your company\'s domains' });
        }
        // Hash the new password
        const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
        // Prepare the SQL query to update the password
        const updateQuery = `UPDATE mailgw_mail SET password = ? WHERE id = ?`;
        // Execute the query with the hashed password and email ID
        const [updateResult] = await db_config_1.default.promise().execute(updateQuery, [hashedPassword, emailId]);
        // Check if the query actually updated an existing row
        if (updateResult.affectedRows > 0) {
            return res.status(200).json({ message: 'Password reset successfully' });
        }
        else {
            return res.status(404).json({ message: 'Email account not found or does not belong to your company\'s domain' });
        }
    }
    catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ message: 'Error resetting password' });
    }
};
exports.resetPassword = resetPassword;
const changeEmailStatus = async (req, res) => {
    const { emailId } = req.params;
    const companyId = req.companyId; // Provided by attachUserInfo middleware
    // Check if emailId and companyId are provided
    if (!emailId) {
        return res.status(400).json({ message: 'Email ID is required' });
    }
    if (!companyId) {
        return res.status(400).json({ message: 'Company ID is missing. User authentication might be incorrect' });
    }
    try {
        // First, verify that the email ID belongs to a domain owned by the user's company
        const domainCheckQuery = `SELECT mm.id FROM mailgw_mail mm JOIN mailgw_domain md ON mm.domain_id = md.domain_id WHERE mm.id = ? AND md.company_id = ?`;
        const [domainCheckResult] = await db_config_1.default.promise().execute(domainCheckQuery, [emailId, companyId]);
        // If the email ID is not associated with a domain from the user's company, deny the status change
        if (domainCheckResult.length === 0) {
            return res.status(403).json({ message: 'You can only change the status of emails that belong to your company\'s domains' });
        }
        // Determine the new status based on the current status
        const getStatusQuery = `SELECT status FROM mailgw_mail WHERE id = ?`;
        const [currentStatusResult] = await db_config_1.default.promise().execute(getStatusQuery, [emailId]);
        const currentStatus = currentStatusResult[0].status;
        const newStatus = currentStatus === 'active' ? 'suspend' : 'active';
        // Prepare the SQL query to update the status
        const updateQuery = `UPDATE mailgw_mail SET status = ? WHERE id = ?`;
        // Execute the query with the new status and email ID
        const [updateResult] = await db_config_1.default.promise().execute(updateQuery, [newStatus, emailId]);
        // Check if the query actually updated an existing row
        if (updateResult.affectedRows > 0) {
            return res.status(200).json({ message: 'Email status changed to ${newStatus} successfully' });
        }
        else {
            return res.status(404).json({ message: 'Email account not found or does not belong to your company\'s domain' });
        }
    }
    catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ message: 'Error changing email status' });
    }
};
exports.changeEmailStatus = changeEmailStatus;
