import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    const old_send = res.send;
    res.send = (value) => {
      res.locals.body = value;
      return old_send.call(res, value);
    };

    res.on("finish", () => {
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
            body: res.locals.body ?? null,
          },
        },
      });
    });

    next();
  }
}
