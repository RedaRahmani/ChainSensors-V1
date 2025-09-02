// scripts/validate-arcium-env.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { Connection, PublicKey } = require('@solana/web3.js');
const client = require('@arcium-hq/client');

(async () => {
  const http = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
  const conn = new Connection(http, { commitment: 'confirmed' });

  // Handle missing SOLANA_PROGRAM_ID gracefully
  const programIdStr = process.env.SOLANA_PROGRAM_ID;
  if (!programIdStr) {
    console.error('❌ SOLANA_PROGRAM_ID environment variable is required');
    process.exit(1);
  }
  
  const programId = new PublicKey(programIdStr);
  const arciumPid = client.getArciumProgAddress();

  const rows = [];
  const ok = (name, extra={}) => rows.push({ check: name, ok: true, ...extra });
  const fail = (name, extra={}) => rows.push({ check: name, ok: false, ...extra });
  const pk = (s) => { try { return new PublicKey(s); } catch { return null; } };

  // Cluster (prefer explicit pubkey; else derive from offset)
  const clusterPk =
    pk(process.env.ARCIUM_CLUSTER_PUBKEY) ??
    (process.env.ARCIUM_CLUSTER_OFFSET ? client.getClusterAccAddress(Number(process.env.ARCIUM_CLUSTER_OFFSET)) : null);
  if (!clusterPk) {
    fail('cluster', { reason: 'missing ARCIUM_CLUSTER_PUBKEY or ARCIUM_CLUSTER_OFFSET' });
  } else {
    const info = await conn.getAccountInfo(clusterPk, 'confirmed');
    if (info && info.owner.equals(arciumPid)) ok('cluster', { pubkey: clusterPk.toBase58() });
    else fail('cluster', { pubkey: clusterPk.toBase58(), owner: info?.owner?.toBase58() });
  }

  // Fee pool must be owned by Arcium
  const feePoolPk = pk(process.env.ARCIUM_FEE_POOL_ACCOUNT);
  if (!feePoolPk) {
    fail('fee_pool', { reason: 'ARCIUM_FEE_POOL_ACCOUNT not set' });
  } else {
    const info = await conn.getAccountInfo(feePoolPk, 'confirmed');
    if (info && info.owner.equals(arciumPid)) ok('fee_pool', { pubkey: feePoolPk.toBase58() });
    else fail('fee_pool', { pubkey: feePoolPk.toBase58(), owner: info?.owner?.toBase58() });
  }

  // Executing Pool: your env vs the derived address for your app program
  const expectedExec = client.getExecutingPoolAccAddress(programId);
  const configuredExec = pk(process.env.ARCIUM_EXECUTING_POOL_PUBKEY);
  if (configuredExec && configuredExec.equals(expectedExec)) {
    ok('executing_pool', { pubkey: configuredExec.toBase58() });
  } else {
    fail('executing_pool', {
      configured: configuredExec?.toBase58() || '(unset)',
      expected: expectedExec.toBase58(),
    });
  }

  // Reseal comp-def PDA: derive from name; ensure override (if any) matches and account exists
  const resealName = process.env.ARCIUM_RESEAL_COMP_NAME || 'reseal_dek';
  const resealIdx = Buffer.from(client.getCompDefAccOffset(resealName)).readUInt32LE();
  const resealPda = client.getCompDefAccAddress(programId, resealIdx);
  const overridePda = pk(process.env.ARCIUM_COMP_DEF_PDA);
  if (overridePda && !overridePda.equals(resealPda)) {
    fail('comp_def_reseal_dek', {
      expected: resealPda.toBase58(),
      override: overridePda.toBase58(),
      reason: 'override != derived PDA',
    });
  } else {
    const info = await conn.getAccountInfo(resealPda, 'confirmed');
    if (info) ok('comp_def_reseal_dek', { pda: resealPda.toBase58(), owner: info.owner.toBase58() });
    else fail('comp_def_reseal_dek', { pda: resealPda.toBase58(), reason: 'account not found' });
  }

  // Accuracy comp-def must exist on-chain for your new circuit
  try {
    const accIdx = Buffer.from(client.getCompDefAccOffset('compute_accuracy_score')).readUInt32LE();
    const accPda = client.getCompDefAccAddress(programId, accIdx);
    const info = await conn.getAccountInfo(accPda, 'confirmed');
    if (info) ok('comp_def_compute_accuracy_score', { pda: accPda.toBase58(), owner: info.owner.toBase58() });
    else fail('comp_def_compute_accuracy_score', { pda: accPda.toBase58(), reason: 'account not found (initialize this comp-def on-chain)' });
  } catch (e) {
    fail('comp_def_compute_accuracy_score', { reason: String(e) });
  }

  // MXE account exists?
  try {
    const mxe = client.getMXEAccAddress(programId);
    const info = await conn.getAccountInfo(mxe, 'confirmed');
    if (info) ok('mxe_account', { pubkey: mxe.toBase58(), owner: info.owner.toBase58() });
    else fail('mxe_account', { pubkey: mxe.toBase58(), reason: 'not found' });
  } catch (e) {
    fail('mxe_account', { reason: String(e) });
  }

  // Print summary
  console.table(rows.map(r => ({ check: r.check, ok: r.ok, ...r })));
  const failures = rows.filter(r => !r.ok).length;
  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('\nAll Arcium env checks passed.');
  }
})();
