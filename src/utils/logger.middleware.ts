import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

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
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value !== "string") continue;
        req.headers[key] = value.replaceAll('"', "");
      }
      this.logger.log({
        data: {
          request: {
            method: req.method,
            originalUrl: req.originalUrl,
            headers: req.headers,
            ip: req.ip,
            body: req.body ?? null,
          },
          response: {
            statusCode: res.statusCode,
            contentLength: res.get("content-length"),
            responseTime: Date.now() - start,
            body: res.locals.body && res.locals.body.length < 1000 ? res.locals.body : "too long",
          },
        },
      });
    });

    next();
  }
}
