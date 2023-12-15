import { Request, Response } from 'express'
import connection from './db-config'
import bcrypt from 'bcrypt'
import { RowDataPacket, OkPacket, ResultSetHeader } from 'mysql2'

// Define interfaces for your domain and email account data
interface DomainRowDataPacket extends RowDataPacket {
  domain_name: string
}

interface AddEmailAccount {
  localPart: string
  domainId: number
  password: string
}

export const addEmail = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { localPart, domainId, password } = req.body
  const loggedInCompanyId = req.user?.companyId
  const mail_insert_by = req.user?.id

  // Validate the incoming data
  if (!localPart || !domainId || !password) {
    return res
      .status(400)
      .json({ message: 'localPart, domainId, and password are required' })
  }

  try {
    // Check if the domain belongs to the user's company
    const domainCompanyCheckQuery = `SELECT company_id FROM mailgw_domain WHERE domain_id = ?`
    const [domainCompanyCheckResult] = await connection.promise().execute<RowDataPacket[]>(domainCompanyCheckQuery, [domainId])

    if (domainCompanyCheckResult.length === 0) {
      console.log(`Domain with ID ${domainId} not found`)
      return res.status(404).json({ message: 'Domain not found' })
    }

    if (domainCompanyCheckResult[0].company_id !== loggedInCompanyId) {
      console.log(`Domain with ID ${domainId} is not owned by company with ID ${loggedInCompanyId}`)
      return res.status(403).json({ message: 'Domain not owned by your company' })
    }

    // Check if the company has reached its max account limit
    const companyAccountLimitQuery = `SELECT company_max_account FROM mailgw_company WHERE company_id = ?`
    const [companyAccountLimitResult] = await connection
      .promise()
      .execute<RowDataPacket[]>(companyAccountLimitQuery, [loggedInCompanyId])
    const companyMaxAccount = companyAccountLimitResult[0].company_max_account

    const currentAccountCountQuery = `SELECT COUNT(*) AS accountCount FROM mailgw_mail WHERE domain_id = ?`
    const [currentAccountCountResult] = await connection
      .promise()
      .execute<RowDataPacket[]>(currentAccountCountQuery, [domainId])
    const currentAccountCount = currentAccountCountResult[0].accountCount

    if (currentAccountCount >= companyMaxAccount) {
      return res.status(400).json({
        message: 'Maximum number of email accounts reached for the company',
      })
    }

    // Fetch the domain name
    const domainNameQuery = `SELECT domain_name FROM mailgw_domain WHERE domain_id = ?`
    const [domainNameResult] = await connection.promise().execute<RowDataPacket[]>(domainNameQuery, [domainId])

    if (domainNameResult.length === 0) {
      return res.status(404).json({ message: 'Domain not found' })
    }
    const domainName = domainNameResult[0].domain_name

    // Insert the new email account
    // Construct the email address with the domain name
    const email = `${localPart}@${domainName}`
    const hashedPassword = await bcrypt.hash(password, 10) // Hash the password

    // Check if the email already exists
    const emailExistsQuery = `SELECT id FROM mailgw_mail WHERE mail = ?`
    const [emailExistsResult] = await connection.promise().execute<RowDataPacket[]>(emailExistsQuery, [email])

    if (emailExistsResult.length > 0) {
      return res.status(409).json({ message: 'Email address already exists' })
    }

    const insertEmailQuery = `INSERT INTO mailgw_mail (mail, password, 
      mail_mailbox_quota, status, mail_insert_by, domain_id, 
      mail_insert_date, mail_last_update) 
      VALUES (?, ?, 10737418240, 'active', ?, ?, 
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`

    const [insertResult] = await connection
      .promise()
      .execute<OkPacket>(insertEmailQuery, [
        email,
        hashedPassword,
        mail_insert_by,
        domainId,
      ])

    if (insertResult.affectedRows > 0) {
      return res
        .status(201)
        .json({ message: 'Email account added successfully' })
    } else {
      return res.status(400).json({ message: 'Failed to add email account' })
    }
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error adding email account' })
  }
}

export const deleteEmail = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { emailId } = req.params
  const companyId = req.user?.companyId // Provided by the attachUserInfo middleware

  if (!emailId) {
    return res.status(400).json({ message: 'Email ID is required' })
  }

  try {
    // Check if the email belongs to a domain owned by the user's company
    const emailDomainCheckQuery = `SELECT mm.id FROM mailgw_mail mm 
    JOIN mailgw_domain md ON mm.domain_id = md.domain_id 
    WHERE mm.id = ? AND md.company_id = ?`

    const [emailDomainCheckResult] = await connection
      .promise()
      .execute<RowDataPacket[]>(emailDomainCheckQuery, [emailId, companyId])

    if (emailDomainCheckResult.length === 0) {
      return res.status(403).json({
        message: 'Email not found or you do not have permission to delete it',
      })
    }

    // Proceed with deletion since the email is associated with the user's company
    const deleteQuery = `DELETE FROM mailgw_mail WHERE id = ?`
    const [deleteResult] = await connection
      .promise()
      .execute<OkPacket>(deleteQuery, [emailId])

    if (deleteResult.affectedRows > 0) {
      return res.status(200).json({ message: 'Email deleted successfully' })
    } else {
      return res.status(404).json({ message: 'Email not found' })
    }
  } catch (error) {
    console.error('Database query error: ', error)
    return res.status(500).json({ message: 'Error deleting email' })
  }
}

