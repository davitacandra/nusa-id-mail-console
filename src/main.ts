import express, {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import { handleLogin, handleLogout } from './auth'
import {
  verifyToken,
  checkAdminType,
  preventSelfModification,
  attachUserInfo,
} from './authMiddleware'
import { getProfile, changePassword } from './profile'
import { addCompany, deleteCompany, showCompany } from './company'
import {
  addEmail,
  deleteEmail,
  showEmail,
  resetPassword,
  changeEmailStatus,
} from './email'
import { addAdmin, deleteAdmin, manageAdmin, showAdmin } from './admin'
import { addDomain, verifyDomain, deleteDomain, showDomain } from './domain'
import { showGroupList } from './group'
import { showEmailLog } from './mail-log'

const app = express()
const PORT = process.env.PORT || 3000
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

const corsOptions = {
  origin: CORS_ORIGIN,
}

app.use(cors(corsOptions))

app.use(bodyParser.json())

app.use(bodyParser.json())

app.post('/login', handleLogin)
app.post('/logout', handleLogout)

app.get('/profile', verifyToken, getProfile)
app.put('/password', verifyToken, changePassword)

app.post(
  '/company',
  verifyToken,
  checkAdminType(['superadmin']),
  addCompany
)
app.delete(
  '/company/:companyId',
  verifyToken,
  checkAdminType(['superadmin']),
  deleteCompany
)
app.get(
  '/company',
  verifyToken,
  checkAdminType(['superadmin']),
  showCompany,
)

app.post(
  '/email',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin', 'operator']),
  addEmail,
)
app.delete(
  '/email/:emailId',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin', 'operator']),
  deleteEmail,
)
app.get('/email', verifyToken, attachUserInfo, showEmail)
app.put(
  '/password/:emailId',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin', 'operator']),
  resetPassword,
)
app.put(
  '/email-status/:emailId',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin', 'operator']),
  changeEmailStatus,
)

app.post(
  '/admin',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin']),
  addAdmin,
)
app.delete(
  '/admin/:adminId',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin']),
  preventSelfModification,
  deleteAdmin,
)
app.get(
  '/admin',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin']),
  showAdmin,
)
app.put(
  '/admin/:adminId',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin']),
  preventSelfModification,
  manageAdmin,
)

app.post(
  '/domain',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin', 'operator']),
  addDomain,
)
app.put(
  '/domain/:domainId',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin', 'operator']),
  verifyDomain,
)
app.delete(
  '/domain/:domainId',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin', 'operator']),
  deleteDomain,
)
app.get('/domain', verifyToken, attachUserInfo, showDomain)

app.get('/group', verifyToken, attachUserInfo, showGroupList)

app.get(
  '/email-log',
  verifyToken,
  attachUserInfo,
  checkAdminType(['superadmin', 'admin']),
  showEmailLog,
)

app.get('/', (req: Request, res: Response) => {
  res.send('Server is running')
})

app.use(
	(
		err: ErrorRequestHandler,
		req: Request,
		res: Response,
		next: NextFunction,
	) => {
		console.error(err)
		res.status(500).send("Something broke!")
	},
)

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`)
})
