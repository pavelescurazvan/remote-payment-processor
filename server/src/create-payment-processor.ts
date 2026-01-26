import * as fs from "fs";
import { parse } from "csv-parse";
import * as path from "path";

/**
 * Creates the payment processor.
 */
export const createPaymentProcessor = () => {
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
        })
      );

      for await (const record of parser) {
        console.log("Processed record:", record);
      }

      console.log("Payment processor finished");
    },
  };
};
