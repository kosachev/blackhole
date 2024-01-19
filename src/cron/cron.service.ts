import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class CronService {
  protected readonly logger = new Logger(CronService.name);
}
