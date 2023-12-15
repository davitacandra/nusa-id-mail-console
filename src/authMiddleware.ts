import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import connection from './db-config'
import { RowDataPacket } from 'mysql2'
import { isTokenBlacklisted } from './auth'

const JWT_SECRET = 'your_secret_key' // Same as in auth.ts

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res
      .status(403)
      .json({ message: 'A token is required for authentication' })
  }

  // Check if the token is blacklisted
  const blacklisted = await isTokenBlacklisted(token)
  if (blacklisted) {
    return res.status(401).json({ message: 'Token has been revoked' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid Token' })
  }
}

export const checkAdminType = (requiredTypes: string[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const loggedInUsername = req.user?.username as string

    if (!loggedInUsername) {
      return res.status(403).json({ message: 'Unauthorized' })
    }

    try {
      const query = `SELECT admin_type FROM mailgw_admin WHERE admin_username = ?`
      const [rows] = await connection
        .promise()
        .query<RowDataPacket[]>(query, [loggedInUsername])

      if (rows.length === 0 || !requiredTypes.includes(rows[0].admin_type)) {
        return res.status(403).json({
          message: `Unauthorized - Only ${requiredTypes.join(', ')} allowed`,
        })
      }

      next()
    } catch (error) {
      console.error('Database query error:', error)
      return res.status(500).json({ message: 'Internal Server Error' })
    }
  }
}

export const preventSelfModification = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const loggedInUsername = req.user?.username as string
  const { adminId } = req.params

  try {
    const query = `SELECT admin_id FROM mailgw_admin WHERE admin_username = ?`
    const [rows] = await connection
      .promise()
      .query<RowDataPacket[]>(query, [loggedInUsername])

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Logged-in admin not found' })
    }

    if (rows[0].admin_id.toString() === adminId) {
      return res
        .status(403)
        .json({ message: 'Modifying own admin type is not allowed' })
    }

    next()
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}

export const attachUserInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const loggedInUsername = req.user?.username as string
  const { adminId } = req.params

  if (!loggedInUsername) {
    return res.status(403).json({ message: 'Unauthorized - No username found' })
  }

  try {
    // Fetch logged-in admin's info
    const userQuery = `SELECT admin_id, admin_type, company_id 
    FROM mailgw_admin WHERE admin_username = ?`
    const [userRows] = await connection
      .promise()
      .query<RowDataPacket[]>(userQuery, [loggedInUsername])

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Logged-in admin not found' })
    }

    const user = userRows[0]
    if (!user.company_id) {
      console.error(`Company ID is null for admin: ${loggedInUsername}`)
      return res.status(403).json({ message: 'Company information not found for the logged-in admin' })
    }

    req.user = {
      id: userRows[0].admin_id,
      username: loggedInUsername,
      adminType: userRows[0].admin_type,
      companyId: userRows[0].company_id
    }

    console.log(`User Info: ${JSON.stringify(req.user)}`)

    // Fetch target admin's info, if adminId is provided in the route
    if (adminId) {
      const targetUserQuery = `SELECT admin_type, company_id FROM mailgw_admin WHERE admin_id = ?`
      const [targetUserRows] = await connection
        .promise()
        .query<RowDataPacket[]>(targetUserQuery, [adminId])

      if (targetUserRows.length === 0) {
        return res.status(404).json({ message: 'Target admin not found' })
      }

      req.targetAdmin = {
        type: targetUserRows[0].admin_type,
        companyId: targetUserRows[0].company_id,
      }
    }

    next()
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}