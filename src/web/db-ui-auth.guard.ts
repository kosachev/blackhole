import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { DbUiAuthService, type DbUiScope } from "./db-ui-auth.service";

export type DbUiRequest = Request & { dbUiScope?: DbUiScope };

export function dbUiScope(request: DbUiRequest): DbUiScope {
  const scope = request.dbUiScope;
  if (!scope) throw new UnauthorizedException();
  return scope;
}

@Injectable()
export class DbUiAuthGuard implements CanActivate {
  constructor(private readonly auth: DbUiAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<DbUiRequest>();
    request.dbUiScope = this.auth.verify(request.headers.authorization);
    return true;
  }
}
