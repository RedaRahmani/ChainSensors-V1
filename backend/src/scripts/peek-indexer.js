// backend/src/scripts/peek-indexer.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing');

  const client = new MongoClient(uri);
  await client.connect();

  // NOTE: if you don't set a dbName in your Mongoose connection,
  // Atlas often defaults to "test". Change this if your app uses a specific db.
  const dbName = process.env.MONGODB_DBNAME || 'test';
  const db = client.db(dbName);

  const states = await db.collection('indexer_states').find().toArray();
  const reseals = await db.collection('resealedcapsules').find().sort({ ts: -1 }).limit(5).toArray();
  const quality = await db.collection('qualitymetrics').find().sort({ ts: -1 }).limit(5).toArray();

  console.table(states.map(s => ({
    id: s._id,
    lastProcessedSlot: s.lastProcessedSlot,
    lastProcessedSig: (s.lastProcessedSig || '').slice(0, 16) + '…',
    updatedAt: s.updatedAt
  })));

  console.log('\nRecent ResealOutput docs:');
  reseals.forEach(r => {
    console.log({
      record: r.record,
      listing: r.listing,
      slot: r.slot,
      sig: (r.signature || '').slice(0, 16) + '…',
      ts: r.ts
    });
  });

  console.log('\nRecent QualityScoreEvent docs:');
  quality.forEach(q => {
    console.log({
      listing: q.listing,
      device: q.device,
      slot: q.slot,
      sig: (q.signature || '').slice(0, 16) + '…',
      ts: q.ts
    });
  });

  await client.close();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
