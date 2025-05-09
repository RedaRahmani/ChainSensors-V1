// common.js
const fs = require('fs');
const forge = require('node-forge');

function generateKeyAndCsr(deviceId) {
  // 1. Generate a new 2048‑bit RSA keypair
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // 2. Build a CSR with CN=deviceId
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([{ name: 'commonName', value: deviceId }]);
  csr.sign(keys.privateKey, forge.md.sha256.create());

  return {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    csrPem:         forge.pki.certificationRequestToPem(csr),
  };
}

function savePem(filename, pem) {
  fs.writeFileSync(filename, pem, 'utf8');
}

module.exports = { generateKeyAndCsr, savePem };
