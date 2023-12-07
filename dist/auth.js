"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLogout = exports.isTokenBlacklisted = exports.addToBlacklist = exports.handleLogin = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_config_1 = __importDefault(require("./db-config"));
const JWT_SECRET = 'your_secret_key';
const handleLogin = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    try {
        const query = `SELECT admin_password FROM mailgw_admin WHERE admin_username = ?`;
        const [results] = await db_config_1.default.promise().query(query, [username]);
        if (results.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const user = results[0];
        const passwordIsValid = await bcrypt_1.default.compare(password, user.admin_password);
        if (!passwordIsValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ username: username }, JWT_SECRET, { expiresIn: '2h' });
        return res.json({ token, message: 'Login successful' });
    }
    catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ message: 'Database query error' });
    }
};
exports.handleLogin = handleLogin;
// Token Blacklist
let tokenBlacklist = new Set();
const addToBlacklist = async (token) => {
    tokenBlacklist.add(token);
};
exports.addToBlacklist = addToBlacklist;
const isTokenBlacklisted = async (token) => {
    return tokenBlacklist.has(token);
};
exports.isTokenBlacklisted = isTokenBlacklisted;
const handleLogout = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        await (0, exports.addToBlacklist)(token);
        return res.status(200).json({ message: 'Logout successful' });
    }
    else {
        return res.status(400).json({ message: 'Token not provided' });
    }
};
exports.handleLogout = handleLogout;
