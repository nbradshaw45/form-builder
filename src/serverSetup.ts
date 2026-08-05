import express from "express";
import { type MiddlewareConfigFn } from "wasp/server";

export const serverMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.set(
    "express.json",
    express.json({ limit: "20mb" }),
  );
  return middlewareConfig;
};
