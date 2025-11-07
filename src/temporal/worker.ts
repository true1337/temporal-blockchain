// Temporal Worker - executes workflows and activities
import { NativeConnection, Worker } from '@temporalio/worker';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as activities from './activities/index.ts';
import * as workflows from './workflow.ts';
import { 
  getTemporalAddress, 
  getTemporalTaskQueue, 
  getTemporalNamespace 
} from '../config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  // Connect to Temporal server
  const temporalAddress = getTemporalAddress();
  const connection = await NativeConnection.connect({
    address: temporalAddress,
  });

  const taskQueue = getTemporalTaskQueue();
  const namespace = getTemporalNamespace();

  // Create worker that will execute workflows and activities
  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath: join(__dirname, 'workflow.ts'), // path to workflow
    activities, // activities from activities.ts
  });

  console.log('👷 Worker started. Waiting for tasks...');
  console.log(`   Temporal Address: ${temporalAddress}`);
  console.log(`   Namespace: ${namespace}`);
  console.log(`   Task Queue: ${taskQueue}`);
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

