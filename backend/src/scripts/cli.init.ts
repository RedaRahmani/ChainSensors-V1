import { ConfigService } from '@nestjs/config';
import { ArciumService } from '../arcium/arcium.service';

(async () => {
  try {
    const svc = new ArciumService(new ConfigService(process.env as any));
    const pda = await svc.initResealCompDef();
    console.log('reseal comp-def PDA:', pda.toBase58());
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
