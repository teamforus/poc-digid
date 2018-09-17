"use strict";

const appSettings = require('../settings');
var express = require('express');
var router = express.Router();
module.exports = router;
const https = require('https');

const digidSettings = appSettings.digid;

router.route('/login').get(async (req, res) => {
    const initUrl = digidSettings.aSelectServerURL + '?request=authenticate&app_url=' + encodeURIComponent(digidSettings.verifyUrl) + '&app_id=' + digidSettings.appId + '&shared_secret=' + digidSettings.sharedSecret + '&a-select-server=' + digidSettings.aSelectServer;

    getUrl(initUrl).then((digidRes) => {
        const digidResData = parseDigidResponse(digidRes)

        try {
            if (undefined === digidResData.result_code) {
                throw new Error('No result code in response');
            }
            
            if ('0000' !== digidResData.result_code) {
                throw new Error('Invalid result code in response: ' + digidResData.result_code);
            }
            
            if (undefined === digidResData.request) {
                throw new Error('No request type in response');
            }
            
            if ('login1' !== digidResData.request) {
                throw new Error('Unexpected request type in response: ' + digidResData.request);
            }
            
            if (undefined === digidResData.as_url) {
                throw new Error('No url in response');
            }
            
            if (undefined === digidResData.rid) {
                throw new Error('No rid in response');
            }
            
            if (undefined === digidResData['a-select-server']) {
                throw new Error('No a-select-server in response');
            }
        } catch (err) {
            res.status(500);
            res.send("An error occured");
            // TODO: logging
            // TODO: error page
        }
        
        req.session.digidRid = digidResData.rid;
        const redirectTo = digidResData.as_url + '?request=' + digidResData.request + '&a-select-server=' + digidResData['a-select-server'] + '&rid=' + digidResData.rid;
        res.redirect(redirectTo);
    });

});

router.route('/verifylogin').get(async (req, res) => {
    
    if (undefined === req.query.rid) {
        throw new Error('No rid in request');
    }
                
    if (undefined === req.query['a-select-server']) {
        throw new Error('No a-select-server in request');
    }
                
    if (undefined === req.query['aselect_credentials']) {
        throw new Error('No aselect_credentials in request');
    }

    const verifyUrl = digidSettings.aSelectServerURL + '?request=verify_credentials&aselect_credentials=' + req.query['aselect_credentials'] + '&a-select-server=' + req.query['a-select-server'] + '&rid=' + req.query.rid + '&shared_secret=' + digidSettings.sharedSecret

    getUrl(verifyUrl).then((digidRes) => {
        const digidResData = parseDigidResponse(digidRes)
        
        try {
            if (undefined === digidResData.result_code) {
                throw new Error('No request result code in response');
            }
            
            if ('0000' !== digidResData.result_code) {
                throw new Error('Unexpected result code in response: ' + digidResData.result_code);
            }

            if (undefined === digidResData.rid) {
                throw new Error('No rid in response');
            }

            if (req.session.digidRid !== digidResData.rid) {
                throw new Error('Rid in response does not match');
            }

            if (undefined === digidResData.betrouwbaarheidsniveau) {
                throw new Error('No betrouwbaarheidsniveau in response');
            }

            if (undefined === digidResData.uid) {
                throw new Error('No uid in response');
            }

            if (undefined === digidResData.organization) {
                throw new Error('No organization in response');
            }
            
            if ('DigiD' !== digidResData.organization) {
                throw new Error('Unexpected organization in response: ' + digidResData.organization);
            }

            if (undefined === digidResData.app_id) {
                throw new Error('No app_id in response');
            }
            
            if (digidSettings.appId !== digidResData.app_id) {
                throw new Error('Unexpected app_id in response: ' + digidResData.appId);
            }
        } catch (err) {
            res.status(500);
            res.send("An error occured: " + err);
            return;
            // TODO: logging
            // TODO: error page
        }

        req.session.digidRid = null;
        req.session.digidBsn = digidResData.uid;
        req.session.status = 1;
        res.redirect('/');
    });

});

async function getUrl(url) {
    return new Promise(function(resolve, reject) {

        https.get(
            url,
            (resp) => {
                let data = '';
                resp.on('data', (chunk) => { data += chunk; });
        
                resp.on('end', () => {
                    resolve(data);
                });
            }
        ).on("error", (err) => {
            reject(err)
        });
    });
}

function parseDigidResponse(res) {
    const result = {};
    
    res.split(/&|\?/).forEach((param) => {
        const paramSplit = param.split('=', 2);
        if (paramSplit[0] && paramSplit[1]) {
            result[paramSplit[0]] = paramSplit[1];
        }
    });

    return result;
}