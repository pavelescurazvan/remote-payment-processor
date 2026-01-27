import * as fs from "fs";
import { parse } from "csv-parse";
import * as path from "path";
import { createInputValidator } from "./validation/create-input-validator";

/**
 * Creates the payment processor.
 */
export const createPaymentProcessor = () => {
  const { validator } = createInputValidator();

  return {
    run: async () => {
      console.log("Payment processor started");

      const csvFilePath = path.resolve(process.cwd(), "..", "input.csv");

      if (!fs.existsSync(csvFilePath)) {
        console.error(`Input file not found at ${csvFilePath}`);
        return;
      }

      const parser = fs.createReadStream(csvFilePath).pipe(
        parse({
          columns: true,
          trim: true,
          skip_empty_lines: true,
          relax_column_count: true,
        })
      );

      for await (const record of parser) {
        try {
          const transaction = validator({ record });
          console.log("Processed transaction:", transaction);
        } catch (error) {
          console.error("Validation error:", error.message);
        }
      }

      console.log("Payment processor finished");
    },
  };
};
