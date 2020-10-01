const path = require('path');
const cluster = require('cluster');
const { ClusterManager } = require('./lib/cluster-manager');
const { parseQueries } = require('./lib/parser');

const { queryFile } = require('./config');

async function main() {
  // TODO: Add CLI flag for the queryFile instead of the default one
  const validEntries = await parseQueries(queryFile);

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
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err);
  });
