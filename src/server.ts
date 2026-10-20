import { createApp } from './app.js';
import { loadConfig } from './config.js';
try {
  const config = await loadConfig();
  const { app, close } = createApp(config);
  const server = app.listen(config.port, '127.0.0.1', () => console.log(`Listening on 127.0.0.1:${config.port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(() => { close(); process.exit(0); }); });
} catch (error) {
  console.error('Startup failed ! Check required configuration and photo directory access.');
  console.error(error);
  process.exitCode = 1;
}
