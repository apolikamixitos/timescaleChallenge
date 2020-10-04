const cluster = require('cluster');
const moment = require('moment');
const fs = require('fs');
const _ = require('lodash');
const { table, getBorderCharacters } = require('table');
const { calculateMedian } = require('./utils');
const { WORKER_ACTION, WORKER_STATUS } = require('../constant');

class ClusterManager {
  constructor(workerFilePath, maxConcurrentWorkers) {
    // Orchestrates the different workers tasks
    this.workerTasks = {};

    // Used to keep the map between the workerId of the Cluster and the modulo
    this.clusterMap = {};

    // Contains all statistics related data
    this.stats = {
      queriesStats: [],
      scriptStartDate: moment(),
    };

    this.maxConcurrentWorkers = maxConcurrentWorkers;

    // Used to setup the worker module that will be controlled by the master
    if (fs.existsSync(workerFilePath)) {
      cluster.setupMaster({ exec: workerFilePath });
    } else {
      throw Error('Worker module file doesn\'t exist');
    }

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
      const workerModuloId = (hostId % this.maxConcurrentWorkers);
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

  // eslint-disable-next-line class-methods-use-this
  shutdown() {
    Object.keys(cluster.workers).map((workerId) => {
      cluster.workers[workerId].kill();
      return workerId;
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
    const totalWorkers = Object.keys(workerAssignedQueries).length;

    // Preparing for display
    const tableConfig = {
      border: getBorderCharacters('ramac'),
    };
    const generalMetrics = [];
    const extraMetrics = [];

    generalMetrics.push(['Total Queries', totalQueries]);
    generalMetrics.push(['Total Queries duration', `${totalDuration} ms`]);
    generalMetrics.push(['Min duration', `${minDuration} ms`]);
    generalMetrics.push(['Max duration', `${maxDuration} ms`]);
    generalMetrics.push(['Average duration', `${averageDuration} ms`]);
    generalMetrics.push(['Median duration', `${medianDuration} ms`]);

    // Optional metrics
    extraMetrics.push(['Total used workers', `${totalWorkers} Workers`]);
    extraMetrics.push(['Total execution duration', `${totalExecutionDuration} ms`]);
    extraMetrics.push(['Total used memory', `${totalUsedMemory} MB`]);

    Object.entries(workerAssignedQueries).map(([processId, hostIds]) => {
      extraMetrics.push([`Worker PID: ${processId} [${hostIds.size} hosts]`, [...hostIds].join(',')]);
    });

    console.log('===== General Metrics =====');
    console.log(table(generalMetrics, tableConfig));

    console.log('===== Extra Metrics =====');
    console.log(table(extraMetrics, tableConfig));
  }
}

module.exports = ClusterManager;
