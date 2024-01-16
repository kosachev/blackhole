import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger("HTTP");

  use(request: Request, response: Response, next: NextFunction): void {
    const start = Date.now();

    response.on("finish", () => {
      this.logger.log({
        data: {
          request: {
            method: request.method,
            originalUrl: request.originalUrl,
            headers: request.headers,
            ip: request.ip,
            body: request.body ?? null,
          },
          response: {
            statusCode: response.statusCode,
            contentLength: response.get("content-length"),
            responseTime: Date.now() - start,
          },
        },
      });
    });

    next();
  }
}
