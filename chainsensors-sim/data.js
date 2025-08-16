

const fs       = require('fs');
const path     = require('path');
const mqtt     = require('mqtt');
const forge    = require('node-forge');
const readline = require('readline');

// ——— CONFIG ———
const DEVICE_ID    = process.env.DEVICE_ID    || 'saad-air-2025';
const BROKER_URL   = process.env.BROKER_URL   || 'mqtts://localhost:8881';
const CA_CERT_PATH = process.env.CA_CERT_PATH || path.join(__dirname, 'ca-cert.pem');
const DATA_FILE    = path.join(__dirname, 'data.json');
// —————————

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// load and parse the data.json once at startup
let sensorData = [];
try {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  sensorData = JSON.parse(raw);
  if (!Array.isArray(sensorData) || sensorData.length === 0) {
    console.error('❌ data.json is empty or not an array');
    process.exit(1);
  }
} catch (err) {
  console.error(`❌ Failed to load ${DATA_FILE}:`, err.message);
  process.exit(1);
}

function prompt() {
  console.log(`
📡  Sensor Agent CLI
Device ID: ${DEVICE_ID}

Select an option:
  1) Initialize device (generate key + CSR)
  2) Start sensor (load cert + key & publish from data.json)
  q) Quit
`);
  rl.question('> ', async (cmd) => {
    switch (cmd.trim()) {
      case '1':
        await initDevice();
        break;
      case '2':
        await startSensor();
        break;
      case 'q':
      case 'Q':
        console.log('Goodbye!');
        return rl.close();
      default:
        console.log('Unknown option');
    }
    prompt();
  });
}

async function initDevice() {
  console.log('🔑 Generating RSA keypair (2048-bit)…');
  const keys = forge.pki.rsa.generateKeyPair(2048);

  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const csr    = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([{ name: 'commonName', value: DEVICE_ID }]);
  csr.sign(keys.privateKey, forge.md.sha256.create());
  const csrPem = forge.pki.certificationRequestToPem(csr);

  const keyPath = `${DEVICE_ID}-key.pem`;
  const csrPath = `${DEVICE_ID}.csr.pem`;

  fs.writeFileSync(keyPath, keyPem, 'utf8');
  fs.writeFileSync(csrPath, csrPem, 'utf8');

  console.log(`✅ Private key written to ./${keyPath}`);
  console.log(`✅ CSR written to ./${csrPath}`);
  console.log(`\nNext: paste ./${csrPath} into your Chainsensors UI (Enroll) to retrieve your device certificate.\n`);
}

async function startSensor() {
  const keyPath  = `${DEVICE_ID}-key.pem`;
  const certPath = `${DEVICE_ID}-cert.pem`;

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error(`
✋  Missing key or certificate files. Please:
  • Ensure ./${keyPath} exists (from init)
  • Ensure ./${certPath} exists (from Chainsensors enroll response)
`);
    return;
  }

  const keyPem  = fs.readFileSync(keyPath);
  const certPem = fs.readFileSync(certPath);
  const caPem   = fs.readFileSync(CA_CERT_PATH);

  console.log(`🌐 Connecting to broker ${BROKER_URL} with mTLS…`);
  const client = mqtt.connect(BROKER_URL, {
    key: keyPem,
    cert: certPem,
    ca: caPem,
    rejectUnauthorized: true,
  });

  client.on('connect', () => {
    console.log(`✅ Connected! Publishing one record per second from data.json…`);
    let idx = 0;

    setInterval(() => {
      const record = sensorData[idx];
      const topic  = `devices/${DEVICE_ID}/data`;
      client.publish(topic, JSON.stringify(record), { qos: 1 }, (err) => {
        if (err) {
          console.error('❌ Publish failed:', err);
        }
      });
      console.log(`📤 [${idx + 1}/${sensorData.length}] Published to "${topic}":`, record);

      idx = (idx + 1) % sensorData.length;
    }, 1000);
  });

  client.on('error', (err) => {
    console.error('🔌 MQTT error:', err);
  });
}

prompt();
