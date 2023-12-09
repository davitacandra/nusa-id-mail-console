import mysql from 'mysql2'
import config from 'dotenv'

config()

const dbConfig = {
  host: process.env.DB_HOST!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
}

const connection = mysql.createConnection(dbConfig)

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database: ' + err.stack)
    return
  }
  console.log('Connected to the database')
})

export default connection
