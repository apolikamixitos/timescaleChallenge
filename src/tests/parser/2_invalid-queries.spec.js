const path = require('path');
const { expect } = require('chai');
const Parser = require('../../lib/parser');

describe('Invalid queries files checks', () => {
  it('Inexistant file', async () => {
    const queryFilePath = '/tmp/INEXISTANT_FILE.csv';
    const parser = new Parser(queryFilePath);
    try {
      parser.parseQueries();
    } catch (err) {
      expect(err.message).to.equal("ENOENT: no such file or directory, open '/tmp/INEXISTANT_FILE.csv'");
    }
  });

  it('Invalid hostname', async () => {
    const queryFilePath = path.join(__dirname, 'mocks/queries/1_invalid_entries_hostname.csv');
    const parser = new Parser(queryFilePath);
    try {
      parser.parseQueries();
    } catch (err) {
      expect(err.message).to.equal('[0].hostname should match pattern "^host_(\\d+)$"');
    }
  });

  it('Invalid start time', async () => {
    const queryFilePath = path.join(__dirname, 'mocks/queries/1_invalid_entries_times_1.csv');
    const parser = new Parser(queryFilePath);
    try {
      parser.parseQueries();
    } catch (err) {
      expect(err.message).to.equal('[6].start_time should match pattern "^\\d{4}[\\-](0?[1-9]|1[012])[\\-](0?[1-9]|[12][0-9]|3[01]) (2[0-3]|[0-1]?[\\d]):[0-5][\\d]:[0-5][\\d]$"');
    }
  });

  it('Invalid end time', async () => {
    const queryFilePath = path.join(__dirname, 'mocks/queries/1_invalid_entries_times_2.csv');
    const parser = new Parser(queryFilePath);
    try {
      parser.parseQueries();
    } catch (err) {
      expect(err.message).to.equal('[6].end_time should match pattern "^\\d{4}[\\-](0?[1-9]|1[012])[\\-](0?[1-9]|[12][0-9]|3[01]) (2[0-3]|[0-1]?[\\d]):[0-5][\\d]:[0-5][\\d]$"');
    }
  });

  it('end time earlier than start time', async () => {
    const queryFilePath = path.join(__dirname, 'mocks/queries/1_invalid_entries_times_3.csv');
    const parser = new Parser(queryFilePath);
    try {
      parser.parseQueries();
    } catch (err) {
      expect(err.message).to.equal('Line 6: start time should be greater than end time');
    }
  });
});
