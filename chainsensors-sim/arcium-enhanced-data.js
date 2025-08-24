/* eslint-disable no-console */
const fs       = require('fs');
const path     = require('path');
const mqtt     = require('mqtt');
const forge    = require('node-forge');
const readline = require('readline');
const crypto   = require('crypto');

// ——— CONFIG ———
const DEVICE_ID     = process.env.DEVICE_ID     || 'pitasa-2026';
const BROKER_URL    = process.env.BROKER_URL    || 'mqtts://localhost:8881';
const CA_CERT_PATH  = process.env.CA_CERT_PATH  || path.join(__dirname, 'ca-cert.pem');
const BACKEND_URL   = (process.env.BACKEND_URL  || 'http://localhost:3003').replace(/\/+$/, '');
const DATA_FILE     = path.join(__dirname, 'data.json');
const DEK_FILE      = path.join(__dirname, `${DEVICE_ID}.dek`);
const METADATA_FILE = path.join(__dirname, `${DEVICE_ID}.metadata.json`);
// Optional override for primary device endpoint (e.g. "/dps/device" or "/devices")
const DEVICE_ENDPOINT_BASE = (process.env.DEVICE_ENDPOINT_BASE || '/dps/device').replace(/\/+$/, '');
// —————————

// Node 18+ has global fetch. If missing, lazy-load node-fetch.
const _fetch = (...args) =>
  (typeof fetch === 'function'
    ? fetch(...args)
    : import('node-fetch').then(m => m.default(...args)));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Load sensor data
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
🚀 ARCIUM-ENHANCED Sensor Agent CLI
Device ID: ${DEVICE_ID}

Select an option:
  1) Initialize device (generate key + CSR)
  2) Fetch device metadata & DEK (after DPS enrollment)
  3) Start sensor (encrypt with Arcium DEK, publish envelopes)
  4) Test decrypt (verify DEK works)
  q) Quit
