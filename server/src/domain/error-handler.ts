/**
 * Wraps a function, catches, and handles any errors that occur during execution
 * @param fn
 * @param input
 */
export const errorHandler = async (fn: (input: any) => Promise<void>, input: any) => {
  try {
    await fn(input);
  } catch (e) {
    console.error(`Error processing transaction: ${e.message}`);
  }
}
