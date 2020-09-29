const fs = require('fs');
const parse = require('csv-parse/lib/sync');
const PgsqlClient = require('./db');

const { queryFile } = require('./config');

async function parseQueries(filePath) {
  const file = fs.readFileSync(filePath, 'utf-8');
  const records = parse(file, {
    delimiter: ',',
    columns: true,
    skip_empty_lines: true,
  });

  // TODO: Validate the record input format for each line
  records.map((record) => record);

  // TODO: Remove the limit on the record to process all the records
  return records;
}

async function runQuery(hostname, startTime, endTime) {
  const client = await PgsqlClient.getInstance();
  const query = {
    text: "SELECT time_bucket('1 minute', ts) AS one_min, host, max(usage), min(usage) from cpu_usage where ts >= $1 and ts <= $2 AND host = $3 group by one_min, host",
    values: [startTime, endTime, hostname],
  };
  const res = await client.query(query);
  console.log(res);
  return res;
}

async function main() {
  // TODO: Add CLI flag for the queryFile instead of the default one
  const validEntries = await parseQueries(queryFile);

  // eslint-disable-next-line max-len
  validEntries.map(async (validEntry) => runQuery(validEntry.hostname, validEntry.start_time, validEntry.end_time));
  console.log(validEntries);
}

main()
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err);
  });
