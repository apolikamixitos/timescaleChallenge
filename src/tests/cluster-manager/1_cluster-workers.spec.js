const path = require('path');
const sinon = require('sinon');
const cluster = require('cluster');
const { expect } = require('chai');
const ClusterManager = require('../../lib/cluster-manager');
const Parser = require('../../lib/parser');

describe('Cluster manager workers', () => {
  const sandbox = sinon.createSandbox();

  const queryFilePath = path.join(__dirname, 'mocks/1_valid_entries.csv');
  const parser = new Parser(queryFilePath);
  const validEntries = parser.parseQueries();

  let clusterManager = null;

  afterEach(() => {
    if (clusterManager) {
      clusterManager.shutdown();
      // Deregister previous listeners
      cluster.removeAllListeners('message');
      cluster.removeAllListeners('exit');
    }
  });

  it('Inexistant worker module', () => {
    const maxConcurrentWorkers = 2;
    const workerFilePath = path.join(__dirname, '../../lib/INEXISTANT.js');
    try {
      clusterManager = new ClusterManager(workerFilePath, maxConcurrentWorkers);
    } catch (err) {
      expect(err.message).to.be.equal('Worker module file doesn\'t exist');
    }
  });

  it('Check workers tasks', () => {
    const maxConcurrentWorkers = 2;
    const workerFilePath = path.join(__dirname, '../../lib/worker.js');
    clusterManager = new ClusterManager(workerFilePath, maxConcurrentWorkers);
    clusterManager.prepareWorkerTasks(validEntries);

    const totalWorkers = Object.keys(clusterManager.clusterMap).length;
    expect(totalWorkers).to.be.eql(maxConcurrentWorkers);
  });

  it('Execute workers tasks', (done) => {
    const maxConcurrentWorkers = 2;
    const workerFilePath = path.join(__dirname, '../../lib/worker.js');
    clusterManager = new ClusterManager(workerFilePath, maxConcurrentWorkers);
    clusterManager.prepareWorkerTasks(validEntries);

    const totalWorkers = Object.keys(clusterManager.clusterMap).length;
    expect(totalWorkers).to.be.eql(maxConcurrentWorkers);

    const firstWorkerId = clusterManager.clusterMap[0];
    const totalTasksFirstWorker = Object.values(clusterManager.workerTasks[firstWorkerId]).length;

    expect(totalTasksFirstWorker).to.be.equal(6); // 6 tasks

    // Listener for the message replies from the workers
    cluster.on('message', clusterManager.onMessageListener);

    // Whenever a process of a worker exists
    cluster.on('exit', (workerFork) => {
      if (workerFork.id === firstWorkerId) {
        const currentFirstWorkerTasks = Object.values(
          clusterManager.workerTasks[firstWorkerId],
        ).length;
        // Total tasks should be 0
        expect(currentFirstWorkerTasks).to.be.equal(0);
        done();
      }
    });
  });

  it('Check if "displayStats" will get invoked', (done) => {
    const maxConcurrentWorkers = 2;
    const workerFilePath = path.join(__dirname, '../../lib/worker.js');
    clusterManager = new ClusterManager(workerFilePath, maxConcurrentWorkers);

    // Spy on the object 'clusterManager'
    const displayStatsSpy = sandbox.spy(clusterManager, 'displayStats');

    clusterManager.prepareWorkerTasks(validEntries);

    // Listener for the message replies from the workers
    cluster.on('message', clusterManager.onMessageListener);

    cluster.on('exit', () => {
      clusterManager.onExitListener();
      const currentWorkers = Object.keys(cluster.workers).length;
      if (currentWorkers === 0) {
        expect(displayStatsSpy.callCount).to.be.equal(1);
        done();
      }
    });
  });
});
