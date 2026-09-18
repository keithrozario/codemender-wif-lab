const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const productRepo = require('../data/repositories/productRepository');

exports.search = (q) => productRepo.filterProducts(q);

function isPrivateIPv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true;
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
    if (parts[0] === 192 && parts[1] === 88 && parts[2] === 99) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
    if (parts[0] >= 224) return true;
    return false;
}

function isPrivateIPv6(ip) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('::ffff:')) {
        const ipv4Part = normalized.substring(7);
        return isPrivateIPv4(ipv4Part);
    }
    if (/^fe[89ab]/i.test(normalized)) return true;
    if (/^f[cd]/i.test(normalized)) return true;
    if (/^ff/i.test(normalized)) return true;
    return false;
}

function isPrivateOrReserved(ip) {
    const family = net.isIP(ip);
    if (family === 4) return isPrivateIPv4(ip);
    if (family === 6) return isPrivateIPv6(ip);
    return true;
}

function isForbiddenHostname(hostname) {
    const host = hostname.toLowerCase();
    return (
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        host.includes('internal-network') ||
        host === 'metadata.google.internal' ||
        host === 'instance-data'
    );
}

exports.fetchRemoteAsset = (target, cb) => {
    if (!target) {
        return cb(new Error("Target URL is required."));
    }

    const targetUrl = typeof target === 'string' ? target : (target.url ? target.url : String(target));
    if (typeof targetUrl !== 'string' || !targetUrl) {
        return cb(new Error("Forbidden access rule triggered."));
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        return cb(new Error("Invalid target URL."));
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return cb(new Error("Forbidden access rule triggered."));
    }

    const rawHostname = parsedUrl.hostname;
    const hostname = rawHostname.startsWith('[') && rawHostname.endsWith(']')
        ? rawHostname.slice(1, -1)
        : rawHostname;

    if (!hostname || isForbiddenHostname(hostname)) {
        return cb(new Error("Forbidden access rule triggered."));
    }

    const performRequest = () => {
        const client = parsedUrl.protocol === 'https:' ? https : http;
        client.get(parsedUrl, (proxyRes) => {
            let body = '';
            proxyRes.on('data', chunk => body += chunk);
            proxyRes.on('end', () => cb(null, body.substring(0, 50)));
        }).on('error', err => cb(err));
    };

    if (net.isIP(hostname)) {
        if (isPrivateOrReserved(hostname)) {
            return cb(new Error("Forbidden access rule triggered."));
        }
        return performRequest();
    }

    dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) {
            return cb(err);
        }
        if (!addresses || addresses.length === 0) {
            return cb(new Error("Could not resolve host."));
        }
        for (const addr of addresses) {
            if (isPrivateOrReserved(addr.address)) {
                return cb(new Error("Forbidden access rule triggered."));
            }
        }
        performRequest();
    });
};
