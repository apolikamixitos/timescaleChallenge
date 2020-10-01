const fs = require('fs');
const _ = require('lodash');
const moment = require('moment');
const path = require('path');
const cluster = require('cluster');

const parse = require('csv-parse/lib/sync');
const { queryFile, maxConcurrentWorkers } = require('./config');
const { WORKER_ACTION } = require('./constant');

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

// TODO: Add JS docs
function prepareWorkerTasks(validEntries) {
  const workerTasks = {};

  const clusterMap = {};

  // Prepare the map of worker tasks
  validEntries.map((validEntry, i) => {
    const hostId = parseInt(validEntry.hostname.split('_')[1], 10);
    const workerId = (hostId % maxConcurrentWorkers);
    const payload = {
      hostname: validEntry.hostname,
      startTime: validEntry.start_time,
      endTime: validEntry.end_time,
    };

    // clusterMap[41] = 2 // 2 represents the Id in cluster, 41 represents the worker modulo Id
    // Fork the process from the cluster
    let worker = null;
    if ((clusterMap[workerId])) {
      worker = cluster.workers[clusterMap[workerId]];
    } else {
      worker = cluster.fork();
      clusterMap[workerId] = worker.id; // Cluster id
    }

    // You can uncomment this section for more verbosity
    console.log('hostId:', hostId, 'has been assigned to cluster worker:', worker.id, 'workerId:', workerId);

    if (!workerTasks[worker.id]) {
      workerTasks[worker.id] = {};
    }

    const queryIndex = i;
    workerTasks[worker.id][queryIndex] = {
      queryIndex: i, // Used to stats collection ONLY
      workerId,
      hostId,
      payload,
    };
  });

  return workerTasks;
}

function executeWorkerTasks(workerPayloads, workerId) {
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

function calculateMedian(numbers) {
  let median = 0;
  const totalNumbers = numbers.length;
  numbers.sort();

  if (totalNumbers % 2 === 0) {
    // average of two middle numbers
    median = (numbers[totalNumbers / 2 - 1] + numbers[totalNumbers / 2]) / 2;
  } else {
    // middle number only
    median = numbers[(totalNumbers - 1) / 2];
  }

  return median;
}

function displayStats(stats) {
  // console.log(stats);
  const totalQueries = stats.queriesStats.length;
  let averageDuration = 0;

  let totalDuration = 0;
  let maxDuration = -1;
  let minDuration = -1;
  let medianDuration = -1;

  // Calculate with only one interation all the necessary data
  // eslint-disable-next-line array-callback-return
  stats.queriesStats.map((queryStats) => {
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
  });

  averageDuration = totalDuration / totalQueries;
  medianDuration = calculateMedian(_.map(stats.queriesStats, 'duration'));
  const totalExecutionDuration = moment().diff(stats.scriptStartDate, 'milliseconds');

  console.log('totalQueries', totalQueries);
  console.log('totalQueriesDuration', totalDuration);
  console.log('minDuration', minDuration);
  console.log('maxDuration', maxDuration);
  console.log('averageDuration', averageDuration);
  console.log('medianDuration', medianDuration);
  console.log('totalScriptExecutionDuration', totalExecutionDuration);
}

async function main() {
  // Contains all statistics related data
  const stats = {
    queriesStats: [],
    scriptStartDate: moment(),
  };

  // TODO: Add CLI flag for the queryFile instead of the default one
  const validEntries = await parseQueries(queryFile);

  // Used to setup the worker module that will be controlled by the master
  cluster.setupMaster({ exec: path.join(__dirname, './worker.js') });
  const workerTasks = prepareWorkerTasks(validEntries);

  // Listener for the message replies from the workers
  cluster.on('message', (workerFork, message) => {
    if (message.status === 'READY') {
      const workerPayloads = workerTasks[workerFork.id];
      executeWorkerTasks(workerPayloads, workerFork.id);
    } else {
      if (message.stats) {
        stats.queriesStats.push(message.stats);
      }

      // Since we are expecting only one type of task from the worker
      // If it's the case, we remove the task of the query from the map
      const currentWorkerTasks = workerTasks[workerFork.id];

      // Remove from the tasks pool of the worker
      const { queryIndex } = message;
      delete currentWorkerTasks[queryIndex];

      // If no more tasks pending, exist the process
      if (Object.keys(currentWorkerTasks).length === 0) {
        console.log('NO MORE TASKS for WorkerId:', workerFork.id);
        workerFork.send({ action: WORKER_ACTION.EXIT_PROCESS });
      }
    }
  });

  // Whenever a process of a worker exists
  cluster.on('exit', () => {
    const totalWorkers = Object.keys(cluster.workers).length;
    // Last active worker exists, display the benchmark
    if (totalWorkers === 0) {
      displayStats(stats);
    }
  });
}

main()
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err);
  });
