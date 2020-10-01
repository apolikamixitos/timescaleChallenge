const parse = require('csv-parse/lib/sync');
const fs = require('fs');

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

module.exports = {
  parseQueries,
};
