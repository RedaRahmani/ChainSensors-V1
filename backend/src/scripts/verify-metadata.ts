// backend/scripts/verify-metadata.ts

import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
import * as dotenv from 'dotenv';

dotenv.config();

(async () => {
  try {
    console.log('🔍 Verifying SENSOR token metadata...');

    // Initialize connection
    const connection = new Connection(process.env.SOLANA_RPC!, 'confirmed');
    const mx = Metaplex.make(connection);

    const mintAddress = new PublicKey(process.env.SENSOR_MINT!);
    console.log('📍 Mint:', mintAddress.toString());

    try {
      // Find metadata
      const nft = await mx.nfts().findByMint({ mintAddress });

      console.log('\n📋 On-chain Metadata:');
      console.log('  Name:', nft.name);
      console.log('  Symbol:', nft.symbol);
      console.log('  URI:', nft.uri);
      console.log('  Update Authority:', nft.updateAuthorityAddress.toString());
      console.log('  Is Mutable:', nft.isMutable);

      if (nft.uri) {
        console.log('\n🌐 Fetching off-chain metadata...');
        try {
          const response = await fetch(nft.uri);
          const offChainMetadata = await response.json();

          console.log('✅ Off-chain Metadata:');
          console.log('  Name:', offChainMetadata.name);
          console.log('  Symbol:', offChainMetadata.symbol);
          console.log('  Description:', offChainMetadata.description);
          console.log('  Image:', offChainMetadata.image);

          if (offChainMetadata.image) {
            console.log('\n🖼️  Testing image URL...');
            try {
              const imageResponse = await fetch(offChainMetadata.image);
              if (imageResponse.ok) {
                console.log('✅ Image is accessible');
                console.log(
                  '  Content-Type:',
                  imageResponse.headers.get('content-type'),
                );
                console.log(
                  '  Size:',
                  imageResponse.headers.get('content-length'),
                  'bytes',
                );
              } else {
                console.log('❌ Image not accessible:', imageResponse.status);
              }
            } catch (imageError) {
              console.log('❌ Error fetching image:', imageError.message);
            }
          }
        } catch (fetchError) {
          console.log(
            '❌ Error fetching off-chain metadata:',
            fetchError.message,
          );
        }
      }

      console.log('\n🎉 Metadata verification complete!');
    } catch (error) {
      console.log('❌ No metadata found for this mint');
      console.log('💡 Run "npm run register-metadata" to create metadata');
    }
  } catch (error) {
    console.error('❌ Error verifying metadata:', error);
    process.exit(1);
  }
})();
