import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TildaService } from "./tilda.service";
import { TildaController } from "./tilda.controller";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [TildaService],
  controllers: [TildaController],
  exports: [TildaService],
})
export class TildaModule {}
