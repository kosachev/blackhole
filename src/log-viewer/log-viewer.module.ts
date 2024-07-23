import { Module } from "@nestjs/common";
import { LogViewerController } from "./log-viewer.controller";
import { LogViewerService } from "./log-viewer.service";

@Module({
  controllers: [LogViewerController],
  providers: [LogViewerService],
})
export class LogViewerModule {}
