import { createApp } from './app.js';
import { UploadStorage } from './upload-storage.js';
import { checkImageSupport } from './image-support.js';
import { loadConfig } from './config.js';
try {
  const config = await loadConfig();
  await checkImageSupport();
  const uploads = await UploadStorage.create(config.photoDirectory);
  const { app, close } = createApp(config, { uploads });
  const server = app.listen(config.port, '127.0.0.1', () => console.log(`Listening on 127.0.0.1:${config.port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(() => { void close().then(() => process.exit(0)).catch(() => { console.error('Shutdown cleanup failed.'); process.exit(1); }); }); });
} catch (error) {
  console.error('Startup failed ! Check required configuration and photo directory access.');
  console.error(error);
  process.exitCode = 1;
}
