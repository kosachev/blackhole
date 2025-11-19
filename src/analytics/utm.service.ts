import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { LRUCache } from "lru-cache";

export type UtmEntry = {
  ym_client_id: string;
  utm: string;
};

@Injectable()
export class UtmService {
  private readonly logger = new Logger(UtmService.name);
  private cache: LRUCache<string, string>;

  constructor() {
    this.cache = new LRUCache<string, string>({ max: 1000 });
  }

  add(entry: UtmEntry): void {
    if (!entry?.ym_client_id || !entry?.utm) throw new BadRequestException("Bad post body");
    const utm = decodeURIComponent(entry.utm).replaceAll("|||", "&");
    this.cache.set(entry.ym_client_id, utm);
    this.logger.log(`UTM added: ${entry.ym_client_id}: ${utm}`, UtmService.name);
  }

  has(ym_client_id: string): boolean {
    if (!ym_client_id) return false;
    return this.cache.has(ym_client_id);
  }

  get(ym_client_id: string): string | undefined {
    if (!ym_client_id) return undefined;
    return this.cache.get(ym_client_id);
  }

  delete(ym_client_id: string): void {
    if (!ym_client_id) return;
    this.cache.delete(ym_client_id);
    this.logger.log(`UTM deleted: ${ym_client_id}`, UtmService.name);
  }

  clear(): void {
    this.cache.clear();
  }

  listToString(): string[] {
    const utms: string[] = [];
    this.cache.forEach((value, key) => utms.push(`${key}: ${value}`));
    return utms;
  }
}
