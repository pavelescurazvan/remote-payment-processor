import { createService } from "./create-service";

(async () => {
  const paymentProcessor = createService();

  await paymentProcessor.run();

  await paymentProcessor.shutDown();
})();
