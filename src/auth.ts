import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import connection from './db-config'
import { RowDataPacket } from 'mysql2'

const JWT_SECRET = 'your_secret_key'

export const handleLogin = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { username, password } = req.body

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'Username and password are required' })
  }

  try {
    const query = `SELECT admin_password, admin_type FROM mailgw_admin WHERE admin_username = ?`
    const [results] = await connection
      .promise()
      .query<RowDataPacket[]>(query, [username])

    if (results.length === 0) {
      return res.status(401).json({ message: 'User not found' })
    }

    const user = results[0]

    const passwordIsValid = await bcrypt.compare(password, user.admin_password)
    if (!passwordIsValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = jwt.sign({ username: username, admin_type: user.admin_type }, JWT_SECRET, 
      { expiresIn: '2h', })
    return res.json({ token, message: 'Login successful' })
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Database query error' })
  }
}

// Token Blacklist
let tokenBlacklist = new Set<string>()

export const addToBlacklist = async (token: string) => {
  tokenBlacklist.add(token)
}

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  return tokenBlacklist.has(token)
}

export const handleLogout = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) {
    await addToBlacklist(token)
    return res.status(200).json({ message: 'Logout successful' })
  } else {
    return res.status(400).json({ message: 'Token not provided' })
  }
}