export const showEmail = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const companyId = req.user?.companyId // Provided by attachUserInfo middleware

  try {
    // Update the query to join with mailgw_domain and filter by the logged-in user's company_id
    const query = `SELECT mm.id, mm.mail, mm.mail_insert_date, 
    ma.admin_fullname, mm.mail_mailbox_quota, mm.status 
    FROM mailgw_mail mm JOIN mailgw_admin ma 
    ON mm.mail_insert_by = ma.admin_id 
    JOIN mailgw_domain md ON mm.domain_id = md.domain_id 
    WHERE md.company_id = ?`

    // Execute the query with the company_id to filter the emails
    const [emails] = await connection
      .promise()
      .query<RowDataPacket[]>(query, [companyId])

    return res.json(emails)
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error fetching emails' })
  }
}

export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { emailId } = req.params
  const { newPassword } = req.body
  const companyId = req.user?.companyId // Provided by attachUserInfo middleware

  // Check for password length
  if (!newPassword || newPassword.length < 8) {
    return res
      .status(400)
      .json({ message: 'The new password must be at least 8 characters long' })
  }

  if (!emailId) {
    return res.status(400).json({ message: 'Email ID is required' })
  }

  // Debugging log
  console.log(`Attempting to reset password for emailId: ${emailId}, companyId: ${companyId}`)

  try {
    // First, verify that the email ID belongs to a domain owned by the user's company
    const domainCheckQuery = `SELECT me.id FROM mailgw_mail me 
    JOIN mailgw_domain md ON me.domain_id = md.domain_id 
    WHERE me.id = ? AND md.company_id = ?`

    const [domainCheckResult] = await connection
      .promise()
      .execute<RowDataPacket[]>(domainCheckQuery, [emailId, companyId])

    // If the email ID is not associated with a domain from the user's company, deny the reset
    if (domainCheckResult.length === 0) {
      return res.status(403).json({
        message:
          "You can only reset passwords for email accounts that belong to your company's domains",
      })
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    if (!hashedPassword) {
      return res.status(500).json({ message: 'Error generating hashed password' })
    }

    // Prepare the SQL query to update the password
    const updateQuery = `UPDATE mailgw_mail SET password = ? WHERE id = ?`

    // Execute the query with the hashed password and email ID
    const [updateResult] = await connection
      .promise()
      .execute<OkPacket>(updateQuery, [hashedPassword, emailId])

    // Check if the query actually updated an existing row
    if (updateResult.affectedRows > 0) {
      return res.status(200).json({ message: 'Password reset successfully' })
    } else {
      return res.status(404).json({
        message:
          "Email account not found or does not belong to your company's domain",
      })
    }
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error resetting password' })
  }
}

export const changeEmailStatus = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { emailId } = req.params
  const companyId = req.user?.companyId // Provided by attachUserInfo middleware

  // Check if emailId and companyId are provided
  if (!emailId) {
    return res.status(400).json({ message: 'Email ID is required' })
  }

  if (!companyId) {
    return res.status(400).json({
      message: 'Company ID is missing. User authentication might be incorrect',
    })
  }

  try {
    // First, verify that the email ID belongs to a domain owned by the user's company
    const domainCheckQuery = `SELECT mm.id FROM mailgw_mail mm 
    JOIN mailgw_domain md ON mm.domain_id = md.domain_id 
    WHERE mm.id = ? AND md.company_id = ?`

    const [domainCheckResult] = await connection
      .promise()
      .execute<RowDataPacket[]>(domainCheckQuery, [emailId, companyId])

    // If the email ID is not associated with a domain from the user's company, deny the status change
    if (domainCheckResult.length === 0) {
      return res.status(403).json({
        message:
          "You can only change the status of emails that belong to your company's domains",
      })
    }

    // Determine the new status based on the current status
    const getStatusQuery = `SELECT status FROM mailgw_mail WHERE id = ?`
    const [currentStatusResult] = await connection
      .promise()
      .execute<RowDataPacket[]>(getStatusQuery, [emailId])
    const currentStatus = currentStatusResult[0].status
    const newStatus = currentStatus === 'active' ? 'suspend' : 'active'

    // Prepare the SQL query to update the status
    const updateQuery = `UPDATE mailgw_mail SET status = ? WHERE id = ?`

    // Execute the query with the new status and email ID
    const [updateResult] = await connection
      .promise()
      .execute<OkPacket>(updateQuery, [newStatus, emailId])

    // Check if the query actually updated an existing row
    if (updateResult.affectedRows > 0) {
      return res
        .status(200)
        .json({ message: `Email status changed to ${newStatus} successfully` })
    } else {
      return res.status(404).json({
        message:
          "Email account not found or does not belong to your company's domain",
      })
    }
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error changing email status' })
  }
}