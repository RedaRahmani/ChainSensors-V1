// Working logo update script
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js';
import * as dotenv from 'dotenv';

dotenv.config();

(async () => {
  try {
    console.log('🚀 Updating SENSOR token metadata...');

    const connection = new Connection(process.env.SOLANA_RPC!, 'confirmed');
    const secret = JSON.parse(process.env.SOLANA_KEYPAIR_JSON!);
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secret));

    console.log('🔑 Wallet:', wallet.publicKey.toString());
    console.log('📍 Mint:', process.env.SENSOR_MINT);

    const mx = Metaplex.make(connection).use(keypairIdentity(wallet));

    // Use this working logo URL for now - it's a good quality token logo
    const imageUri =
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';

    const metadataJson = {
      name: 'ChainSensors Token',
      symbol: 'SENSOR',
      description: 'Utility & rewards token for ChainSensors IoT marketplace.',
      image: imageUri,
      properties: {
        files: [{ uri: imageUri, type: 'image/png' }],
        category: 'image',
      },
    };

    console.log('📤 Uploading metadata...');
    const { uri } = await mx.nfts().uploadMetadata(metadataJson);
    console.log('✅ Metadata URI:', uri);

    console.log('🔄 Updating on-chain metadata...');
    const mintPubkey = new PublicKey(process.env.SENSOR_MINT!);
    const nft = await mx.nfts().findByMint({ mintAddress: mintPubkey });

    const updateResult = await mx.nfts().update({
      nftOrSft: nft,
      uri,
      name: metadataJson.name,
      symbol: metadataJson.symbol,
    });

    console.log('\n✅ SUCCESS! Metadata updated!');
    console.log('🔗 Transaction:', updateResult.response.signature);
    console.log('📍 Mint:', mintPubkey.toString());
    console.log('🔗 Metadata URI:', uri);
    console.log('🖼️  Image URI:', imageUri);
    console.log('\n💡 Logo will appear in wallets within 5-10 minutes!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
