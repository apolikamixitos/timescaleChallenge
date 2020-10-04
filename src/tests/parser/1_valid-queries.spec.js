const path = require('path');
const moment = require('moment');
const { expect } = require('chai');
const Parser = require('../../lib/parser');

describe('Valid queries files checks', () => {
  it('Full queries', () => {
    const queryFilePath = path.join(__dirname, 'mocks/queries/1_valid_entries.csv');
    const parser = new Parser(queryFilePath);

    const validEntries = parser.parseQueries();

    expect(validEntries).to.be.an('array');
    expect(validEntries.length).to.equals(224);

    // Check valid entries data
    validEntries.map((validEntry) => {
      expect(validEntry).to.be.an('object');
      expect(validEntry).to.have.property('hostname');
      expect(validEntry).to.have.property('start_time');
      expect(validEntry).to.have.property('end_time');

      const startTime = moment(validEntry.start_time, 'YYYY-MM-DD HH:mm:ss');
      const endTime = moment(validEntry.end_time, 'YYYY-MM-DD HH:mm:ss');
      const timeDiff = endTime.diff(startTime, 'milliseconds');

      expect(timeDiff).to.be.greaterThan(0);
      return validEntry;
    });
  });
});
