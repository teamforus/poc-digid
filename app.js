"use strict";

const express = require('express');
const session = require('express-session');
const app = express();
const digid = require('./digid');
const identity = require('./identity');
const appSettings = require('./settings');
const claim = require('./claim');
var QRCode = require('qrcode');
const Web3 = require('web3');
const IdentityContractData = require('./contracts/identity');
const ClaimsDb = require('./claim/db');

const web3 = new Web3(appSettings.web3.node);

app.use('/assets', express.static('static'))

app.set('view engine', 'ejs')

app.use(session(appSettings.server.session));

app.use('/digid', digid);

app.use('/identity', identity);

app.use('/claim', claim);

app.get('/logout', async function (req, res) {
    req.session.status = 0;
    req.session.identity = null;
    res.redirect('/');
});

app.get('/', async function (req, res) {

    if (!req.session || !req.session.identity) {
        res.redirect('/identity/login/')
    } else {

        if (!req.session.status) {
            req.session.status = 0;
        }

        const viewData = {
            identityAddress: req.session.identity.address,
            bsn: null,
            status: req.session.status
        };

        // identity has claim
        const bsnFromClaim = await getBsnFromClaim(req.session.identity.address)
        if (bsnFromClaim) {
            req.session.status = 3;
            viewData.status = req.session.status;
            viewData.bsn = bsnFromClaim;
        } else {

            // claim is pending
            const claimsDb = await ClaimsDb.get();
            const pendingBsn = claimsDb.get(req.session.identity.address);
            if (pendingBsn) {
                req.session.status = 2;
                viewData.status = req.session.status;
                viewData.bsn = pendingBsn
            } else {

                // digid login, but claim is not yet requested
                if (req.session.digidBsn) {
                    viewData.bsn = req.session.digidBsn
                }
            }
        }

        QRCode.toDataURL(viewData.identityAddress, function (err, url) {
            if (err) {
                // TODO: logging
                // TODO: show error page
            } else {
                viewData.identityQrcode = url;
                res.render('home', viewData)
            }
        });
    }
    
});

function getBsnFromClaim(identityAddress) {
    return new Promise((resolve, reject) => {

        const identityContract = new web3.eth.Contract(
            IdentityContractData.abi,
            identityAddress,
            null
        );

        const claimId = web3.utils.soliditySha3(appSettings.oracle.address, appSettings.oracle.topic);

        identityContract.methods.getClaim(claimId).call({from: appSettings.oracle.address})
        .then(function(result){

            if (!result.data) {
                resolve(null);
                return;
            }

            const signData = web3.utils.soliditySha3(
                identityAddress,
                appSettings.oracle.topic,
                result.data
            );
            const recoveredKey = web3.eth.accounts.recover(signData, result.signature);

            if (!result.topic || result.topic != appSettings.oracle.topic
                ||
                !result.scheme || result.scheme != appSettings.oracle.scheme
                ||
                !result.issuer || result.issuer != appSettings.oracle.address) {
                resolve(null);
                return;
            }
            
            const issuerContract = new web3.eth.Contract(
                IdentityContractData.abi,
                appSettings.oracle.address,
                null
            );
    
            const paddedRecoveredKey = web3.utils.padLeft(recoveredKey, 64);
            issuerContract.methods.getKey(paddedRecoveredKey).call().then(issuerKeyData => {
                if (
                    issuerKeyData.key.toUpperCase() === paddedRecoveredKey.toUpperCase()
                    &&
                    issuerKeyData.keyType === '1'
                    &&
                    issuerKeyData.purposes.includes('3')
                ) {
                    resolve(web3.utils.hexToUtf8(result.data));
                    return;
                } else {
                    resolve(null);
                    return;
                }
            });

        });
    });
}

const server = app.listen(appSettings.server.port, () => console.log('Listening on port ' + appSettings.server.port));

process.on('SIGTERM', () =>  {
    console.log('Received SIGTERM; closing webserver');
	server.close();
});
