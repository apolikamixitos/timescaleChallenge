const moment = require('moment');
const PgsqlClient = require('./db');
const { WORKER_ACTION } = require('./constant');

let client = null;

async function runQuery(hostname, startTime, endTime) {
  // console.log('hostname', hostname);
  const query = {
    text: "SELECT time_bucket('1 minute', ts) AS one_min, host, max(usage), min(usage) from cpu_usage where ts >= $1 and ts <= $2 AND host = $3 group by one_min, host",
    values: [startTime, endTime, hostname],
  };
  const res = await client.query(query);
  return res;
}

async function initWorker() {
  client = await PgsqlClient.getInstance();
  process.send({ status: 'READY' });
}

async function processQuery(data) {
  // console.log(`Worker ${process.pid} received message from master.`);
  const startDate = moment();
  const { hostname, startTime, endTime } = data.payload;
  runQuery(hostname, startTime, endTime).then((dbResult) => {
    const stats = {
      queryId: data.queryId,
      hostId: data.hostId,
      workerId: data.workerId,
      duration: moment().diff(startDate, 'milliseconds'),
      totalRows: dbResult.rowCount,
    };
    process.send({ queryIndex: data.queryIndex, stats });
  }).catch((err) => {
    console.log('Error with worker', process.pid);
    console.error(err);
    process.exit(-1);
  });
}

async function exitProcess() {
  // console.log('Process has exited:', process.pid);
  // Gracefully close the connection to the DB
  client.end();
  process.exit(0);
}

function workerHandler(payload) {
  switch (payload.action) {
    case WORKER_ACTION.PERFORM_QUERY: processQuery(payload.data); break;
    case WORKER_ACTION.EXIT_PROCESS: exitProcess(); break;
    default: break;
  }
}

initWorker().then(() => {
  console.log(`Worker ${process.pid} has been initialized.`);
}).catch((err) => {
  console.log('Error with worker', process.pid);
  console.error(err);
  process.exit(-1);
});

process.on('message', workerHandler);
