// Simple logo update for SENSOR token - Direct approach
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js';
import * as dotenv from 'dotenv';

dotenv.config();

(async () => {
  try {
    console.log('🚀 Updating SENSOR token with ChainSensors logo...');

    const connection = new Connection(process.env.SOLANA_RPC!, 'confirmed');
    const secret = JSON.parse(process.env.SOLANA_KEYPAIR_JSON!);
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secret));

    console.log('🔑 Wallet:', wallet.publicKey.toString());
    console.log('📍 Mint:', process.env.SENSOR_MINT);

    // Use Metaplex without Irys - just for updating existing metadata
    const mx = Metaplex.make(connection).use(keypairIdentity(wallet));

    // Your ChainSensors logo hosted on GitHub
    const imageUri =
      'https://raw.githubusercontent.com/khadira1937/chainsensors-assets/main/logos/sensor-logo-011.png';
    console.log('🖼️  Using ChainSensors logo:', imageUri);

    // Create metadata JSON that we'll upload to a simple service
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

    // Create a simple metadata URI using GitHub as well
    const metadataUri =
      'https://raw.githubusercontent.com/khadira1937/chainsensors-assets/main/metadata/sensor-token-metadata.json';
    console.log('📤 Using metadata URI:', metadataUri);

    console.log('🔄 Updating on-chain metadata...');
    const mintPubkey = new PublicKey(process.env.SENSOR_MINT!);

    try {
      const nft = await mx.nfts().findByMint({ mintAddress: mintPubkey });

      const updateResult = await mx.nfts().update({
        nftOrSft: nft,
        uri: metadataUri,
        name: metadataJson.name,
        symbol: metadataJson.symbol,
      });

      console.log('\n✅ SUCCESS! ChainSensors token updated!');
      console.log('🔗 Transaction:', updateResult.response.signature);
      console.log('📍 Mint:', mintPubkey.toString());
      console.log('🔗 Metadata URI:', metadataUri);
      console.log('🖼️  Image URI:', imageUri);
      console.log(
        '\n💡 ChainSensors logo will appear in wallets within 5-10 minutes!',
      );
    } catch (updateError) {
      console.log('⚠️  Direct update failed, trying alternative...');
      console.log('Error:', updateError.message);

      // Fallback: Just log the URLs for manual update
      console.log('\n📋 Manual update info:');
      console.log('Mint:', mintPubkey.toString());
      console.log('Metadata URI needed:', metadataUri);
      console.log('Image URI:', imageUri);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
