import path from "path";
import fs from "fs";
import { parse } from "csv-parse";
import { Validator } from "./create-input-validator";

export const createInputParsers = ({ validator }: Validator) => {
  return {
    parseInput: async function* (filePath: string) {
      const csvFilePath = path.resolve(process.cwd(), filePath);

      if (!fs.existsSync(csvFilePath)) {
        throw new Error(`Input file not found: ${csvFilePath}`);
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
        yield validator({ record });
      }
    },
  };
};
