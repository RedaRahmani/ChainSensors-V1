import { AnchorProvider, Program, BN, web3 } from "@coral-xyz/anchor";
import { callResealDek } from "../tx/resealDek";
import { onResealOutput } from "../events/resealOutput";

// This is an example-only function. It must not be auto-invoked.
export async function runResealExample(args: {
  program: Program;
  provider: AnchorProvider;
  accounts: Parameters<typeof callResealDek>[0]["accounts"];
  computationOffset: number;
  nonce: bigint | number;
  buyerX25519Pubkey: number[];
  c0: number[]; c1: number[]; c2: number[]; c3: number[];
}) {
  const { program, provider, accounts, computationOffset, nonce,
          buyerX25519Pubkey, c0, c1, c2, c3 } = args;

  const remove = onResealOutput(program, (e) => {
    // Application can pick up capsule pieces here.
    // Do not mutate chain state here.
    console.log("ResealOutput event:", e);
  });

  try {
    const sig = await callResealDek({
      program, provider, accounts,
      computationOffset, nonce,
      buyerX25519Pubkey, c0, c1, c2, c3
    });
    console.log("reseal_dek tx:", sig);
  } finally {
    await program.removeEventListener(remove);
  }
}