`);
  rl.question('> ', async (cmd) => {
    switch (cmd.trim()) {
      case '1':
        await initDevice();
        break;
      case '2':
        await fetchDeviceMetadata();
        break;
      case '3':
        await startSensor();
        break;
      case '4':
        await testDecrypt();
        break;
      case 'q':
      case 'Q':
        console.log('Goodbye!');
        rl.close();
        return;
      default:
        console.log('Unknown option');
    }
    prompt();
  });
}

// ============================================================================
// HTTP helpers with DEBUG
// ============================================================================

async function getJsonWithDebug(url) {
  const t0 = Date.now();
  console.log(`🔎 GET ${url}`);
  try {
    const res = await _fetch(url, { method: 'GET' });
    const text = await res.text();
    const ms = (Date.now() - t0).toFixed(1);
    console.log(`   ↳ status=${res.status} ok=${res.ok} ms=${ms}`);
    const preview = text.length > 600 ? text.slice(0, 600) + '…' : text;
    console.log(`   ↳ body: ${preview}`);
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { ok: res.ok, status: res.status, text, json };
  } catch (e) {
    console.log(`   ↳ error: ${e?.message}`);
    return { ok: false, status: 0, text: String(e?.message || 'fetch error'), json: null };
  }
}

async function fetchDeviceDoc(deviceId) {
  // Try configured base first (default /dps/device/:id)
  const tries = [
    `${BACKEND_URL}${DEVICE_ENDPOINT_BASE}/${encodeURIComponent(deviceId)}`,
    // Fallbacks:
    `${BACKEND_URL}/dps/device/${encodeURIComponent(deviceId)}`,
    `${BACKEND_URL}/devices/${encodeURIComponent(deviceId)}`,
    `${BACKEND_URL}/dps/device?id=${encodeURIComponent(deviceId)}`,
  ];

  for (const url of tries) {
    const r = await getJsonWithDebug(url);
    if (r.ok && r.json && typeof r.json === 'object') {
      return { source: url, doc: r.json };
    }
    // 404s -> try next. 401/403 -> still try others.
  }
  return { source: null, doc: null };
}

async function fetchWalrusBlob(cid) {
  // Use backend's Walrus proxy (exposed in your Nest app)
  const url = `${BACKEND_URL}/walrus/blobs/${encodeURIComponent(cid)}`;
  const r = await getJsonWithDebug(url);
  if (r.ok && r.json) return r.json;
  throw new Error(`Walrus blob fetch failed for ${cid}, status=${r.status}`);
}

// ============================================================================
// 🚀 ARCIUM INTEGRATION - DEVICE DEK MANAGEMENT
// ============================================================================

/**
 * Fetch device metadata from backend after DPS enrollment
 * Retrieves the Arcium-generated DEK for this device (or via Walrus if needed)
 */
async function fetchDeviceMetadata() {
  console.log(`🔍 Fetching device metadata for: ${DEVICE_ID}`);
  try {
    const { source, doc } = await fetchDeviceDoc(DEVICE_ID);
    if (!doc) {
      throw new Error(`No device doc found on any known endpoint (see debug above).`);
    }

    console.log(`✅ Device doc retrieved from: ${source}`);

    // Persist raw doc for inspection
    fs.writeFileSync(METADATA_FILE, JSON.stringify(doc, null, 2));
    console.log(`💾 Raw device doc saved to: ${path.basename(METADATA_FILE)}`);

    let dekB64 = doc.dekPlaintextB64;
    let capsuleCid = doc.dekCapsuleForMxeCid;

    // If DEK not present in the doc, try via Walrus metadataCid
    if (!dekB64 && doc.metadataCid) {
      console.log(`ℹ️  Device doc lacks DEK; trying Walrus metadataCid: ${doc.metadataCid}`);
      const meta = await fetchWalrusBlob(doc.metadataCid);
      console.log('   ↳ Walrus metadata keys:', Object.keys(meta || {}));
      if (meta && meta.dekPlaintextB64) {
        dekB64 = meta.dekPlaintextB64;
      }
      if (!capsuleCid && meta && meta.dekCapsuleForMxeCid) {
        capsuleCid = meta.dekCapsuleForMxeCid;
      }
      // Save merged metadata for convenience
      const merged = { ...doc, __walrus__: meta };
      fs.writeFileSync(METADATA_FILE, JSON.stringify(merged, null, 2));
      console.log(`💾 Merged metadata saved to: ${path.basename(METADATA_FILE)}`);
    }

    if (!dekB64) {
      throw new Error(`DEK not found in device doc or Walrus metadata. (Check DPS enrollment flow)`);
    }

    const dekBytes = Buffer.from(dekB64, 'base64');
    if (dekBytes.length !== 32) {
      throw new Error(`Invalid DEK length: ${dekBytes.length} (expected 32 bytes)`);
    }

    fs.writeFileSync(DEK_FILE, dekBytes);
    console.log(`🔐 Arcium DEK saved to: ${path.basename(DEK_FILE)}`);
    if (capsuleCid) {
      console.log(`🎯 DEK Capsule CID: ${capsuleCid}`);
    } else {
      console.log('ℹ️  No capsule CID on record.');
    }

  } catch (error) {
    console.error(`❌ Failed to fetch device metadata: ${error.message}`);
    console.log(`\n💡 Make sure:`);
    console.log(`   1. Device is enrolled via DPS service`);
    console.log(`   2. Backend is running on ${BACKEND_URL}`);
    console.log(`   3. The running backend exposes GET /dps/device/:deviceId (or try DEVICE_ENDPOINT_BASE env)`);
    console.log(`   4. If only metadataCid is present, Walrus blob must contain dekPlaintextB64`);
  }
}

/**
 * Load Arcium-generated DEK for this device
 */
function loadArciumDek() {
  try {
    const dek = fs.readFileSync(DEK_FILE);
    if (dek.length !== 32) {
      throw new Error(`Invalid DEK length: ${dek.length} (expected 32 bytes)`);
    }
    console.log(`🔐 Loaded Arcium DEK (${dek.length} bytes)`);
    return dek;
  } catch (err) {
    console.error(`❌ Failed to load DEK: ${err.message}`);
    console.log(`\n💡 Run option 2 to fetch device metadata and DEK first`);
    throw err;
  }
}

/**
 * Get device metadata (cached file)
 */
function loadDeviceMetadata() {
  try {
    const raw = fs.readFileSync(METADATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.log(`⚠️  No local metadata found. Run option 2 to fetch from backend.`);
    return null;
  }
}

// ============================================================================
// ENCRYPTION & MESSAGING
// ============================================================================

function b64(u8) { return Buffer.from(u8).toString('base64'); }

function encryptRecord(dek, obj) {
  const iv  = crypto.randomBytes(12);
  const aad = Buffer.from(DEVICE_ID); // Bind to device ID
  const plain = Buffer.from(JSON.stringify(obj), 'utf8');

  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
  cipher.setAAD(aad);
  const ct  = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    alg: 'AES-256-GCM',
    deviceId: DEVICE_ID,
    ts: new Date().toISOString(),
    iv:  b64(iv),
    tag: b64(tag),
    aad: b64(aad),
    ct:  b64(ct),
    arcium: true,
  };
}

function decryptRecord(dek, envelope) {
  try {
    const iv  = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const aad = Buffer.from(envelope.aad, 'base64');
    const ct  = Buffer.from(envelope.ct, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);

    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
  } catch (err) {
    throw new Error(`Decryption failed: ${err.message}`);
  }
}

// ============================================================================
// DEVICE INITIALIZATION (PKI)
// ============================================================================

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
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Enroll device via ChainSensors DPS with the CSR`);
  console.log(`   2. Run option 2 to fetch Arcium-generated DEK`);
  console.log(`   3. Run option 3 to start encrypted data publishing\n`);
}

