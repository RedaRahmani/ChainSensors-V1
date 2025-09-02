// backend/src/scripts/watch-events.js
require('dotenv').config();
const anchor = require('@coral-xyz/anchor');
const { PublicKey, Connection } = require('@solana/web3.js');
const idl = require('../solana/idl.json');

const PROGRAM_ID = new PublicKey(
  process.env.SOLANA_PROGRAM_ID || (idl && idl.address)
);

const httpEndpoint =
  process.env.SOLANA_HTTP ||
  process.env.SOLANA_RPC ||
  'https://api.devnet.solana.com';

const wsEndpoint =
  process.env.SOLANA_WS || 'wss://api.devnet.solana.com';

(async () => {
  const connection = new Connection(httpEndpoint, {
    commitment: 'confirmed',
    wsEndpoint,
    httpHeaders: { 'User-Agent': 'CS-Watch/1.0' },
  });

  const coder = new anchor.BorshCoder(idl);
  const parser = new anchor.EventParser(PROGRAM_ID, coder);

  console.log('[watch] program:', PROGRAM_ID.toBase58());
  console.log('[watch] http:', httpEndpoint);
  console.log('[watch] ws  :', wsEndpoint);
  console.log('[watch] listening for events…\n');

  let resealCount = 0;
  let qualityCount = 0;

  const subId = await connection.onLogs(
    PROGRAM_ID,
    async (logs, ctx) => {
      try {
        const events = Array.from(parser.parseLogs(logs.logs));
        for (const ev of events) {
          if (ev.name === 'ResealOutput') {
            resealCount += 1;
            const d = ev.data;
            console.log('[ResealOutput]', {
              slot: ctx.slot,
              listing: d.listing?.toBase58?.() || String(d.listing),
              record : d.record?.toBase58?.()  || String(d.record),
              nonceHead: Buffer.from(d.nonce || []).subarray(0,4).toString('hex'),
              sig: logs.signature,
              total: resealCount,
            });
          } else if (ev.name === 'QualityScoreEvent') {
            qualityCount += 1;
            console.log('[QualityScoreEvent]', {
              slot: ctx.slot,
              sig: logs.signature,
              total: qualityCount,
            });
          }
        }
      } catch (e) {
        console.error('[watch] parse error:', e.message);
      }
    },
    'confirmed'
  );

  process.on('SIGINT', async () => {
    try { await connection.removeOnLogsListener(subId); } catch {}
    console.log('\n[watch] closed');
    process.exit(0);
  });
})();
