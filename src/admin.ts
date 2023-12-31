import { Request, Response } from 'express'
import connection from './db-config'
import bcrypt from 'bcrypt'
import { RowDataPacket, OkPacket } from 'mysql2'

// Define interfaces for your company and admin account data
interface DomainRowDataPacket extends RowDataPacket {
  companyName: string
}

export const addAdmin = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { fullname, username, password, type } = req.body
  let { companyId } = req.body
  const loggedInAdminType = req.user?.adminType
  const loggedInCompanyId = req.user?.companyId

  const allowedTypesForAdmin = ['admin', 'guest', 'operator']

  if (!fullname || !username || !password || !type) {
    return res
      .status(400)
      .json({ message: 'Full name, username, password, and type are required' })
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: 'Password must be at least 8 characters long' })
  }

  // Restrict companyId to their own for 'admin' users
  if (loggedInAdminType === 'admin') {
    companyId = loggedInCompanyId
    if (!allowedTypesForAdmin.includes(type)) {
      return res.status(403).json({
        message:
          'Unauthorized - Admin can only set types to ${allowedTypesForAdmin.join(`, `)}',
      })
    }
  } else if (loggedInAdminType === 'superadmin' && !companyId) {
    return res
      .status(400)
      .json({ message: 'Company ID is required for superadmin' })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    const insertQuery = `INSERT INTO mailgw_admin 
    (admin_username, admin_password, admin_fullname, admin_type, company_id) 
    VALUES (?, ?, ?, ?, ?)`

    const [insertResult] = await connection
      .promise()
      .execute(insertQuery, [
        username,
        hashedPassword,
        fullname,
        type,
        companyId,
      ])

    if (insertResult) {
      return res
        .status(201)
        .json({ message: 'Account added successfully', admin: username })
    } else {
      return res.status(400).json({ message: 'Failed to add account' })
    }
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error adding account' })
  }
}

export const deleteAdmin = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { adminId } = req.params
  const loggedInAdminType = req.user?.adminType
  const loggedInCompanyId = req.user?.companyId
  const targetAdmin = req.user?.targetAdmin

  if (!adminId) {
    return res.status(400).json({ message: 'Admin ID is required' })
  }

  // Define the types that an 'admin' can delete
  const allowedTypesForAdmin = ['admin', 'guest', 'operator']

  // Check if the target admin was found by the middleware
  if (!targetAdmin) {
    return res.status(404).json({ message: 'Target admin not found' })
  }

  // Check if the logged-in admin is 'admin' and has permission to delete this user
  if (
    loggedInAdminType === 'admin' &&
    (!allowedTypesForAdmin.includes(targetAdmin.type) ||
      targetAdmin.companyId !== loggedInCompanyId)
  ) {
    return res.status(403).json({
      message:
        'Unauthorized - Can only delete admin, operator, and guest within the same company',
    })
  }

  try {
    const deleteQuery = `DELETE from mailgw_admin WHERE admin_id = ?`
    const [deleteResult] = await connection
      .promise()
      .execute<OkPacket>(deleteQuery, [adminId])

    if (deleteResult.affectedRows > 0) {
      return res.status(200).json({ message: 'Account deleted successfully' })
    } else {
      return res.status(404).json({ message: 'Account not found' })
    }
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error deleting account' })
  }
}

export const showAdmin = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const loggedInAdminType = req.user?.adminType
  const loggedInCompanyId = req.user?.companyId

  let query = ''
  let queryParams = []

  if (loggedInAdminType === 'superadmin') {
    query = `SELECT ma.admin_id, ma.admin_fullname, 
    ma.admin_username, ma.admin_type, mc.company_name 
    FROM mailgw_admin ma JOIN mailgw_company mc ON 
    ma.company_id = mc.company_id`
  } else {
    query = `SELECT ma.admin_fullname, ma.admin_username, 
    ma.admin_type, mc.company_name FROM mailgw_admin ma 
    JOIN mailgw_company mc ON ma.company_id = mc.company_id 
    WHERE ma.company_id = ?`
    queryParams.push(loggedInCompanyId)
  }

  try {
    const [admins] = await connection
      .promise()
      .query<RowDataPacket[]>(query, queryParams)
    return res.json(admins)
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error fetching admins' })
  }
}

export const manageAdmin = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { newName, newType, newPassword } = req.body
  const { adminId } = req.params
  const adminType = req.user?.adminType
  const companyId = req.user?.companyId
  const targetAdmin = req.user?.targetAdmin

  // Define the types that an 'admin' can set
  const allowedTypesForAdmin = ['admin', 'guest', 'operator']

  if (!adminId) {
    return res
      .status(400)
      .json({ message: 'Admin ID are required' })
  }

  if (newPassword && newPassword.length < 8) {
    return res
      .status(400)
      .json({ message: 'Password must be at least 8 characters long' })
  }

  if (adminType === 'admin' && targetAdmin?.type === 'superadmin') {
    return res.status(403).json({
      message: 'Unauthorized - Cannot change the type of a superadmin',
    })
  }

  if (adminType === 'admin' && !allowedTypesForAdmin.includes(newType)) {
    return res.status(403).json({
      message: `Unauthorized - Admin can only set types to ${allowedTypesForAdmin.join(
        ', ',
      )}`,
    })
  }

  if (adminType === 'admin' && targetAdmin?.companyId !== companyId) {
    return res.status(403).json({
      message: 'Unauthorized - Can only update admin within the same company',
    })
  }

  try {
    let updateQuery = `UPDATE mailgw_admin SET `
    const updateParams = []

    if (newName) {
        updateQuery += `admin_fullname = ?`
        updateParams.push(newName)
    }

    if (newType) {
        if (updateParams.length > 0) {
            updateQuery += `, `
        }
        updateQuery += `admin_type = ?`
        updateParams.push(newType)
    }

    if (newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        if (updateParams.length > 0) {
            updateQuery += `, `
        }
        updateQuery += `admin_password = ?`
        updateParams.push(hashedPassword)
    }

    updateQuery += ` WHERE admin_id = ?`
    updateParams.push(adminId)

    const [updateResult] = await connection
      .promise()
      .execute(updateQuery, updateParams) as unknown as [OkPacket]

    if (updateResult.affectedRows > 0) {
      return res.status(200).json({ message: 'Admin updated successfully' })
    } else {
      return res.status(404).json({ message: 'Admin not found' })
    }
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error updating admin' })
  }
}