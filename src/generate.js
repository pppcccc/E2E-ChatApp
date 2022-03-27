//generate-keys.js
var openpgp = require('openpgp');
const fs = require('fs');

var genKeyPair = async() => {
  var { publicKey, privateKey } = await openpgp.generateKey({
    userIDs: [{ name: 'anakin', email: 'anakin@tatooine.com' }],
    curve: 'ed25519',
    passphrase: 'obiwan'
  });
  console.log(publicKey);
  console.log(privateKey)
}

async function encrypt(msg, _publicKey) {
  //console.log(`Raw Message: ${msg}`)
  const publicKey = await openpgp.readKey({ armoredKey: _publicKey });
  const encrypted = await openpgp.encrypt({
    message: await openpgp.createMessage({ text: msg }),
    encryptionKeys: publicKey
  });

  //console.log(`Encrypted Message: ${encrypted}`)
  return encrypted
}

async function decrypt(encrypted, _privateKey, passphrase){
  //console.log(`Encrypted Message: ${encrypted}`)

  const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: _privateKey }),
        passphrase
  });

  const message = await openpgp.readMessage({
        armoredMessage: encrypted // parse armored message
  });

  const { data: decrypted, signatures } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey
  });

  //console.log(`Decrypted Message: ${decrypted}`)
  return decrypted
}

async function test(msg){
  var encrypted_msg = await encrypt(msg, publicKeyArmored);
  var decrypted_msg = await decrypt(encrypted_msg, privateKeyArmored, passphrase);

  console.log(encrypted_msg)
  console.log(`Decrypted: ${decrypted_msg}`)
}

const pair = genKeyPair()
