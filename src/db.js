const { Pool, Client } = require('pg');
const { databaseConnectionString, maxConcurrentWorkers, postgresMaxConnections } = require('./config');

class PgsqlClient {
  // eslint-disable-next-line class-methods-use-this
  async getInstance() {
    if (!PgsqlClient.instance) {
      console.log('new DB Pool instance ... Worker PID:', process.pid);
      const client = new Client({
        connectionString: databaseConnectionString,
      });
      // If connection is successful, set the singleton instance to the current client
      await client.connect();
      PgsqlClient.instance = client;
    }
    return PgsqlClient.instance;
  }
}

module.exports = new PgsqlClient();
