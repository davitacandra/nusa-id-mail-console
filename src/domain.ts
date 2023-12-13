import { Request, Response } from 'express'
import connection from './db-config'
import bcrypt from 'bcrypt'
import { RowDataPacket, OkPacket, ResultSetHeader } from 'mysql2'
import { randomBytes } from 'crypto'

export const addDomain = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  let { domainName, companyId } = req.body
  const loggedInAdminType = req.user?.adminType
  const loggedInCompanyId = req.user?.companyId

  // Check if domain name is provided
  if (!domainName) {
    return res.status(400).json({ message: 'Domain name is required' })
  }

  // For admin users, restrict companyId to their own
  if (loggedInAdminType === 'admin' || loggedInAdminType === 'operator') {
    companyId = loggedInCompanyId
  }

  if (loggedInAdminType === 'superadmin' && !companyId) {
    return res
      .status(400)
      .json({ message: 'Company ID is required for superadmin' })
  }

  try {
    // Define the domain count query
    const domainCountQuery = `SELECT COUNT(*) AS domainCount FROM mailgw_domain WHERE company_id = ?`
    // Execute the query to get the current domain count for the company
    const [domainCountResult] = await connection
      .promise()
      .execute<RowDataPacket[]>(domainCountQuery, [companyId])
    const domainCount: number = domainCountResult[0]['domainCount'] as number

    // Define the max domain query
    const maxDomainQuery = `SELECT company_max_domain FROM mailgw_company WHERE company_id = ?`
    // Execute the query to get the max domain count for the company
    const [maxDomainResult] = await connection
      .promise()
      .execute<RowDataPacket[]>(maxDomainQuery, [companyId])
    const maxDomain: number = maxDomainResult[0]['company_max_domain'] as number

    if (domainCount >= maxDomain) {
      return res.status(400).json({ message: 'Maximum domain quota reached' })
    }

    // Continue with domain insertion if quota not reached
    const verificationString = `nusa.id-mail-verification=${randomBytes(
      20,
    ).toString('hex')}`
    const insertQuery = `INSERT INTO mailgw_domain (domain_name, company_id, domain_verification_code, domain_insert_date, domain_verified) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0)`
    // Execute the insert query
    const [insertResult] = await connection
      .promise()
      .execute(insertQuery, [domainName, companyId, verificationString])

    if ('affectedRows' in insertResult && insertResult.affectedRows > 0) {
      return res.status(201).json({
        message: 'Domain added successfully',
        domainId: insertResult.insertId,
      })
    } else {
      return res.status(400).json({ message: 'Failed to add domain' })
    }
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error adding domain' })
  }
}

export const verifyDomain = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { domainId } = req.params
  const loggedInAdminType = req.user?.adminType
  const loggedInCompanyId = req.user?.companyId

  if (!domainId) {
    return res.status(400).json({ message: 'Domain ID is required' })
  }

  try {
    // Check if the domain exists and get its information
    const checkQuery = `SELECT domain_verified, company_id FROM mailgw_domain WHERE domain_id = ?`
    const [checkResult] = await connection
      .promise()
      .query<RowDataPacket[]>(checkQuery, [domainId])

    if (checkResult.length === 0) {
      return res.status(400).json({ message: 'Domain not found' })
    }

    const domainVerifiedStatus = checkResult[0].domain_verified
    const domainCompanyId = checkResult[0].company_id

    if (domainVerifiedStatus === 1) {
      return res.status(403).json({ message: 'Domain is already verified' })
    }

    if (
      loggedInAdminType === 'superadmin' ||
      (loggedInAdminType === 'admin' &&
        loggedInCompanyId === domainCompanyId) ||
      (loggedInAdminType === 'operator' &&
        loggedInCompanyId === domainCompanyId)
    ) {
      // Superadmins can verify any not verified domain, admins and operators can verify only their company's not verified domains
      const updateQuery = `UPDATE mailgw_domain SET domain_verified = 1 WHERE domain_id = ?`
      const [updateResult] = await connection
        .promise()
        .execute<OkPacket>(updateQuery, [domainId])

      if (updateResult.affectedRows > 0) {
        return res.status(200).json({ message: 'Domain verified successfully' })
      } else {
        return res.status(404).json({ message: 'Domain not found' })
      }
    } else {
      return res
        .status(403)
        .json({ message: 'Unauthorized to verify this domain' })
    }
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error verifying domain' })
  }
}

export const deleteDomain = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { domainId } = req.params
  const loggedInAdminType = req.user?.adminType
  const loggedInCompanyId = req.user?.companyId

  if (!domainId) {
    return res.status(400).json({ message: 'Domain ID is required' })
  }

  try {
    // Check if the domain exists and get its information
    const checkQuery = `SELECT domain_verified, company_id FROM mailgw_domain WHERE domain_id = ?`
    const [checkResult] = await connection
      .promise()
      .query<RowDataPacket[]>(checkQuery, [domainId])

    if (checkResult.length === 0) {
      return res.status(400).json({ message: 'Domain not found' })
    }

    const domainVerifiedStatus = checkResult[0].domain_verified
    const domainCompanyId = checkResult[0].company_id

    if (domainVerifiedStatus !== 0) {
      return res.status(403).json({
        message: 'Domain cannot be deleted because it is already verified',
      })
    }

    if (
      loggedInAdminType === 'superadmin' ||
      (loggedInAdminType === 'admin' &&
        loggedInCompanyId === domainCompanyId) ||
      (loggedInAdminType === 'operator' &&
        loggedInCompanyId === domainCompanyId)
    ) {
      // Superadmins can delete any not verified domain, admins and operators can delete only their company's not verified domains
      const deleteQuery = `DELETE from mailgw_domain WHERE domain_id = ?`
      const [deleteResult] = await connection
        .promise()
        .execute<OkPacket>(deleteQuery, [domainId])

      if (deleteResult.affectedRows > 0) {
        return res.status(200).json({ message: 'Domain deleted successfully' })
      } else {
        return res.status(400).json({ message: 'Domain not found' })
      }
    } else {
      return res
        .status(403)
        .json({ message: 'Unauthorized to delete this domain' })
    }
  } catch (error) {
    console.error('Database query error: ', error)
    return res.status(500).json({ message: 'Error deleting domain' })
  }
}

export const showDomain = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const loggedInAdminType = req.user?.adminType
  const loggedInCompanyId = req.user?.companyId

  try {
    let query = `SELECT md.domain_id, md.domain_name, mc.company_name, md.domain_insert_date, md.domain_verification_code, CASE md.domain_verified WHEN 0 THEN 'not verified' WHEN 1 THEN 'verified' END as domain_verified_status FROM mailgw_domain md JOIN mailgw_company mc ON md.company_id = mc.company_id`

    const queryParams: any[] = []

    // Check if loggedInAdminType is defined and is one of the allowed types
    if (
      loggedInAdminType &&
      ['admin', 'operator', 'guest'].includes(loggedInAdminType)
    ) {
      // Use a type assertion to tell TypeScript that loggedInCompanyId is a string
      if (loggedInCompanyId) {
        query += ` WHERE md.company_id = ?`
        queryParams.push(loggedInCompanyId)
      } else {
        // Handle the case where loggedInCompanyId is undefined
        return res
          .status(400)
          .json({ message: 'Company ID could not be determined' })
      }
    }

    const [domains] = await connection
      .promise()
      .query<RowDataPacket[]>(query, queryParams)

    return res.json(domains)
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error fetching domains' })
  }
}
