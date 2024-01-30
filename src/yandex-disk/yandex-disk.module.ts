import { Global, Module } from "@nestjs/common";
import { YandexDiskService } from "./yandex-disk.service";

@Global()
@Module({
  providers: [YandexDiskService],
  exports: [YandexDiskService],
})
export class YandexDiskModule {}
