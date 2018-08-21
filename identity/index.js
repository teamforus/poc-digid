'use strict';

const appSettings = require('../settings');
var express = require('express');
var router = express.Router();
module.exports = router;
var QRCode = require('qrcode');
const Web3 = require('web3');
const dirty = require('dirty');
const crypto = require('crypto');
const IdentityContractData = require('../contracts/identity');

const web3 = new Web3(appSettings.web3.node);

const loginIdSessions = {};

getAppKey().then((appKey) => {

    web3.shh.subscribe(
        'messages', {
            privateKeyID: appKey.id,
        }
    ).on('data', data => {
        const loginData = JSON.parse(web3.utils.hexToUtf8(data.payload));
        if ('login' === loginData.request) {
            const session = loginIdSessions['id_' + loginData.id];
            const identityData = {
                address: loginData.body.address,
                key: loginData.body.key,
                name: loginData.body.name
            };
            const signature = loginData.body.signature;
            const signData = web3.utils.soliditySha3(identityData.address, identityData.key, identityData.name);
            const recoveredKey = web3.eth.accounts.recover(signData, signature);
            if (recoveredKey == identityData.key) {

                const identityContract = new web3.eth.Contract(
                    IdentityContractData.abi,
                    identityData.address,
                    null
                );
                
                const paddedKey = web3.utils.padLeft(identityData.key, 64)

                identityContract.methods.getKey(paddedKey).call().then((keyData) => {
                    if (keyData.keyType == 1
                        &&
                        (keyData.purposes.includes('1') || keyData.purposes.includes('2'))
                        &&
                        keyData.key.toString().toUpperCase() == paddedKey.toString().toUpperCase()
                    ) {
                        session.identity = identityData;
                        session.save();
                    }
                });
            }
        }
    });

    router.route('/login').get(async (req, res) => {

        req.session.dummy = 'dummy';

        if (undefined != req.session.identity) {
            res.redirect('/');
        } else {

            const loginId = await getRandomInt();

            loginIdSessions['id_'+loginId] = req.session;

            const loginQrCodeData = {
                'type': 'login',
                'body': {
                    'publicKey': appKey.pub
                },
                'id': loginId
            }

            QRCode.toDataURL(JSON.stringify(loginQrCodeData), function (err, url) {
                if (err) {
                    // TODO: logging
                    // TODO: show error page
                } else {
                    res.render('identity_login', { bsn: loginId, qrcode: url })
                }
            })
        }
    });
});

async function getRandomInt() {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(4, (err, buf) => {
            if (err) reject(err);
            resolve(parseInt(buf.toString('hex'), 16));
        });
    });
}

async function getAppKey() {
    return new Promise((resolve, reject) => {
        const keyDb = dirty(appSettings.web3.appKeyDb);
        keyDb.on('load', async () => {
            var appKeyId = keyDb.get(appSettings.web3.appKeyIdKey);
            if (undefined == appKeyId) {
                appKeyId = await web3.shh.newKeyPair();
                keyDb.set(appSettings.web3.appKeyIdKey, appKeyId);
            }
            resolve({
                id: appKeyId,
                priv: await web3.shh.getPrivateKey(appKeyId),
                pub: await web3.shh.getPublicKey(appKeyId)
            });
        }); // keyDb load
    }); // promise
}
