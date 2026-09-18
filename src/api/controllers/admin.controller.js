const adminService = require('../../services/admin.service');

function evaluateFormula(formula) {
    if (typeof formula !== 'string' || !formula.trim() || formula.length > 500) {
        throw new Error('Invalid formula');
    }
    if (!/^[0-9+\-*/().\s%]+$/.test(formula)) {
        throw new Error('Invalid characters');
    }
    let pos = 0;
    const tokens = [];
    while (pos < formula.length) {
        const ch = formula[pos];
        if (/\s/.test(ch)) {
            pos++;
            continue;
        }
        if ((ch >= '0' && ch <= '9') || (ch === '.' && pos + 1 < formula.length && formula[pos + 1] >= '0' && formula[pos + 1] <= '9')) {
            let numStr = '';
            let dotSeen = false;
            while (pos < formula.length) {
                const c = formula[pos];
                if (c >= '0' && c <= '9') {
                    numStr += c;
                    pos++;
                } else if (c === '.' && !dotSeen) {
                    dotSeen = true;
                    numStr += c;
                    pos++;
                } else {
                    break;
                }
            }
            tokens.push({ type: 'number', value: parseFloat(numStr) });
            continue;
        }
        if ('+-*/%()'.includes(ch)) {
            tokens.push({ type: ch, value: ch });
            pos++;
            continue;
        }
        throw new Error(`Unexpected character: ${ch}`);
    }
    if (tokens.length === 0) {
        throw new Error('Empty formula');
    }
    let tokenIdx = 0;
    function peek() {
        return tokens[tokenIdx];
    }
    function consume(expectedType) {
        const token = tokens[tokenIdx];
        if (!token || (expectedType && token.type !== expectedType)) {
            throw new Error('Syntax error');
        }
        tokenIdx++;
        return token;
    }
    function parseExpression() {
        return parseAdditive();
    }
    function parseAdditive() {
        let left = parseMultiplicative();
        while (tokenIdx < tokens.length) {
            const next = peek();
            if (next && next.type === '+') {
                consume('+');
                left = left + parseMultiplicative();
            } else if (next && next.type === '-') {
                consume('-');
                left = left - parseMultiplicative();
            } else {
                break;
            }
        }
        return left;
    }
    function parseMultiplicative() {
        let left = parseUnary();
        while (tokenIdx < tokens.length) {
            const next = peek();
            if (next && next.type === '*') {
                consume('*');
                left = left * parseUnary();
            } else if (next && next.type === '/') {
                consume('/');
                const right = parseUnary();
                if (right === 0) throw new Error('Division by zero');
                left = left / right;
            } else if (next && next.type === '%') {
                consume('%');
                const right = parseUnary();
                if (right === 0) throw new Error('Modulo by zero');
                left = left % right;
            } else {
                break;
            }
        }
        return left;
    }
    function parseUnary() {
        const token = peek();
        if (token && token.type === '+') {
            consume('+');
            return parseUnary();
        }
        if (token && token.type === '-') {
            consume('-');
            return -parseUnary();
        }
        return parsePrimary();
    }
    function parsePrimary() {
        const token = peek();
        if (!token) throw new Error('Unexpected EOF');
        if (token.type === 'number') {
            consume('number');
            return token.value;
        }
        if (token.type === '(') {
            consume('(');
            const val = parseExpression();
            consume(')');
            return val;
        }
        throw new Error('Unexpected token');
    }
    const result = parseExpression();
    if (tokenIdx < tokens.length) {
        throw new Error('Unexpected token after expression');
    }
    if (!Number.isFinite(result)) {
        throw new Error('Non-finite result');
    }
    return result;
}

exports.checkShippingStatus = (req, res) => {
    adminService.pingProvider(req.body.providerIP, req.body.options, out => res.send(out));
};

exports.previewDynamicPricing = (req, res) => {
    try {
        res.json({ price: evaluateFormula(req.body.formula) });
    } catch (e) {
        res.status(400).send("Evaluation Failed");
    }
};
