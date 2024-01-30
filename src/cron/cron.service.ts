import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CronService {
  protected readonly logger = new Logger(CronService.name);

  constructor(protected readonly config: ConfigService) {}
}
