import { Request, Response } from 'express'
import connection from './db-config'
import { RowDataPacket, OkPacket } from 'mysql2'

interface RecentEmail {
  id: number
  mail: string
  insert_date: Date | string
  insert_by: string
  mailbox_quota: string
}

interface RecentEmailLog {
  id: number
  date: string
  from: string
  to: string
  subject: string
}

// Function to fetch domain count for specific company
const fetchDomainCountByCompany = async (companyId: number): Promise<number> => {
  const query = `SELECT COUNT(*) AS domainCount FROM mailgw_domain WHERE company_id = ?`

  const [results] = await connection.promise().query<RowDataPacket[]>(query, [companyId])
  const domainCount = results[0]['domainCount'] as number
  return domainCount
}

async function fetchEmailCountByCompany(companyId: number): Promise<number> {
  const query = `
    SELECT COUNT(*) AS emailCount 
    FROM mailgw_mail AS mm 
    JOIN mailgw_domain AS md ON mm.domain_id = md.domain_id 
    WHERE md.company_id = ?
  `
  const [results] = await connection.promise().query<RowDataPacket[]>(query, [companyId])
  const emailCount = results[0]['emailCount'] as number
  return emailCount
}

async function fetchMailboxQuotaByCompany(companyId: number): Promise<string> {
  const query = `
    SELECT mm.mail_mailbox_quota
    FROM mailgw_mail AS mm
    JOIN mailgw_domain AS md ON mm.domain_id = md.domain_id
    WHERE md.company_id = ?
    LIMIT 1`
  const [results] = await connection.promise().query<RowDataPacket[]>(query, [companyId])

  if (results.length === 0) {
    return '0 GB' // Default value if no emails are found
  }

  const mailboxQuotaBytes = results[0]['mail_mailbox_quota'] as number
  
  // Convert the mailbox quota to a human-readable format, e.g., GB
  const mailboxQuotaGB = mailboxQuotaBytes / (1024 ** 3) // The quota is in bytes
  return `${mailboxQuotaGB} GB`
}


async function fetchRecentAddedEmailsByCompany(companyId: number): Promise<RecentEmail[]> {
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const query = `
    SELECT mm.id, mm.mail, mm.mail_insert_date, ma.admin_fullname, mm.mail_mailbox_quota
    FROM mailgw_mail AS mm
    JOIN mailgw_domain AS md ON mm.domain_id = md.domain_id
    JOIN mailgw_admin AS ma ON mm.mail_insert_by = ma.admin_id
    WHERE md.company_id = ? AND mm.mail_insert_date >= ?
    ORDER BY mm.mail_insert_date DESC`
  const [results] = await connection.promise().query<RowDataPacket[]>(query, [companyId, twoDaysAgo])

  // Map the results to the RecentEmail interface
  const recentEmails = results.map(row => ({
    id: row.id,
    mail: row.mail,
    insert_date: formatDate(row.mail_insert_date),
    insert_by: row.admin_fullname,
    mailbox_quota: convertBytesToGB(row.mail_mailbox_quota),
  }))

  return recentEmails
}

// Helper function to format the date
function formatDate(dateString: string): string {
  const date = new Date(dateString)

  const day = date.getDate().toString().padStart(2, '0')
  const month = date.toLocaleString('default', { month: 'long' })
  const year = date.getFullYear();
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')

  return `${day} ${month} ${year} ${hour}:${minute}`
}

// Helper function to convert bytes to GB
function convertBytesToGB(bytes: number): string {
  const gb = bytes / (1024 ** 3) // Convert bytes to GB
  return `${gb} GB`
}

async function fetchEmailSentCountByCompany(companyId: number): Promise<number> {
  const query = `
    SELECT COUNT(*) AS emailSentCount
    FROM mailgw_mail_sent AS mms
    JOIN mailgw_mail AS mm ON mms.mail_source_id = mm.id
    JOIN mailgw_domain AS md ON mm.domain_id = md.domain_id
    WHERE md.company_id = ?`
  const [results] = await connection.promise().query<RowDataPacket[]>(query, [companyId])
  const emailSentCount = results[0]['emailSentCount'] as number
  return emailSentCount
}

