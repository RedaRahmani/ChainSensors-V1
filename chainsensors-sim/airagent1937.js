// air-agent.js
const fs    = require('fs');
const axios = require('axios');
const mqtt  = require('mqtt');
const { generateKeyAndCsr, savePem } = require('./common');

// Load from env or config file:
const DEVICE_ID     = process.env.DEVICE_ID || 'AIR852';
const SELLER_PUBKEY ='5hPFyQTTrdmsCKHC2RALojX263vnXnt7Ss7djWE9D45H'        // ← new
if (!SELLER_PUBKEY) {
  throw new Error('Please set SELLER_PUBKEY env var to your wallet address');
}

// 1) Generate key + CSR
const { privateKeyPem, csrPem } = generateKeyAndCsr(DEVICE_ID);
savePem(`${DEVICE_ID}-key.pem`, privateKeyPem);
savePem(`${DEVICE_ID}.csr.pem`, csrPem);

// 2) Enroll with the frontend proxy
;(async () => {
  const enrollUrl = 'http://localhost:3001/dps/enroll';
  const { data } = await axios.post(enrollUrl, {
    csrPem,
    metadata: {
      deviceName: 'Air Quality Sensor',
      model: 'PMS5001',
      location: { latitude: 51.5074, longitude: -0.1278 },
      dataTypes: [
        { type: 'pm2_5',      units: 'µg/m³', frequency: '0.5Hz' },
        { type: 'temperature', units: '°C',    frequency: '0.5Hz' }
      ],
      pricePerUnit: 15.2,
      totalDataUnits: 43200
    },
    sellerPubkey: SELLER_PUBKEY,           // ← pass it through
  });

  const {
    deviceId,
    brokerUrl,
    certificatePem,
    unsignedTx,
  } = data;

  // save the device certificate for MQTT
  savePem(`${deviceId}-cert.pem`, certificatePem);

  console.log('🔐 Enrollment complete:');
  console.log('- deviceId:', deviceId);
  console.log('- brokerUrl:', brokerUrl);
  console.log('- certificatePem saved to:', `${deviceId}-cert.pem`);
  console.log('- unsignedTx (base64):', unsignedTx);

  // If you wanted to *also* finalize on-chain headless, you'd:
  // 1) locally sign unsignedTx with your Solana keypair
  // 2) POST signedTx to /api/dps/finalize
  //
  // But for now, we'll stop here and let the UI step handle finalize.

  // 3) Connect to MQTT and start publishing
  const client = mqtt.connect(brokerUrl, {
    key: fs.readFileSync(`${deviceId}-key.pem`),
    cert: fs.readFileSync(`${deviceId}-cert.pem`),
    ca:   fs.readFileSync('../backend/ca-cert.pem'),
    rejectUnauthorized: true,
  });

  client.on('connect', () => {
    console.log('🌫️ Air sensor connected');

    setInterval(() => {
      const pm25 = parseFloat((5 + Math.random()*10).toFixed(1));
      const pm10 = parseFloat((pm25 + Math.random()*5).toFixed(1));
      const voc  = Math.round(100 + Math.random()*50);
      const temp = parseFloat((20 + Math.random()*2 - 1).toFixed(1));
      const rh   = Math.round(40 + Math.random()*20);
      const payload = {
        timestamp: new Date().toISOString(),
        pm2_5:     pm25,
        pm10_0:    pm10,
        voc_index: voc,
        temperature_c: temp,
        humidity_pct:  rh
      };
      client.publish(`devices/${deviceId}/data`, JSON.stringify(payload));
      console.log('📤', payload);
    }, 2000);
  });
})();
