import { Request, Response } from 'express'
import connection from './db-config'
import { RowDataPacket, OkPacket } from 'mysql2'

interface CompanyData {
  companyName: string
  companyAddress: string
  maxDomain: number
  maxMailAccount: number
  maxMailQuota: number
}

export const addCompany = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const {
    companyName,
    companyAddress,
    maxDomain,
    maxMailAccount,
    maxMailQuota,
  } = req.body as CompanyData

  if (
    !companyName ||
    !companyAddress ||
    !maxDomain ||
    !maxMailAccount ||
    !maxMailQuota
  ) {
    return res.status(400).json({ message: 'All fields are required' })
  }

  try {
    const insertQuery = `INSERT INTO mailgw_company 
    (company_name, company_address, company_max_domain, 
    company_max_account, company_mailbox_quota, company_registered_date) 
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    const [insertResult] = await connection
      .promise()
      .execute<OkPacket>(insertQuery, [
        companyName,
        companyAddress,
        maxDomain,
        maxMailAccount,
        maxMailQuota,
      ])

    if (insertResult) {
      return res.status(201).json({ message: 'Company added successfully' })
    } else {
      throw new Error('Failed to add company')
    }
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error adding company' })
  }
}

export const deleteCompany = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { companyId } = req.params

  if (!companyId) {
    return res.status(400).json({ message: 'Company ID is required' })
  }

  try {
    const deleteQuery = `DELETE from mailgw_company WHERE company_id = ?`
    const [deleteResult] = await connection
      .promise()
      .execute<OkPacket>(deleteQuery, [companyId])

    if (deleteResult.affectedRows > 0) {
      return res.status(200).json({ message: 'Company deleted successfully' })
    } else {
      return res.status(400).json({ message: 'Company not found' })
    }
  } catch (error) {
    console.error('Database query error: ', error)
    return res.status(500).json({ message: 'Error deleting company' })
  }
}

export const showCompany = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const query = `SELECT company_id, company_name, company_max_domain, 
    company_max_account, company_mailbox_quota, company_registered_date 
    FROM mailgw_company`
    const [company] = await connection.promise().query<RowDataPacket[]>(query)

    return res.json(company)
  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ message: 'Error fetching companies' })
  }
}