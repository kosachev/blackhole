import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { DbUiAuthService } from "./db-ui-auth.service";

@Injectable()
export class DbUiAuthGuard implements CanActivate {
  constructor(private readonly auth: DbUiAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    this.auth.verify(request.headers.authorization);
    return true;
  }
}
