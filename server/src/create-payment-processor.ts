/**
 * Creates the payment processor.
 */
export const createPaymentProcessor = () => {
  return {
    run: () => {
      console.log("Payment processor ran");
    },
  };
};
