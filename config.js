require('dotenv').config();
const path = require('path');

const queryFile = path.join(__dirname, 'data', 'query_params.csv');

const dbConfig = {
  username: process.env.PGSQL_USERNAME || 'postgres',
  password: process.env.PGSQL_PASSWORD || 'password',
  host: process.env.PGSQL_HOST || 'localhost',
  port: parseInt(process.env.PGSQL_PORT, 10) || 5432,
  database: process.env.PGSQL_DATABASE || 'homework',
};

const databaseConnectionString = `pgsql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

module.exports = {
  queryFile,
  dbConfig,
  databaseConnectionString,
};
