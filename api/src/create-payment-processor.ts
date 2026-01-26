/**
 * Creates the web server.
 */
export const createPaymentProcessor = () => {
  return {
    run: () => {
      console.log("Payment processor ran");
    },
  };
};
