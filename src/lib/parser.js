const fs = require('fs');
const Ajv = require('ajv');
const moment = require('moment');
const parse = require('csv-parse/lib/sync');

/**
 * @class
 * @classdesc Manages the parsing of the queries CSV file
 */
class Parser {
  /**
   * Constructor
   * @param {string} filePath
   */
  constructor(filePath) {
    this.filePath = filePath;
    this.records = [];
  }

  /**
   * Parse and validates the queries format
   */
  parseQueries() {
    const file = fs.readFileSync(this.filePath, 'utf-8');
    const records = parse(file, {
      delimiter: ',',
      columns: true,
      skip_empty_lines: true,
    });

    // Validate the record input format for each line
    Parser.validateRecords(records);

    this.records = records;
    return this.records;
  }

  /**
   * Validates the format of the CSV records
   * @param {Array} records
   */
  static validateRecords(records) {
    // 'ajv' json schema validation for the records
    //  ex: {
    //      hostname: 'host_000005',
    //      start_time: '2017-01-02 19:09:29',
    //      end_time: '2017-01-02 20:09:29'
    //  }

    const dateTimeRegex = '^\\d{4}[\\-](0?[1-9]|1[012])[\\-](0?[1-9]|[12][0-9]|3[01]) (2[0-3]|[0-1]?[\\d]):[0-5][\\d]:[0-5][\\d]$';
    const hostnameRegex = '^host_(\\d+)$';
    const recordsSchema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          hostname: { type: 'string', pattern: hostnameRegex },
          start_time: { type: 'string', pattern: dateTimeRegex },
          end_time: { type: 'string', pattern: dateTimeRegex },
        },
        required: [
          'hostname',
          'start_time',
          'end_time',
        ],
      },
    };

    // Validate the loaded options with the schema that we defined.
    const ajv = new Ajv();
    const validator = ajv.compile(recordsSchema);
    const isValid = validator(records);

    if (!isValid) {
      const allErrors = validator.errors.map((error) => `${error.dataPath} ${error.message}`.trim());
      throw Error(allErrors);
    }

    // Validate the start_time, end_time
    records.map((record, index) => {
      const startTime = moment(record.start_time, 'YYYY-MM-DD HH:mm:ss');
      const endTime = moment(record.end_time, 'YYYY-MM-DD HH:mm:ss');

      if (startTime > endTime) {
        throw Error(`Line ${index}: start time should be greater than end time`);
      }
    });
  }
}

module.exports = Parser;
