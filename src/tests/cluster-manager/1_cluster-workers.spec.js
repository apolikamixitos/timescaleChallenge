const path = require('path');
const { expect } = require('chai');
const ClusterManager = require('../../lib/cluster-manager');
const Parser = require('../../lib/parser');

describe('Cluster manager workers', () => {
  const queryFilePath = path.join(__dirname, 'mocks/1_valid_entries.csv');
  const parser = new Parser(queryFilePath);
  const validEntries = parser.parseQueries();

  it('Inexistant worker module', () => {
    const maxConcurrentWorkers = 2;
    const workerFilePath = path.join(__dirname, '../../lib/INEXISTANT.js');
    try {
      // eslint-disable-next-line no-unused-vars
      const clusterManager = new ClusterManager(workerFilePath, maxConcurrentWorkers);
    } catch (err) {
      expect(err.message).to.be.equal('Worker module file doesn\'t exist');
    }
  });

  it('Check workers tasks', () => {
    const expectedWorkersTasks = {
      1: {
        0: { queryIndex: 0, hostId: 8, payload: { hostname: 'host_000008', startTime: '2017-01-01 08:59:22', endTime: '2017-01-01 09:59:22' } },
        2: { queryIndex: 2, hostId: 8, payload: { hostname: 'host_000008', startTime: '2017-01-02 18:50:28', endTime: '2017-01-02 19:50:28' } },
        3: { queryIndex: 3, hostId: 2, payload: { hostname: 'host_000002', startTime: '2017-01-02 15:16:29', endTime: '2017-01-02 16:16:29' } },
        5: { queryIndex: 5, hostId: 2, payload: { hostname: 'host_000002', startTime: '2017-01-02 00:25:56', endTime: '2017-01-02 01:25:56' } },
        6: { queryIndex: 6, hostId: 8, payload: { hostname: 'host_000008', startTime: '2017-01-01 07:36:28', endTime: '2017-01-01 08:36:28' } },
        7: { queryIndex: 7, hostId: 0, payload: { hostname: 'host_000000', startTime: '2017-01-02 12:54:10', endTime: '2017-01-02 13:54:10' } },
      },
      2: {
        1: { queryIndex: 1, hostId: 1, payload: { hostname: 'host_000001', startTime: '2017-01-02 13:02:02', endTime: '2017-01-02 14:02:02' } },
        4: { queryIndex: 4, hostId: 3, payload: { hostname: 'host_000003', startTime: '2017-01-01 08:52:14', endTime: '2017-01-01 09:52:14' } },
        8: { queryIndex: 8, hostId: 5, payload: { hostname: 'host_000005', startTime: '2017-01-02 11:29:42', endTime: '2017-01-02 12:29:42' } },
      },
    };

    const maxConcurrentWorkers = 2;
    const workerFilePath = path.join(__dirname, '../../lib/worker.js');
    const clusterManager = new ClusterManager(workerFilePath, maxConcurrentWorkers);
    clusterManager.prepareWorkerTasks(validEntries);

    expect(clusterManager.workerTasks).to.be.eql(expectedWorkersTasks);
    // clusterManager.shutdown();
  });
});
