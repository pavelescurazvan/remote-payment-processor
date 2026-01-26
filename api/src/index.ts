import { createPaymentProcessor } from "./create-payment-processor";

(async () => {
  const paymentProcessor = createPaymentProcessor();

  paymentProcessor.run();
})();