// ============================================================================
// SENSOR DATA PUBLISHING
// ============================================================================

async function startSensor() {
  console.log('🌡️  Starting Arcium-enhanced sensor...');

  // Load Arcium DEK
  const dek = loadArciumDek();
  const metadata = loadDeviceMetadata();

  if (metadata) {
    const cid = metadata.dekCapsuleForMxeCid || metadata?.__walrus__?.dekCapsuleForMxeCid;
    if (cid) console.log(`🎯 Using DEK Capsule: ${cid}`);
  }

  // Load device certificate
  const keyPath  = `${DEVICE_ID}-key.pem`;
  const certPath = `${DEVICE_ID}-cert.pem`;

  let privateKey, clientCert;
  try {
    const keyPem  = fs.readFileSync(keyPath, 'utf8');
    const certPem = fs.readFileSync(certPath, 'utf8');
    privateKey = keyPem;
    clientCert = certPem;
    console.log(`🔐 Loaded device certificate: ${certPath}`);
  } catch (err) {
    console.error(`❌ Missing device certificate. Please complete DPS enrollment first.`);
    return;
  }

  // MQTT connection options
  const caCert = fs.readFileSync(CA_CERT_PATH, 'utf8');
  const options = {
    key: privateKey,
    cert: clientCert,
    ca: [caCert],
    rejectUnauthorized: true,
  };

  const client = mqtt.connect(BROKER_URL, options);

  client.on('connect', () => {
    console.log(`🔗 Connected to MQTT broker: ${BROKER_URL}`);
    console.log(`🚀 Publishing encrypted sensor data every 1 second...`);
    console.log(`📡 Topic: devices/${DEVICE_ID}/data\n`);

    let index = 0;
    const interval = setInterval(() => {
      const reading = sensorData[index % sensorData.length];
      index++;

      const envelope = encryptRecord(dek, reading);

      const topic = `devices/${DEVICE_ID}/data`;
      client.publish(topic, JSON.stringify(envelope), (err) => {
        if (err) {
          console.error('❌ MQTT publish error:', err.message);
        } else {
          console.log(`📤 Published encrypted reading #${index} (${reading.temperature}°C, ${reading.humidity}%)`);
        }
      });

    }, 1000);

    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping sensor...');
      clearInterval(interval);
      client.end();
      rl.close();
      process.exit(0);
    });
  });

  client.on('error', (err) => {
    console.error('❌ MQTT connection error:', err.message);
  });

  client.on('close', () => {
    console.log('📴 MQTT connection closed');
  });
}

// ============================================================================
// TESTING & VALIDATION
// ============================================================================

async function testDecrypt() {
  console.log('🧪 Testing DEK decryption...');

  try {
    const dek = loadArciumDek();

    const testData = {
      temperature: 23.5,
      humidity: 65,
      timestamp: new Date().toISOString(),
      test: true
    };

    console.log('🔒 Original data:', JSON.stringify(testData, null, 2));

    const envelope = encryptRecord(dek, testData);
    console.log('📦 Encrypted envelope size:', JSON.stringify(envelope).length, 'bytes');

    const decrypted = decryptRecord(dek, envelope);
    console.log('🔓 Decrypted data:', JSON.stringify(decrypted, null, 2));

    if (JSON.stringify(testData) === JSON.stringify(decrypted)) {
      console.log('✅ Encryption/decryption test PASSED');
    } else {
      console.log('❌ Encryption/decryption test FAILED');
    }

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
  }
}

// ============================================================================
// STARTUP
// ============================================================================

console.log('🚀 ChainSensors Arcium-Enhanced Device Simulator');
console.log('🔐 Privacy-preserving IoT data marketplace');
console.log('═'.repeat(50));

prompt();
