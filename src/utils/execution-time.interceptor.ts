import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class ExecutionTime implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const cl = ctx.getClass();
    cl.prototype.execution_time = Date.now();
    return next.handle();
  }
}
