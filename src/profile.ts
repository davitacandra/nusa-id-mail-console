import { Request, Response } from 'express'
import connection from './db-config'
import bcrypt from 'bcrypt'
import { RowDataPacket, OkPacket } from 'mysql2'

type UserProfile = {
  admin_fullname: string
  admin_username: string
  company_name: string
  company_address: string
}

export const getProfile = async (req: Request, res: Response) => {
  // Extract username from the JWT payload
  const loggedInUsername = req.user?.username as string

  try {
    const adminQuery = `SELECT admin_fullname, admin_username, company_id 
    FROM mailgw_admin WHERE admin_username = ?`
    const companyQuery = `SELECT company_name, company_address 
    FROM mailgw_company WHERE company_id = ?`

    // Use loggedInUsername instead of req.params.admin_username
    const [adminRows] = await connection
      .promise()
      .query<RowDataPacket[]>(adminQuery, [loggedInUsername])

    if (adminRows.length === 0) {
      return res.status(404).json({ message: 'Admin user not found' })
    }

    const admin = adminRows[0]

    // Then, get the company details
    const [companyRows] = await connection
      .promise()
      .query<RowDataPacket[]>(companyQuery, [admin.company_id])

    if (companyRows.length === 0) {
      return res.status(404).json({ message: 'Company not found' })
    }

    const company = companyRows[0]

    // Construct the user profile response
    const userProfile: UserProfile = {
      admin_fullname: admin.admin_fullname,
      admin_username: admin.admin_username,
      company_name: company.company_name,
      company_address: company.company_address,
    }

    res.json(userProfile)
  } catch (error) {
    console.error('Error fetching profile:', error)
    res.status(500).json({ message: 'Error fetching profile' })
  }
}

export const changePassword = async (req: Request, res: Response) => {
  const loggedInUsername = req.user?.username as string

  const { currentPassword, newPassword, confirmNewPassword } = req.body

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: 'Current password and new password are required' })
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ message: 'New password does not match' })
  }

  // Check if the new password is at least 8 characters long
  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ message: 'Password must be at least 8 characters long' })
  }

  try {
    // First, get the current hashed password from the database
    const query = `SELECT admin_password FROM mailgw_admin WHERE admin_username = ?`
    const [results] = await connection
      .promise()
      .query<RowDataPacket[]>(query, [loggedInUsername])

    if (results.length === 0) {
      return res.status(401).json({ message: 'User not found' })
    }

    const user = results[0]

    // Compare the provided current password with the hashed password
    const passwordIsValid = await bcrypt.compare(
      currentPassword,
      user.admin_password,
    )

    if (!passwordIsValid) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    // Update the password in the database
    const updateQuery = `UPDATE mailgw_admin SET admin_password = ? WHERE admin_username = ?`
    const [updateResults] = await connection
      .promise()
      .execute<OkPacket>(updateQuery, [hashedNewPassword, loggedInUsername])

    if (updateResults.affectedRows === 0) {
      throw new Error('Password update failed')
    }
    res.json({ message: 'Password successfully updated' })
  } catch (error) {
    console.error('Error updating password:', error)
    res.status(500).json({ message: 'Failed to update password' })
  }
}