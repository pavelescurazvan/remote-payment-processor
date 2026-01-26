import cors from "cors";
import http from "http";
import express from "express";
import * as bodyParser from "body-parser";

import { config } from "./config";

import { errorHandler } from "./middlewares/error-handler";
import { asyncWrapper } from "./middlewares/async-wrapper";

import { createHealthcheckRequestHandler } from "./controller/healthcheck";

/**
 * Creates the web server.
 */
export const createApiServer = () => {
  const port = config.port;

  const app = express();

  app.use(cors());

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  const router = express.Router();

  app.use("/", router);

  app.use(errorHandler);

  const healthcheckRequestHandler = createHealthcheckRequestHandler();

  router.get("/healthcheck", asyncWrapper(healthcheckRequestHandler));

  const server = http.createServer(app);
  return {
    start: () => {
      server.listen(port);
      console.log(`API running on port: ${port}`);
    },
    stop: () => {
      server.close();
      console.log(`API stopped`);
    },
    server,
  };
};