async function fetchCompanyLimits(companyId: number): Promise<{ maxAccount: number, maxDomain: number }> {
  const query = `
    SELECT company_max_account, company_max_domain
    FROM mailgw_company
    WHERE company_id = ?`
  const [results] = await connection.promise().query<RowDataPacket[]>(query, [companyId])
  const maxAccount = results[0]['company_max_account'] as number
  const maxDomain = results[0]['company_max_domain'] as number
  return { maxAccount, maxDomain }
}

async function fetchRecentSentEmailsByCompany(companyId: number): Promise<RecentEmailLog[]> {
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const query = `
    SELECT mms.id, mms.sent_date, mm.mail AS 'from', mms.mail_destination 
    AS 'to', mms.mail_subject
    FROM mailgw_mail_sent AS mms
    JOIN mailgw_mail AS mm ON mms.mail_source_id = mm.id
    JOIN mailgw_domain AS md ON mm.domain_id = md.domain_id
    WHERE md.company_id = ? AND mms.sent_date >= ?
    ORDER BY mms.sent_date DESC`
  const [results] = await connection.promise().query<RowDataPacket[]>(query, [companyId, twoDaysAgo])

  return results.map(row => ({
    id: row.id,
    date: formatDate(row.sent_date),
    from: row.from,
    to: row.to,
    subject: row.mail_subject
  }))
}

async function fetchRecentInboxEmailsByCompany(companyId: number): Promise<RecentEmailLog[]> {
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const query = `
    SELECT mmi.id, mmi.inbox_date, mmi.mail_source AS 'from', 
    mm.mail AS 'to', mmi.mail_subject
    FROM mailgw_mail_inbox AS mmi
    JOIN mailgw_mail AS mm ON mmi.mail_dest_id = mm.id
    JOIN mailgw_domain AS md ON mm.domain_id = md.domain_id
    WHERE md.company_id = ? AND mmi.inbox_date >= ?
    ORDER BY mmi.inbox_date DESC`
  const [results] = await connection.promise().query<RowDataPacket[]>(query, [companyId, twoDaysAgo])

  return results.map(row => ({
    id: row.id,
    date: formatDate(row.inbox_date),
    from: row.from,
    to: row.to,
    subject: row.mail_subject
  }))
}

export const Dashboard = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const loggedInAdminType = req.user?.adminType
  const loggedInCompanyId = req.user?.companyId

  if (!loggedInCompanyId) {
    return res.status(400).json({ message: 'Company ID is required' })
  }

  try {
    const domainCount = await fetchDomainCountByCompany(loggedInCompanyId)
    const emailCount = await fetchEmailCountByCompany(loggedInCompanyId)
    const mailboxQuota = await fetchMailboxQuotaByCompany(loggedInCompanyId)
    const recentEmails = (loggedInAdminType === 'superadmin' || loggedInAdminType === 'admin' || loggedInAdminType === 'operator')
      ? await fetchRecentAddedEmailsByCompany(loggedInCompanyId)
      : []
    const emailSent = (loggedInAdminType === 'superadmin' || loggedInAdminType === 'admin')
      ? await fetchEmailSentCountByCompany(loggedInCompanyId)
      : []
    const companyLimits = await fetchCompanyLimits(loggedInCompanyId)
    const emailRecentSent = (loggedInAdminType === 'superadmin' || loggedInAdminType === 'admin') 
    ? await fetchRecentSentEmailsByCompany(loggedInCompanyId)
    : []
    const emailRecentInbox = (loggedInAdminType === 'superadmin' || loggedInAdminType === 'admin')
    ? await fetchRecentInboxEmailsByCompany(loggedInCompanyId)
    : []

    const dashboardData = {
      domainCount,
      emailCount,
      mailboxQuota,
      recentEmails,
      emailSent,
      companyLimits,
      emailRecentSent,
      emailRecentInbox
    }

    return res.json({
      data: dashboardData
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return res.status(500).json({ message: 'Failed to fetch dashboard data' })
  }
}