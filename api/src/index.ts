import { createApiServer } from "./create-api-server";

const shutdownSignals = [
  "SIGINT",
  "SIGTERM",
  "uncaughtException",
  "unhandledRejection",
];

(async () => {
  const apiServer = createApiServer();

  shutdownSignals.forEach((signal) =>
    process.on(signal, async (error: Error) => {
      console.log(`Caught signal: ${signal}`, error);
      apiServer.stop();
    })
  );

  apiServer.start();
})();
