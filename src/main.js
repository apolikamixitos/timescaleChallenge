const path = require('path');
const cluster = require('cluster');
const { argv } = require('yargs');
const ClusterManager = require('./lib/cluster-manager');
const Parser = require('./lib/parser');
const { defaultQueryFile, maxConcurrentWorkers } = require('./config');

async function main() {
  // Process the input, fallback to 'defaultQueryFile' if no file has been specified
  let inputFile = defaultQueryFile;
  if (argv.file) {
    inputFile = argv.file;
  }

  const parser = new Parser(inputFile);
  const validEntries = parser.parseQueries();

  // Prepare the cluster manager
  const workerFilePath = path.join(__dirname, './lib/worker.js');
  const clusterManager = new ClusterManager(workerFilePath, maxConcurrentWorkers);
  clusterManager.prepareWorkerTasks(validEntries);

  // Listener for the message replies from the workers
  cluster.on('message', clusterManager.onMessageListener);

  // Whenever a process of a worker exists
  cluster.on('exit', clusterManager.onExitListener);
}

main()
  .catch((err) => {
    console.log(err);
  });
