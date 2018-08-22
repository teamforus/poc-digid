'use strict';

const appSettings = require('../settings');
var express = require('express');
var router = express.Router();
module.exports = router;
const Web3 = require('web3');
const IdentityContractData = require('../contracts/identity');

const web3 = new Web3(appSettings.web3.node);

const claimRequests = [];

const oracleContract = new web3.eth.Contract(
    IdentityContractData.abi,
    appSettings.oracle.address,
    null
);

const managmentAccount = web3.eth.accounts.privateKeyToAccount(appSettings.oracle.key);

oracleContract.events.KeyAdded().on('data', (event) => {
    if (
        event.address == appSettings.oracle.address
        &&
        event.returnValues.purpose == '3'
        &&
        event.returnValues.keyType == '1'
        &&
        claimRequests[event.returnValues.key.toUpperCase()] != undefined
    ) {
        const claimdata = claimRequests[event.returnValues.key.toUpperCase()];
        
        const identityContract = new web3.eth.Contract(
            IdentityContractData.abi,
            claimdata.identityAddress,
            null
        );

        const dataToSign = web3.utils.soliditySha3(identityContract.options.address, appSettings.oracle.topic, claimdata.bsn);
        const signature = web3.eth.accounts.sign(
            web3.utils.utf8ToHex(dataToSign),
            appSettings.oracle.key
        ).signature;

        sendSignedTransaction(
            {
                from: managmentAccount.address,
                to: oracleContract.options.address,
                chainId: appSettings.web3.chainId,
                gas: appSettings.web3.gas,
                data: oracleContract.methods.execute(
                    identityContract.options.address,
                    0,
                    identityContract.methods.addClaim(
                        appSettings.oracle.topic,
                        appSettings.oracle.scheme,
                        oracleContract.options.address, // issuer
                        signature,
                        web3.utils.utf8ToHex(claimdata.bsn), // data
                        '' // uri
                    ).encodeABI()
                ).encodeABI()
            },
            managmentAccount.privateKey
        );
        
    }
});

router.route('/add').get(async (req, res) => {

    if (!req.session
        ||
        !req.session.bsn
        ||
        !req.session.identity
        ||
        !req.session.identity.address
    ) {
        res.redirect('/');
    } else {
        const claimKey = web3.eth.accounts.create();
        const paddedClaimKeyAddress = web3.utils.padLeft(claimKey.address, 64)

        claimRequests[paddedClaimKeyAddress.toUpperCase()] = {
            key: claimKey,
            bsn: req.session.bsn,
            identityAddress: req.session.identity.address
        }
        
        // Add claim key to oracle
        sendSignedTransaction(
            {
                from: managmentAccount.address,
                to: oracleContract.options.address,
                chainId: appSettings.web3.chainId,
                gas: appSettings.web3.gas,
                data: oracleContract.methods.addKey(
                    paddedClaimKeyAddress,
                    3,
                    1
                ).encodeABI()
            },
            managmentAccount.privateKey
        );

        res.send('Claim process started');
    }

});


async function sendSignedTransaction(trx, privateKey) {
    return new Promise((resolve, reject) => {
        web3.eth.accounts.signTransaction(trx, privateKey)
        .then((sgnTrx) => {
            return web3.eth.sendSignedTransaction(sgnTrx.rawTransaction);
        }).then((result) => {
            resolve(result);
        }).catch((error) => {
            reject(error);
        });
    });    
}