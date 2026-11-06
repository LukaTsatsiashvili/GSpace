import 'dotenv/config';
import { app } from './app.js';

const port = Number(process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port');
}

app.listen(port, () => {
  console.info(`GSpace API listening at http://localhost:${port}`);
});
