import { Module } from "@nestjs/common";
import { PostTrackingService } from "./post-tracking.service";

@Module({
  providers: [PostTrackingService],
})
export class PostModule {}
