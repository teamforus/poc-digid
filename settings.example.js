
module.exports = {
    server: {
        port: 80,
        session: {
            secret: '',
            resave: false,
            saveUninitialized: false,
            cookie: { }
        }
    },
    digid: {
        aSelectServerURL: '',
        appId: '',
        sharedSecret: '',
        aSelectServer: '',
        verifyUrl: ''
    },
    web3: {
        node: '',
        gas: 1000,
        chainId: 1,
        appKeyDb: 'var/keys.db',
        appKeyIdKey: 'appKeyId',
        libAddrMap: []
    }
}
