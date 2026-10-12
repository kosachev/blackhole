import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service";

@Injectable()
export class DbUiService {
  constructor(private readonly db: DbService) {}

  getKpi() {
    return this.db.kpi.getKpi();
  }
}
