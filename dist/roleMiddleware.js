"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdminOfSameCompany = exports.preventSelfModification = exports.checkAdminType = void 0;
const db_config_1 = __importDefault(require("./db-config"));
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
const isAdminOfSameCompany = async (req, res, next) => {
    const loggedInUsername = req.user?.username;
    try {
        const loggedInUserQuery = 'SELECT company_id, admin_type FROM mailgw_admin WHERE admin_username = ?';
        const [loggedInUserRows] = await db_config_1.default.promise().query(loggedInUserQuery, [loggedInUsername]);
        if (loggedInUserRows.length === 0) {
            return res.status(404).json({ message: 'Logged-in admin not found' });
        }
        const loggedInUser = loggedInUserRows[0];
        if (!['admin', 'operator', 'guest'].includes(loggedInUser.admin_type)) {
            return res.status(403).json({ message: 'Unauthorized - Access restricted' });
        }
        req.companyId = loggedInUser.company_id; // Storing for use in the route handler
        next();
    }
    catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
exports.isAdminOfSameCompany = isAdminOfSameCompany;
