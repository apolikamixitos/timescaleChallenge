const fs = require('fs');
const parse = require('csv-parse/lib/sync');
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

  return records;
}

async function main() {
  // TODO: Add CLI flag for the queryFile instead of the default one
  const validEntries = await parseQueries(queryFile);
  console.log(validEntries);
}

main()
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err);
  });
