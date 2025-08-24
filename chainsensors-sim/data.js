const fs       = require('fs');
const path     = require('path');
const mqtt     = require('mqtt');
const forge    = require('node-forge');
const readline = require('readline');
const crypto   = require('crypto');

// ——— CONFIG ———
const DEVICE_ID     = process.env.DEVICE_ID     || 'safe-2025';
const BROKER_URL    = process.env.BROKER_URL    || 'mqtts://localhost:8881';
const CA_CERT_PATH  = process.env.CA_CERT_PATH  || path.join(__dirname, 'ca-cert.pem');
const BACKEND_URL   = process.env.BACKEND_URL   || 'http://localhost:3003'; // for /capsules/upload
const DATA_FILE     = path.join(__dirname, 'data.json');
const DEK_FILE      = path.join(__dirname, `${DEVICE_ID}.dek`);              // raw 32 bytes
const CAPSULE_FILE  = path.join(__dirname, `${DEVICE_ID}.mxe_capsule.blobId`);
// —————————

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

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
  2) Start sensor (encrypt with DEK, publish envelopes, ensure capsule)
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

// ---------- DEK helpers ----------
function ensureDekBytes() {
  try {
    const dek = fs.readFileSync(DEK_FILE);
    if (dek.length === 32) return dek;
    console.warn('⚠️ DEK file exists but has wrong length. Regenerating.');
  } catch {}
  const dek = crypto.randomBytes(32);
  fs.writeFileSync(DEK_FILE, dek);
  console.log(`🔐 Generated new 32-byte DEK and saved to ${path.basename(DEK_FILE)} (keep this safe).`);
  return dek;
}
function b64(u8) { return Buffer.from(u8).toString('base64'); }

// Encrypt one JSON record with AES-256-GCM
function encryptRecord(dek, obj) {
  const iv  = crypto.randomBytes(12);
  const aad = Buffer.from(DEVICE_ID); // optional AAD binding to device
  const plain = Buffer.from(JSON.stringify(obj), 'utf8');

  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
  cipher.setAAD(aad);
  const ct  = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Envelope format (self-describing JSON)
  return {
    v: 1,
    alg: 'AES-256-GCM',
    deviceId: DEVICE_ID,
    ts: new Date().toISOString(),
    iv:  b64(iv),
    tag: b64(tag),
    aad: b64(aad),
    ct:  b64(ct),
  };
}

// Ensure MXE capsule exists for this DEK and store blobId locally
async function ensureMxeCapsule(dek) {
  try {
    const id = fs.readFileSync(CAPSULE_FILE, 'utf8').trim();
    if (id) return id;
  } catch {}

  const dekBase64 = b64(dek);
  const res = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/capsules/upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dekBase64 }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`capsule upload failed: ${res.status} ${text}`);
  }
  const { blobId } = await res.json();
  fs.writeFileSync(CAPSULE_FILE, String(blobId));
  console.log(`🧪 MXE capsule uploaded: blobId=${blobId}`);
  console.log(`   Saved to ${path.basename(CAPSULE_FILE)} — use this in "DEK Capsule blobId (Walrus)" when creating a listing.`);
  return blobId;
}

// ---------- Device PKI (unchanged) ----------
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

// ---------- Encrypted publishing ----------
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

  // DEK + MXE capsule
  const dek = ensureDekBytes();
  try { await ensureMxeCapsule(dek); }
  catch (e) {
    console.error('❌ Failed to create MXE capsule:', e.message);
    console.error('   You can still publish data, but remember to create/upload the capsule before listing.');
  }

  console.log(`🌐 Connecting to broker ${BROKER_URL} with mTLS…`);
  const client = mqtt.connect(BROKER_URL, {
    key: keyPem,
    cert: certPem,
    ca: caPem,
    rejectUnauthorized: true,
  });

  client.on('connect', () => {
    console.log(`✅ Connected! Publishing encrypted envelopes (AES-256-GCM) one per second…`);
    let idx = 0;

    setInterval(() => {
      const record = sensorData[idx];
      const envelope = encryptRecord(dek, record);
      const topic  = `devices/${DEVICE_ID}/data`;

      client.publish(topic, JSON.stringify(envelope), { qos: 1 }, (err) => {
        if (err) console.error('❌ Publish failed:', err);
      });

      console.log(`🔒 [${idx + 1}/${sensorData.length}] ${topic}: iv=${envelope.iv.slice(0,8)}… tag=${envelope.tag.slice(0,8)}…`);

      idx = (idx + 1) % sensorData.length;
    }, 1000);
  });

  client.on('error', (err) => {
    console.error('🔌 MQTT error:', err);
  });
}

prompt();
