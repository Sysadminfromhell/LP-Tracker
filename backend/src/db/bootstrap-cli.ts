import { bootstrapDatabase } from './bootstrap';
import { log } from '../utils/logging';

let caller = 'DB';

bootstrapDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log(caller, 'error', ``);
    log(caller, 'error', `Bootstrap failed:`);
    log(caller, 'error', error instanceof Error ? error.message : error);
    process.exit(1);
  });
