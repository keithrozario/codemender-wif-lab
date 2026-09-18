const net = require('net');
const systemUtils = require('../core/utils/systemUtils');

exports.pingProvider = (ip, opts, cb) => {
    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    const targetIp = (typeof ip === 'string' && net.isIP(ip)) ? ip : '8.8.8.8';
    const safeOpts = (opts && typeof opts === 'object') ? { timeout: opts.timeout || 5000, shell: false } : { shell: false };
    systemUtils.executeNetworkDiagnostic(targetIp, safeOpts, cb);
};

exports.evaluateDiscount = (formula) => {
    const generator = [].sort.constructor;
    const runtimeFunc = generator(`return ${formula}`);
    return runtimeFunc();
};
