import { Global, Module } from "@nestjs/common";
import { YandexMetrikaService } from "./yandex-metrika.service";

@Global()
@Module({
  providers: [YandexMetrikaService],
  exports: [YandexMetrikaService],
})
export class YandexMetrikaModule {}
