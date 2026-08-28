import { bootstrapDatabase } from './bootstrap';

bootstrapDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error();
    console.error('[DB] Bootstrap failed:');

    console.error(error instanceof Error ? error.message : error);

    process.exit(1);
  });
