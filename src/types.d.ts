import { Request } from 'express'
import { JwtPayload } from 'jsonwebtoken'

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload
    companyId?: number
    adminType?: string
    targetAdmin?: {
      type: string
      companyId: number
    }
  }
}