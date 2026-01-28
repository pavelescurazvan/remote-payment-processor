import { createService } from "./create-service";

(async () => {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Error: Please provide a file path as the first argument");
    console.error("Usage: node index.js <filepath>");
    process.exit(1);
  }

  const paymentProcessor = createService();

  await paymentProcessor.run(filePath);

  await paymentProcessor.shutDown();
})();
