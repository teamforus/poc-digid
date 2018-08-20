"use strict";

const express = require('express');
const session = require('express-session');
const app = express();
const digid = require('./digid');
const appSettings = require('./settings');

app.use(session(appSettings.server.session));

app.use('/digid', digid);

const server = app.listen(appSettings.server.port, () => console.log('Listening on port ' + appSettings.server.port));

process.on('SIGTERM', () =>  {
    console.log('Received SIGTERM; closing webserver');
	server.close();
});
