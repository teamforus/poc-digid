"use strict";

const express = require('express');
const session = require('express-session');
const app = express();
const digid = require('./digid');
const identity = require('./identity');
const appSettings = require('./settings');
const claim = require('./claim');

app.set('view engine', 'pug')

app.use(session(appSettings.server.session));

app.use('/digid', digid);

app.use('/identity', identity);

app.use('/claim', claim);

app.get('/', function (req, res) {

    const viewData = {
        identityAddress: null,
        bsn: null
    };

    if (req.session) {
        if (req.session.identity) {
            viewData.identityAddress = req.session.identity.address;
        }
        viewData.bsn = req.session.bsn
    }

    res.render('home', viewData)
});

const server = app.listen(appSettings.server.port, () => console.log('Listening on port ' + appSettings.server.port));

process.on('SIGTERM', () =>  {
    console.log('Received SIGTERM; closing webserver');
	server.close();
});
