"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("./auth");
const authMiddleware_1 = require("./authMiddleware");
const profile_1 = require("./profile");
const company_1 = require("./company");
const email_1 = require("./email");
const admin_1 = require("./admin");
const domain_1 = require("./domain");
const group_1 = require("./group");
const mail_log_1 = require("./mail-log");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://43.230.131.39';
const corsOptions = {
    origin: CORS_ORIGIN
};
app.use((0, cors_1.default)(corsOptions));
app.use(body_parser_1.default.json());
app.post('/login', auth_1.handleLogin);
app.post('/logout', auth_1.handleLogout);
app.get('/profile', authMiddleware_1.verifyToken, profile_1.getProfile);
app.put('/change-password', authMiddleware_1.verifyToken, profile_1.changePassword);
app.post('/add-company', authMiddleware_1.verifyToken, (0, authMiddleware_1.checkAdminType)(['superadmin']), company_1.addCompany);
app.delete('/delete-company/:companyId', authMiddleware_1.verifyToken, (0, authMiddleware_1.checkAdminType)(['superadmin']), company_1.deleteCompany);
app.get('/show-company', authMiddleware_1.verifyToken, (0, authMiddleware_1.checkAdminType)(['superadmin']), company_1.showCompany);
app.post('/add-email', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin', 'operator']), email_1.addEmail);
app.delete('/delete-email/:emailId', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin', 'operator']), email_1.deleteEmail);
app.get('/show-email', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, email_1.showEmail);
app.put('/reset-password/:emailId', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin', 'operator']), email_1.resetPassword);
app.put('/change-email-status/:emailId', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin', 'operator']), email_1.changeEmailStatus);
app.post('/add-admin', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin']), admin_1.addAdmin);
app.delete('/delete-admin/:adminId', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin']), authMiddleware_1.preventSelfModification, admin_1.deleteAdmin);
app.get('/show-admin', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin']), admin_1.showAdmin);
app.put('/manage-admin/:adminId', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin']), authMiddleware_1.preventSelfModification, admin_1.manageAdmin);
app.post('/add-domain', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin', 'operator']), domain_1.addDomain);
app.put('/verify-domain/:domainId', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin', 'operator']), domain_1.verifyDomain);
app.delete('/delete-domain/:domainId', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin', 'operator']), domain_1.deleteDomain);
app.get('/show-domain', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, domain_1.showDomain);
app.get('/show-group', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, group_1.showGroupList);
app.get('/show-email-log', authMiddleware_1.verifyToken, authMiddleware_1.attachUserInfo, (0, authMiddleware_1.checkAdminType)(['superadmin', 'admin']), mail_log_1.showEmailLog);
app.get('/', (req, res) => {
    res.send('Server is running');
});
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Something broke!');
});
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
