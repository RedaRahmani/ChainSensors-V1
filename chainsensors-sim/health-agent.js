// health-agent.js
const fs    = require('fs');
const axios = require('axios');
const mqtt  = require('mqtt');
const { generateKeyAndCsr, savePem } = require('./common');

const deviceId   = 'HEALTH001';
const baselineHR = 70;

// 1. Key + CSR
const { privateKeyPem, csrPem } = generateKeyAndCsr(deviceId);
savePem('health-key.pem', privateKeyPem);
savePem('health.csr.pem', csrPem);

// 2. Enroll
(async () => {
  const { data } = await axios.post('http://localhost:3000/dps/enroll', {
    csrPem,
    metadata: {
      deviceName: 'Wearable HRM',
      model: 'HRM-2000',
      location: { latitude: 40.7128, longitude: -74.0060 },
      dataTypes: [
        { type: 'heart_rate', units: 'bpm', frequency: '1Hz' },
        { type: 'spo2',       units: '%',  frequency: '1Hz' }
      ],
      pricePerUnit: 15.005,
      totalDataUnits: 86400
    }
  });
  fs.writeFileSync('health-cert.pem', data.certificatePem);

  // 3. MQTT over mTLS
  const client = mqtt.connect(data.brokerUrl, {
    key: fs.readFileSync('health-key.pem'),
    cert: fs.readFileSync('health-cert.pem'),
    ca: fs.readFileSync('../backend/ca-cert.pem'),
    rejectUnauthorized: true
  });

  client.on('connect', () => {
    console.log('❤️ Health sensor connected');

    setInterval(() => {
      const hr   = baselineHR + Math.round(Math.random()*4 - 2);
      const spo2 = 95 + (Math.random() > 0.9 ? 2 : 0);
      const payload = { timestamp: new Date().toISOString(), heart_rate_bpm: hr, spo2_pct: spo2 };
      client.publish(`devices/${deviceId}/data`, JSON.stringify(payload));
      console.log('📤', payload);
    }, 1000);
  });
})();
