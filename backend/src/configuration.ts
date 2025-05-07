// src/configuration.ts
export default () => ({
    BROKER_URL: process.env.BROKER_URL, // MQTT broker
    SOLANA_RPC: process.env.SOLANA_RPC, // RPC endpoint to talk to Solana blockchain
    SOLANA_KEYPAIR_JSON: process.env.SOLANA_KEYPAIR_JSON, // Solana signer key
    WALRUS_URL: process.env.WALRUS_URL, // API endpoint for Walrus (device registry layer)
    SOLANA_PROGRAM_ID: process.env.SOLANA_PROGRAM_ID,
    MARKETPLACE_ADMIN_PUBKEY: process.env.MARKETPLACE_ADMIN_PUBKEY,
    MONGODB_URI : process.env.MONGODB_URI,
    TUSKY_API_KEY: process.env.TUSKY_API_KEY,
    TUSKY_URL: process.env.TUSKY_URL,
    SELLER_FEE_BASIS: process.env.SELLER_FEE_BASIS,
    USDC_MINT: process.env.USDC_MINT,
    MARKETPLACE_NAME: process.env.MARKETPLACE_NAME,
    CA_KEY_PATH: process.env.CA_KEY_PATH,
    CA_CERT_PATH: process.env.CA_CERT_PATH,
    BROKER_KEY_PATH: process.env.BROKER_KEY_PATH,
    BROKER_CERT_PATH: process.env.BROKER_CERT_PATH,
    BROKER_PORT: Number(process.env.BROKER_PORT),
    TLS_KEY_PATH: process.env.BROKER_KEY_PATH,
    TLS_CERT_PATH: process.env.BROKER_CERT_PATH,
    TLS_CA_PATH: process.env.CA_CERT_PATH,
  });
  