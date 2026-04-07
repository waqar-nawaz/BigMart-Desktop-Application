const crypto = require('crypto');

function base64urlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecodeToString(input) {
  const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64').toString('utf8');
}

function getAuthSecret() {
  // In production, set this explicitly.
  return process.env.BIGMART_AUTH_SECRET || 'bigmart-dev-secret-change-me';
}

function sign(data) {
  return base64urlEncode(
    crypto.createHmac('sha256', getAuthSecret()).update(data).digest()
  );
}

/**
 * Minimal signed token (not a full JWT):
 * token = base64url(jsonPayload) + "." + base64url(hmacSHA256(payload))
 */
function issueToken(user, { ttlSeconds = 60 * 60 * 12 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + ttlSeconds,
  };
  const body = base64urlEncode(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token) return { ok: false, error: 'missing_token' };
  const parts = String(token).split('.');
  if (parts.length !== 2) return { ok: false, error: 'invalid_token_format' };
  const [body, sig] = parts;
  const expected = sign(body);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { ok: false, error: 'invalid_signature' };
  }
  let payload;
  try {
    payload = JSON.parse(base64urlDecodeToString(body));
  } catch {
    return { ok: false, error: 'invalid_payload' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return { ok: false, error: 'token_expired' };
  return { ok: true, payload };
}

function extractBearerToken(req) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header) return null;
  const m = String(header).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  const v = verifyToken(token);
  if (!v.ok) return res.status(401).json({ success: false, message: 'Unauthorized', code: v.error });
  req.user = v.payload;
  return next();
}

module.exports = { issueToken, verifyToken, requireAuth };

