'use strict';

const appSettings = require('../settings');
const dirty = require('dirty');

module.exports = {
    get() {
        return new Promise((resolve, reject) => {
            const db = dirty(appSettings.oracle.claimsDb);
            db.on('load', async () => {
                resolve(db);
            });
        });
    }
}
