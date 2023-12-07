import { Request, Response } from 'express'
import { RowDataPacket } from 'mysql2'
import connection from './db-config'

export const showGroupList = async (req: Request, res: Response): Promise<Response> => {
    const companyId = req.companyId

    if (!companyId) {
        return res.status(403).json({ message: 'Unauthorized access. Company ID is required' })
    }

    try {
        const groupListQuery = `SELECT mg.group_name, mg.group_email_address,mg.group_description, mg.insert_date, ma.admin_fullname as create_by_admin FROM mailgw_group mg JOIN mailgw_domain md ON mg.domain_id = md.domain_id JOIN mailgw_admin ma ON mg.create_by_admin = ma.admin_id WHERE md.company_id = ?`

        const [groups] = await connection.promise().execute<RowDataPacket[]>(groupListQuery, [companyId])

        if (groups.length === 0) {
            return res.status(404).json({ message: 'No groups found for your company' })
        }

        return res.status(200).json(groups)
    } catch (error) {
        console.error('Database query error:', error)
        return res.status(500).json({ message: 'Error retrieving group list' })
    }
}