import { ExecutionContext, createParamDecorator } from "@nestjs/common";

export const FetchRequest = createParamDecorator((_data: never, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return new Request(request.protocol + "://" + request.get("host") + request.originalUrl, {
    method: request.method,
    headers: Object.entries(request.rawHeaders),
    body: JSON.stringify(request.body),
  });
});
