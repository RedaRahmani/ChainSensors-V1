#!/usr/bin/env ts-node

import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

const BACKEND_URL = 'http://localhost:3003';
const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const SENSOR_MINT =
  process.env.SENSOR_MINT || 'qYPF5D94YCN3jfvsdM92Qfu2CukFFbbMmJyHgE6iZUV';

async function simulateDeviceRegistration() {
  const testUserWallet = '6dSk7LHZWmfw2ZJyCQsFd4z4Wjt9dUqAKAxKg3BmHQS'; // Use the existing test wallet

  console.log('🧪 Starting device registration simulation...');
  console.log(`👤 Test user wallet: ${testUserWallet}`);
  console.log(`🪙 SENSOR mint: ${SENSOR_MINT}`);

  // 1. Call device registration endpoint
  const enrollPayload = {
    csrPem: `-----BEGIN CERTIFICATE REQUEST-----
MIICVjCCAT4CAQAwETEPMA0GA1UEAxMGdGVzdC0xMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEApQyC1+maO4Aq6NO2bf70DiQ9FjzalKlxZsZZxbuVAQxr
CAEC6xaY31PENUv1L7Mx2QXKrnXsb6/Y91CZKbnhaREs7aFhJXpCiLKrni7v/fXm
L8H2DTcPsv2q7cuvrkYBetfMNlTvC6xwspvoDvi+BMUTbItzTOE4xZDxZiSb2nUA
DghCZVgb5wIroO2MCRS8hRWhsQh6EMfJYwC2skmJwcV9Dxvs57GF4v3ZP6Lvm0ZI
1ue5fOSBP2kL8z0QzLQmIHpuCwtiUuG20XVnbOQ/N6G10n8NS1bOhPlTe5uozc8u
qzfuek2V9LD1QP3Mf/F4Z3GDIDGECzoXKiHb7jmjNQIDAQABoAAwDQYJKoZIhvcN
AQELBQADggEBABPF+1K+iLT7W30LQv59b84CyP0c4vzKhojtRiZs2N/nkgeyiiSO
ykDEnisCa+jbFd6AWSatm8Ys/qsS0Jzqq5uBh14+Atr3HYPVK9Gzuj6RLlN59Qeb
7tvm/eRyJYYGwZcFGFbe6MaJfQvdpK3NV+jJiRa45F/pQAcmpfMSunujaFp/7gCC
dhgRFrHa1yunpAmjsqHL4Tcmve+I1pwvan37lU+sbHGmjiM8U+DpV5SXsE0lsA9Y
PQGe1dPfGtZhzG9HUodFFcHdQ7GOzRbGJ4nhbRBL5MuN1m4gtgJmPTxnxuFpw478
0thsZ2D8rzAgusjBYH0Zm9sUVaCIciamZGs=
-----END CERTIFICATE REQUEST-----`,
    metadata: {
      deviceName: 'Test Device',
      model: 'simulation_test',
      location: { latitude: 40.7128, longitude: -74.006 },
      dataTypes: [{ type: 'test_data', units: 'unit', frequency: '1Hz' }],
      pricePerUnit: 1,
      totalDataUnits: 100,
    },
    sellerPubkey: testUserWallet,
    token: 'test-token-' + Date.now(),
  };

  try {
    console.log('📝 Calling /dps/enroll...');
    const enrollResponse = await axios.post(
      `${BACKEND_URL}/dps/enroll`,
      enrollPayload,
    );
    const { deviceId, unsignedTx } = enrollResponse.data;
    console.log(`✅ Device enrolled: ${deviceId}`);

    // 2. Simulate signing and finalize
    console.log('✍️  Calling /dps/finalize...');
    const finalizeResponse = await axios.post(`${BACKEND_URL}/dps/finalize`, {
      deviceId,
      signedTx: unsignedTx, // In real flow, this would be signed by user wallet
    });

    const { txSignature } = finalizeResponse.data;
    console.log(`✅ Registration finalized: ${txSignature}`);

    // 3. Wait for reward processing
    console.log('⏳ Waiting 5 seconds for reward processing...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 4. Check SENSOR token balance
    console.log('🔍 Checking SENSOR token balance...');
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const userPubkey = new PublicKey(testUserWallet);
    const mintPubkey = new PublicKey(SENSOR_MINT);

    const ata = await getAssociatedTokenAddress(mintPubkey, userPubkey);
    console.log(`🏦 User's SENSOR ATA: ${ata.toBase58()}`);

    try {
      const tokenAccount = await getAccount(connection, ata);
      const balance = Number(tokenAccount.amount) / Math.pow(10, 6); // 6 decimals
      console.log(`🎉 User got ${balance} SENSOR tokens!`);
    } catch (error) {
      console.log(
        `❌ No SENSOR tokens found or ATA doesn't exist: ${error.message}`,
      );
    }
  } catch (error) {
    console.error(
      '❌ Registration simulation failed:',
      error.response?.data || error.message,
    );
    process.exit(1);
  }
}

if (require.main === module) {
  simulateDeviceRegistration().catch(console.error);
}
