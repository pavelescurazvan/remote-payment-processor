import { createService } from "./create-service";

(async () => {
  const paymentProcessor = createService();

  paymentProcessor.run();
})();
