import { Injectable, Logger, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction): void {
    // skip HEAD method cause it userscipt check for updates
    // skip logging online checker
    if (
      (req.method === "HEAD" && req.originalUrl.startsWith("/public")) ||
      req.headers["user-agent"] === "online-check-gerda-bot"
    ) {
      return next();
    }
    const start = Date.now();

    const old_send = res.send;
    res.send = (value) => {
      res.locals.body = value;
      return old_send.call(res, value);
    };

    res.on("finish", () => {
      const dbUi = /^\/web\/db_ui(?:\/|$)/i.test(req.path);
      const dbUiPage = /^\/public\/db-ui\.html$/i.test(req.path);
      const headers = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [
        key,
        ["authorization", "cookie"].includes(key.toLowerCase())
          ? "[redacted]"
          : typeof value === "string" ? value.replaceAll('"', "") : value,
      ]));
      this.logger.debug({
        data: {
          request: {
            method: req.method,
            originalUrl: dbUiPage ? req.path : req.originalUrl,
            headers,
            ip: req.ip,
            body: dbUi ? "[redacted]" : req.body ?? null,
          },
          response: {
            statusCode: res.statusCode,
            contentLength: res.get("content-length"),
            responseTime: Date.now() - start,
            body: dbUi ? "[redacted]" : res.locals.body && res.locals.body.length < 1000 ? res.locals.body : "too long",
          },
        },
      });
    });

    next();
  }
}
