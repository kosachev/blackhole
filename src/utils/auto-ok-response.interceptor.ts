import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class AutoOkResponse implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    ctx.switchToHttp().getRequest().res.status(HttpStatus.OK).send("OK");
    return next.handle();
  }
}
