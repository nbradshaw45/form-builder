import express from "express";
import { type MiddlewareConfigFn } from "wasp/server";
import { requestContextMiddleware } from "./server/requestContext";

export const serverMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.set(
    "express.json",
    express.json({ limit: "20mb" }),
  );
  middlewareConfig.set("requestContext", requestContextMiddleware);
  return middlewareConfig;
};
