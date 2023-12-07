import mysql from 'mysql2'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'inimailgw',
  password: process.env.DB_PASSWORD || 'MgW2017$$&*H',
  database: process.env.DB_NAME || 'mailgw'
}

const connection = mysql.createConnection(dbConfig)

connection.connect(err => {
  if (err) {
    console.error('Error connecting to the database: ' + err.stack)
    return
  }
  console.log('Connected to the database')
})

export default connection;