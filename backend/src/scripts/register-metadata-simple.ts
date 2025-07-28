// backend/scripts/register-metadata-simple.ts

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  Metaplex,
  keypairIdentity,
  irysStorage,
} from '@metaplex-foundation/js';
import * as dotenv from 'dotenv';

dotenv.config();

(async () => {
  try {
    console.log('🚀 Starting simple SENSOR token metadata registration...');

    // 1) Load connection & keypair
    const connection = new Connection(process.env.SOLANA_RPC!, 'confirmed');
    const secret = JSON.parse(process.env.SOLANA_KEYPAIR_JSON!);
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secret));

    console.log('🔑 Wallet Public Key:', wallet.publicKey.toString());
    console.log('📍 Mint:', process.env.SENSOR_MINT);

    // 2) Metaplex instance with Irys storage
    const mx = Metaplex.make(connection)
      .use(keypairIdentity(wallet))
      .use(
        irysStorage({
          address: 'https://devnet.irys.xyz',
          providerUrl: process.env.SOLANA_RPC!,
          timeout: 120000,
        }),
      );

    // 3) Use a working USDC logo for now, we'll update with ChainSensors logo later
    const imageUri =
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png';

    // For now, let's create metadata JSON with a reliable image URL
    const metadataJson = {
      name: 'ChainSensors Token',
      symbol: 'SENSOR',
      description: 'Utility & rewards token for ChainSensors IoT marketplace.',
      image: imageUri,
      properties: {
        files: [
          {
            uri: imageUri,
            type: 'image/png',
          },
        ],
        category: 'image',
      },
      attributes: [
        {
          trait_type: 'Type',
          value: 'Utility Token',
        },
        {
          trait_type: 'Decimals',
          value: '6',
        },
      ],
      external_url: 'https://chainsensors.com',
    };

    console.log('📤 Uploading metadata JSON to Arweave...');

    const { uri } = await mx.nfts().uploadMetadata(metadataJson);
    console.log('✅ Metadata URI:', uri);

    // 4) Update existing metadata
    const mintPubkey = new PublicKey(process.env.SENSOR_MINT!);

    try {
      // Check if metadata already exists
      const metadataPda = mx.nfts().pdas().metadata({ mint: mintPubkey });
      const existingMetadata = await mx.connection.getAccountInfo(metadataPda);

      if (existingMetadata) {
        console.log('📋 Found existing metadata account, updating...');

        try {
          const nft = await mx.nfts().findByMint({ mintAddress: mintPubkey });
          const updateResult = await mx.nfts().update({
            nftOrSft: nft,
            uri,
            name: metadataJson.name,
            symbol: metadataJson.symbol,
          });

          console.log('✅ Metadata updated successfully!');
          console.log('🔗 Transaction:', updateResult.response.signature);
        } catch (updateError) {
          console.log(
            '⚠️  Could not update metadata automatically:',
            updateError.message,
          );
          console.log(
            '📋 Metadata PDA already exists:',
            metadataPda.toString(),
          );
        }
      } else {
        console.log('🆕 Creating new metadata account...');

        const createResult = await mx.nfts().createSft({
          uri,
          name: metadataJson.name,
          symbol: metadataJson.symbol,
          sellerFeeBasisPoints: 0,
          useExistingMint: mintPubkey,
          isMutable: true,
        });

        console.log('✅ Metadata created successfully!');
        console.log('🔗 Transaction:', createResult.response.signature);
      }

      console.log('\n🎉 SENSOR token metadata registration complete!');
      console.log('📍 Mint:', mintPubkey.toString());
      console.log('🔗 Metadata URI:', uri);
      console.log('🖼️  Image URI:', imageUri);
      console.log(
        '📋 Metadata PDA:',
        mx.nfts().pdas().metadata({ mint: mintPubkey }).toString(),
      );
      console.log(
        '\n💡 Tip: It may take a few minutes for wallets and explorers to refresh.',
      );
    } catch (metadataError) {
      console.log(
        '⚠️  Error with on-chain metadata operation:',
        metadataError.message,
      );
      console.log(
        '✅ However, metadata JSON was uploaded successfully to Arweave!',
      );
      console.log('🔗 Metadata URI:', uri);
      console.log('🖼️  Image URI:', imageUri);
      console.log('📍 Mint:', mintPubkey.toString());
    }
  } catch (error) {
    console.error('❌ Error creating metadata:', error);
    process.exit(1);
  }
})();
