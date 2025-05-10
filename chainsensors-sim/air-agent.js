// air-agent.js
const fs    = require('fs');
const axios = require('axios');
const mqtt  = require('mqtt');
const { generateKeyAndCsr, savePem } = require('./common');

const deviceId = 'AIR001';

// 1. CSR
const { privateKeyPem, csrPem } = generateKeyAndCsr(deviceId);
savePem('air-key.pem', privateKeyPem);
savePem('air.csr.pem', csrPem);

// 2. Enroll
(async () => {
  const { data } = await axios.post('http://localhost:3001/dps/enroll', {
    csrPem,
    metadata: {
      deviceName: 'Air Quality Sensor',
      model: 'PMS5001',
      location: { latitude: 51.5074, longitude: -0.1278 },
      dataTypes: [
        { type: 'pm2_5',    units: 'µg/m³', frequency: '0.5Hz' },
        { type: 'temperature', units: '°C', frequency: '0.5Hz' }
      ],
      pricePerUnit: 15.2,
      totalDataUnits: 43200
    }
  });
  fs.writeFileSync('air-cert.pem', data.certificatePem);

  // 3. Connect
  const client = mqtt.connect(data.brokerUrl, {
    key: fs.readFileSync('air-key.pem'),
    cert: fs.readFileSync('air-cert.pem'),
    //: fs.readFileSync('../ca-cert.pem'),
    ca: fs.readFileSync('../backend/ca-cert.pem'),
    rejectUnauthorized: true
  });

  client.on('connect', () => {
    console.log('🌫️ Air sensor connected');

    setInterval(() => {
      const pm25 = parseFloat((5 + Math.random()*10).toFixed(1));
      const pm10 = parseFloat((pm25 + Math.random()*5).toFixed(1));
      const voc  = Math.round(100 + Math.random()*50);
      const temp = parseFloat((20 + Math.random()*2 - 1).toFixed(1));
      const rh   = Math.round(40 + Math.random()*20);
      const payload = { timestamp: new Date().toISOString(), pm2_5: pm25, pm10_0: pm10, voc_index: voc, temperature_c: temp, humidity_pct: rh };
      client.publish(`devices/${deviceId}/data`, JSON.stringify(payload));
      console.log('📤', payload);
    }, 2000);
  });
})();
