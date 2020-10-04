const path = require('path');
const cluster = require('cluster');
const { argv } = require('yargs');
const ClusterManager = require('./lib/cluster-manager');
const Parser = require('./lib/parser');
const { queryFile } = require('./config');

async function main() {
  // Process the input
  let inputFile = queryFile;
  if (argv.file) {
    inputFile = argv.file;
  }

  const parser = new Parser(inputFile);
  const validEntries = parser.parseQueries();

  // Prepare the cluster manager
  const clusterManager = new ClusterManager();

  // Used to setup the worker module that will be controlled by the master
  cluster.setupMaster({ exec: path.join(__dirname, './lib/worker.js') });

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
