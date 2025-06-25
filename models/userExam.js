const db = require('../db/index');
const self = {}; 

self.test1 = () => {
    const ret = {
        msg: "test1 func"
    }

    return ret;
}

self.test2 = () => {
    const ret = {
        msg: "test2 func"
    }

    return ret;
}

module.exports = self;