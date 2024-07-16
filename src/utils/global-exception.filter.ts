import { Response, Request } from "express";

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    if (exception instanceof TypeError) {
      this.logger.error(exception);
      return;
    }
    // workaround for AutoOkResponseInterceptor
    if ((exception as unknown as { code: string }).code === "ERR_HTTP_HEADERS_SENT") {
      return;
    }

    const ctx = host.switchToHttp();
    const status = exception.getStatus();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (status === HttpStatus.NOT_IMPLEMENTED) {
      this.logger.error(`${req.url} - not implemented call`);
    }

    if (res.headersSent) return;

    res.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
