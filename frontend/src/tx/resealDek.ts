import { BN, Program, AnchorProvider, web3 } from "@coral-xyz/anchor";

type ResealDekAccounts = {
  payer: web3.PublicKey;                 // wallet.publicKey; MUST sign
  mxeAccount: web3.PublicKey;
  mempoolAccount: web3.PublicKey;
  executingPool: web3.PublicKey;
  computationAccount: web3.PublicKey;
  compDefAccount: web3.PublicKey;        // PDA for reseal_dek comp def
  poolAccount: web3.PublicKey;           // Arcium fee pool
  clockAccount: web3.PublicKey;          // Arcium clock account
  clusterAccount: web3.PublicKey;
  listingState: web3.PublicKey;          // pointer used by callback event
  purchaseRecord: web3.PublicKey;        // pointer used by callback event
  systemProgram: web3.PublicKey;         // usually web3.SystemProgram.programId
  arciumProgram: web3.PublicKey;         // Arcium program id
};

export async function callResealDek(opts: {
  program: Program;                       // Anchor program for chain_sensors
  provider: AnchorProvider;               // must contain a signing wallet
  accounts: ResealDekAccounts;
  computationOffset: BN | number;         // u64
  nonce: BN | number;                     // u128
  buyerX25519Pubkey: number[];            // length 32
  c0: number[]; c1: number[]; c2: number[]; c3: number[]; // each length 32
}) {
  const {
    program, provider, accounts,
    computationOffset, nonce,
    buyerX25519Pubkey, c0, c1, c2, c3
  } = opts;

  // Hard requirement: wallet MUST sign the transaction as payer.
  // Do not override, proxy, or switch to an unchecked account.
  if (!provider.wallet?.publicKey?.equals(accounts.payer)) {
    throw new Error("payer must be the connected wallet publicKey");
  }

  const txSig = await program.methods
    .resealDek(
      new BN(computationOffset),
      new BN(nonce),
      Uint8Array.from(buyerX25519Pubkey) as any,
      Uint8Array.from(c0) as any,
      Uint8Array.from(c1) as any,
      Uint8Array.from(c2) as any,
      Uint8Array.from(c3) as any
    )
    .accounts({
      payer: accounts.payer,
      mxeAccount: accounts.mxeAccount,
      mempoolAccount: accounts.mempoolAccount,
      executingPool: accounts.executingPool,
      computationAccount: accounts.computationAccount,
      compDefAccount: accounts.compDefAccount,
      poolAccount: accounts.poolAccount,
      clockAccount: accounts.clockAccount,
      clusterAccount: accounts.clusterAccount,
      listingState: accounts.listingState,
      purchaseRecord: accounts.purchaseRecord,
      systemProgram: accounts.systemProgram,
      arciumProgram: accounts.arciumProgram,
    })
    .rpc();

  return txSig;
}
