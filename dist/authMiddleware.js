"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachUserInfo = exports.preventSelfModification = exports.checkAdminType = exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_config_1 = __importDefault(require("./db-config"));
const JWT_SECRET = 'your_secret_key'; // Same as in auth.ts
// Assuming tokenBlacklist is exported from auth.ts
const auth_1 = require("./auth");
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(403).json({ message: 'A token is required for authentication' });
    }
    // Check if the token is blacklisted
    const blacklisted = await (0, auth_1.isTokenBlacklisted)(token);
    if (blacklisted) {
        return res.status(401).json({ message: 'Token has been revoked' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({ message: 'Invalid Token' });
    }
};
exports.verifyToken = verifyToken;
const checkAdminType = (requiredTypes) => {
    return async (req, res, next) => {
        const loggedInUsername = req.user?.username;
        if (!loggedInUsername) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        try {
            const query = 'SELECT admin_type FROM mailgw_admin WHERE admin_username = ?';
            const [rows] = await db_config_1.default.promise().query(query, [loggedInUsername]);
            if (rows.length === 0 || !requiredTypes.includes(rows[0].admin_type)) {
                return res.status(403).json({ message: `Unauthorized - Only ${requiredTypes.join(', ')} allowed` });
            }
            next();
        }
        catch (error) {
            console.error('Database query error:', error);
            return res.status(500).json({ message: 'Internal Server Error' });
        }
    };
};
exports.checkAdminType = checkAdminType;
const preventSelfModification = async (req, res, next) => {
    const loggedInUsername = req.user?.username;
    const { adminId } = req.params;
    try {
        const query = 'SELECT admin_id FROM mailgw_admin WHERE admin_username = ?';
        const [rows] = await db_config_1.default.promise().query(query, [loggedInUsername]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Logged-in admin not found' });
        }
        if (rows[0].admin_id.toString() === adminId) {
            return res.status(403).json({ message: 'Modifying own admin type is not allowed' });
        }
        next();
    }
    catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
exports.preventSelfModification = preventSelfModification;
const attachUserInfo = async (req, res, next) => {
    const loggedInUsername = req.user?.username;
    const { adminId } = req.params;
    if (!loggedInUsername) {
        return res.status(403).json({ message: `Unauthorized - No username found` });
    }
    try {
        // Fetch logged-in admin's info
        const userQuery = `SELECT admin_type, company_id FROM mailgw_admin WHERE admin_username = ?`;
        const [userRows] = await db_config_1.default.promise().query(userQuery, [loggedInUsername]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: `Logged-in admin not found` });
        }
        req.adminType = userRows[0].admin_type;
        req.companyId = userRows[0].company_id;
        // Fetch target admin's info, if adminId is provided in the route
        if (adminId) {
            const targetUserQuery = `SELECT admin_type, company_id FROM mailgw_admin WHERE admin_id = ?`;
            const [targetUserRows] = await db_config_1.default.promise().query(targetUserQuery, [adminId]);
            if (targetUserRows.length === 0) {
                return res.status(404).json({ message: `Target admin not found` });
            }
            req.targetAdmin = {
                type: targetUserRows[0].admin_type,
                companyId: targetUserRows[0].company_id
            };
        }
        next();
    }
    catch (error) {
        console.error(`Database query error:`, error);
        return res.status(500).json({ message: `Internal Server Error` });
    }
};
exports.attachUserInfo = attachUserInfo;
