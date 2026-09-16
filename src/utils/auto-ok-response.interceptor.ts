import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  HttpStatus,
} from "@nestjs/common";
import { map, Observable } from "rxjs";

@Injectable()
export class AutoOkResponse implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    ctx.switchToHttp().getRequest().res.status(HttpStatus.OK).send("OK");
    // The response is already sent; drop the handler result so Nest doesn't
    // attempt a second send ("Cannot set headers after they are sent").
    // Handler errors still propagate to ExceptionsHandler untouched.
    return next.handle().pipe(map(() => undefined));
  }
}
