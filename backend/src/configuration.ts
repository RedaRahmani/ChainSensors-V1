// src/configuration.ts
export default () => ({
    BROKER_URL: process.env.BROKER_URL, // MQTT broker
    SOLANA_RPC: process.env.SOLANA_RPC, // RPC endpoint to talk to Solana blockchain
    SOLANA_KEYPAIR_JSON: process.env.SOLANA_KEYPAIR_JSON, // Solana signer key
    WALRUS_URL: process.env.WALRUS_URL, // API endpoint for Walrus (device registry layer)
  });
  