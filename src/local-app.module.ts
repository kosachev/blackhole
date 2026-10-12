import { DbUiAuthService } from "./web/db-ui-auth.service";
import { DbUiAuthGuard } from "./web/db-ui-auth.guard";
import { DbUiAuthController } from "./web/db-ui-auth.controller";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DbModule } from "./db/db.module";
import { DbUiController } from "./web/db-ui.controller";
import { DbUiService } from "./web/db-ui.service";
import { StaticController } from "./web/static.controller";

// Local reports require neither production configuration nor external integrations.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env.dev"], expandVariables: false }), DbModule],
  controllers: [DbUiAuthController, DbUiController, StaticController],
  providers: [DbUiAuthService, DbUiAuthGuard, DbUiService],
})
export class LocalAppModule {}
