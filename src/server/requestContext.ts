import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, Response, NextFunction } from "express";

type RequestStore = {
  ip?: string;
  userAgent?: string;
};

const storage = new AsyncLocalStorage<RequestStore>();

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]?.trim();
  }
  return req.socket?.remoteAddress ?? undefined;
}

/** Express middleware that stashes request IP/UA for the current async context. */
export function requestContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const store: RequestStore = {
    ip: clientIp(req),
    userAgent:
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"]
        : undefined,
  };
  storage.run(store, () => next());
}

export function getRequestIp(): string | undefined {
  return storage.getStore()?.ip;
}

export function getRequestUserAgent(): string | undefined {
  return storage.getStore()?.userAgent;
}
