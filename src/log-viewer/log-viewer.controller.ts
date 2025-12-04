import { Controller, Query, Sse, type MessageEvent, Req } from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";

import { LogViewerService } from "./log-viewer.service";

@Controller("log_viewer")
export class LogViewerController {
  constructor(private readonly log_viewer: LogViewerService) {}

  @Sse("tail")
  sse(
    @Req() req: Request,
    @Query("file") file: string | undefined,
    @Query("preload") preload: boolean | undefined,
  ): Observable<MessageEvent> {
    return this.log_viewer.tail(req, file, preload);
  }
}
