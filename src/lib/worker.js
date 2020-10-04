const moment = require('moment');
const PgsqlClient = require('./db');
const { WORKER_ACTION, WORKER_STATUS } = require('../constant');

let client = null;

/**
 * Aggregate the MAX, MIN of CPU Uage by 1 minute interval
 * @param {string} hostname
 * @param {string} startTime
 * @param {string} endTime
 */
async function runQuery(hostname, startTime, endTime) {
  // console.log('hostname', hostname);
  const query = {
    text: "SELECT time_bucket('1 minute', ts) AS one_min, host, max(usage), min(usage) from cpu_usage where ts >= $1 and ts <= $2 AND host = $3 group by one_min, host",
    values: [startTime, endTime, hostname],
  };
  const res = await client.query(query);
  return res;
}

/**
 * A helper function that helps us to initialize the worker needed components (ex: DB Client)
 */
async function initWorker() {
  client = await PgsqlClient.getInstance();
  process.send({ status: WORKER_STATUS.READY });
}

/**
 * Process the query with the sent payload
 * @param {object} data Contains all the necessary payloads for the query
 */
async function processQuery(data) {
  // console.log(`Worker ${process.pid} received message from master.`);
  const startDate = moment();
  const { hostname, startTime, endTime } = data.payload;
  runQuery(hostname, startTime, endTime).then((dbResult) => {
    const stats = {
      queryId: data.queryId,
      hostId: data.hostId,
      duration: moment().diff(startDate, 'milliseconds'),
      totalRows: dbResult.rowCount,
      processId: process.pid,
      // Optional metrics fields
      usedMemory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
    process.send({
      status: WORKER_STATUS.FINISHED,
      queryIndex: data.queryIndex,
      stats,
    });
  }).catch((err) => {
    console.log('Error with worker', process.pid);
    console.error(err);
    process.exit(-1);
  });
}

/**
 * Gracefully exit the process
 */
async function exitProcess() {
  // console.log('Process has exited:', process.pid);
  // Gracefully close the connection to the DB
  if (client) {
    client.end();
  }
  process.exit(0);
}

/**
 * Main handled that listens for new requests
 * @param {object} payload
 */
function workerHandler(payload) {
  switch (payload.action) {
    case WORKER_ACTION.PERFORM_QUERY: processQuery(payload.data); break;
    case WORKER_ACTION.EXIT_PROCESS: exitProcess(); break;
    default: break;
  }
}

// Initialize the worker
initWorker().then(() => {
  console.log(`Worker ${process.pid} has been initialized.`);
}).catch((err) => {
  console.log('Error with worker', process.pid);
  console.error(err);
  process.exit(-1);
});

// Add a listener for new messages from master
process.on('message', workerHandler);
