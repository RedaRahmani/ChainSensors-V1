// Quick logo update script
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  Metaplex,
  keypairIdentity,
} from '@metaplex-foundation/js';
import * as dotenv from 'dotenv';

dotenv.config();

(async () => {
  try {
    console.log('🚀 Quick SENSOR token logo update...');

    const connection = new Connection(process.env.SOLANA_RPC!, 'confirmed');
    const secret = JSON.parse(process.env.SOLANA_KEYPAIR_JSON!);
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secret));

    const mx = Metaplex.make(connection).use(keypairIdentity(wallet));

    // Use a publicly accessible image URL for now
    const imageUri =
      'https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/phantom/icon.png';

    const metadataJson = {
      name: 'ChainSensors Token',
      symbol: 'SENSOR',
      description: 'Utility & rewards token for ChainSensors IoT marketplace.',
      image: imageUri,
      properties: {
        files: [{ uri: imageUri, type: 'image/png' }],
        category: 'image',
      },
      extensions: { website: 'https://chainsensors.com' },
    };

    const { uri } = await mx.nfts().uploadMetadata(metadataJson);
    console.log('✅ Metadata URI:', uri);

    const mintPubkey = new PublicKey(process.env.SENSOR_MINT!);
    const nft = await mx.nfts().findByMint({ mintAddress: mintPubkey });

    const updateResult = await mx.nfts().update({
      nftOrSft: nft,
      uri,
      name: metadataJson.name,
      symbol: metadataJson.symbol,
    });

    console.log('✅ Updated! Transaction:', updateResult.response.signature);
    console.log('📍 Mint:', mintPubkey.toString());
    console.log('🔗 Metadata URI:', uri);
  } catch (error) {
    console.error('Error:', error);
  }
})();
