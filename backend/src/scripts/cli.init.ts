import { ConfigService } from '@nestjs/config';
import { ArciumService } from '../arcium/arcium.service';
import { WalrusService } from '../walrus/walrus.service';

(async () => {
  try {
    const configService = new ConfigService(process.env as any);
    const walrusService = new WalrusService(configService);
    const svc = new ArciumService(configService, walrusService, null as any);
    const pda = await svc.initResealCompDef();
    console.log('reseal comp-def PDA:', pda.toBase58());
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
