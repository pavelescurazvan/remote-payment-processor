import { RequestHandler } from "express";

export const createHealthcheckRequestHandler = (): RequestHandler => {
  return async (_req, res) => {
    res.send({
      message: "Remote Payment Processor is healthy and sound",
    });
  };
};
