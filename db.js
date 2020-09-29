const { Client } = require('pg');
const { databaseConnectionString } = require('./config');

class PgsqlClient {
  // eslint-disable-next-line class-methods-use-this
  async getInstance() {
    if (!PgsqlClient.instance) {
      const client = new Client({
        connectionString: databaseConnectionString,
      });
      // If connection is successful, set the singleton instance to the current client
      try {
        await client.connect();
        PgsqlClient.instance = client;
      } catch (err) {
        console.error(err);
        process.exit();
      }
    }
    return PgsqlClient.instance;
  }
}

module.exports = new PgsqlClient();
