const cluster = require('cluster');
const moment = require('moment');
const _ = require('lodash');
const { calculateMedian } = require('./utils');
const { maxConcurrentWorkers } = require('../config');
const { WORKER_ACTION, WORKER_STATUS } = require('../constant');

class ClusterManager {
  constructor() {
    // Orchestrates the different workers tasks
    this.workerTasks = {};

    // Used to keep the map between the workerId of the Cluster and the modulo
    this.clusterMap = {};

    // Contains all statistics related data
    this.stats = {
      queriesStats: [],
      scriptStartDate: moment(),
    };

    // Events
    // Mandatory for event binding
    this.onMessageListener = this.onMessageListener.bind(this);
    this.onExitListener = this.onExitListener.bind(this);
  }

  // TODO: Add JS docs
  prepareWorkerTasks(validEntries) {
    // Prepare the map of worker tasks
    // eslint-disable-next-line array-callback-return
    validEntries.map((validEntry, i) => {
      // It was discussed and it was agreed on the fact that the hostIds format doesn't change
      // Therefore it was taken in consideration
      const hostId = parseInt(validEntry.hostname.split('_')[1], 10);

      // workerModuloId represents an Id that doesn't
      // exceed the total of the concurrent workers
      const workerModuloId = (hostId % maxConcurrentWorkers);
      const payload = {
        hostname: validEntry.hostname,
        startTime: validEntry.start_time,
        endTime: validEntry.end_time,
      };

      // clusterMap[41] = 2 // 2 represents the Id in cluster, 41 represents the worker modulo Id
      // Fork the process from the cluster
      let worker = null;
      if ((this.clusterMap[workerModuloId])) {
        worker = cluster.workers[this.clusterMap[workerModuloId]];
      } else {
        worker = cluster.fork();
        this.clusterMap[workerModuloId] = worker.id; // Cluster worker Id
      }

      // You can uncomment this section for more verbosity
      console.log('hostId:', hostId, 'has been assigned to cluster worker:', worker.id, 'workerModuloId:', workerModuloId);

      if (!this.workerTasks[worker.id]) {
        this.workerTasks[worker.id] = {};
      }

      const queryIndex = i;
      this.workerTasks[worker.id][queryIndex] = {
        queryIndex: i, // Used to stats collection ONLY
        hostId,
        payload,
      };
    });

    return this.workerTasks;
  }

  executeWorkerTasks(workerId) {
    const workerPayloads = this.workerTasks[workerId];
    // Wait until all tasks are defined in order to avoid any missed tasks because of
    // the asynchronous triggers with "cluster.on('online')" event
    // eslint-disable-next-line array-callback-return
    Object.values(workerPayloads).map((workerPayload) => {
    // Send the worker arguments to run the query
      cluster.workers[workerId].send({
        action: WORKER_ACTION.PERFORM_QUERY,
        data: workerPayload,
      });
    });
  }

  // Event Listeners
  onMessageListener(workerFork, message) {
    if (message.status === WORKER_STATUS.READY) {
      this.executeWorkerTasks(workerFork.id);
    } else if (message.status === WORKER_STATUS.FINISHED) {
      if (message.stats) {
        this.stats.queriesStats.push(message.stats);
      }

      // If it's the case, we remove the task of the query from the map
      const currentWorkerTasks = this.workerTasks[workerFork.id];

      // Remove from the tasks pool of the worker
      const { queryIndex } = message;
      delete currentWorkerTasks[queryIndex];

      // If no more tasks pending, exist the process
      if (Object.keys(currentWorkerTasks).length === 0) {
        console.log('NO MORE TASKS for WorkerId:', workerFork.id);
        workerFork.send({ action: WORKER_ACTION.EXIT_PROCESS });
      }
    }
  }

  onExitListener() {
    const totalWorkers = Object.keys(cluster.workers).length;
    // Last active worker exists, display the benchmark
    if (totalWorkers === 0) {
      console.log('Display Stats');
      this.displayStats();
    }
  }

  displayStats() {
    // console.log(stats);
    const workerAssignedQueries = {};

    const totalQueries = this.stats.queriesStats.length;
    let averageDuration = 0;

    let totalDuration = 0;
    let maxDuration = -1;
    let minDuration = -1;
    let medianDuration = -1;

    // Optional metrics
    let totalUsedMemory = 0;

    // Calculate with only one interation all the necessary data
    // eslint-disable-next-line array-callback-return
    this.stats.queriesStats.map((queryStats) => {
      // Calculate duration
      totalDuration += queryStats.duration;

      // maxDuration
      if (maxDuration < 0) {
        maxDuration = queryStats.duration;
      } else if (maxDuration < queryStats.duration) {
        maxDuration = queryStats.duration;
      }

      // minDuration
      if (minDuration < 0) {
        minDuration = queryStats.duration;
      } else if (minDuration > queryStats.duration) {
        minDuration = queryStats.duration;
      }

      totalUsedMemory += queryStats.usedMemory;

      if (!workerAssignedQueries[queryStats.processId]) {
        workerAssignedQueries[queryStats.processId] = new Set(); // Unique values
      }
      workerAssignedQueries[queryStats.processId].add(queryStats.hostId);
    });

    averageDuration = totalDuration / totalQueries;
    medianDuration = calculateMedian(_.map(this.stats.queriesStats, 'duration'));
    const totalExecutionDuration = moment().diff(this.stats.scriptStartDate, 'milliseconds');

    console.log('workerAssignedQueries', workerAssignedQueries);
    Object.entries(workerAssignedQueries).map(([processId, hostIds]) => {
      console.log('processId:', processId, 'had', hostIds.size, 'hostIds');
    });
    console.log('totalUsedMemory', totalUsedMemory, 'MB');
    console.log('totalQueries', totalQueries);
    console.log('totalQueriesDuration', totalDuration);
    console.log('minDuration', minDuration);
    console.log('maxDuration', maxDuration);
    console.log('averageDuration', averageDuration);
    console.log('medianDuration', medianDuration);
    console.log('totalScriptExecutionDuration', totalExecutionDuration);
  }
}

module.exports = ClusterManager;
