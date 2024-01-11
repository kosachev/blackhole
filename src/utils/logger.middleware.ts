import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger("HTTP");

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl, body } = request;
    const user_agent = request.get("user-agent") ?? "";
    response.on("finish", () => {
      const { statusCode } = response;
      const content_length = response.get("content-length");
      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${content_length} - ${user_agent} ${ip}`,
      );
      if (method !== "GET" && body) {
        this.logger.debug(body);
      }
    });

    next();
  }
}
