/**
 * Input Sanitization & Injection Defense Middleware
 * 
 * Protects against:
 * - NoSQL Operator Injection ($where, $gt, $ne, $regex, etc.)
 * - Prototype Pollution (__proto__, constructor, prototype)
 * - Dotted-path property injection
 * - Reflected & Stored XSS vectors
 */

const DANGEROUS_OPERATORS = new Set([
  '$where', '$regex', '$expr', '$gt', '$gte', '$lt', '$lte',
  '$ne', '$nin', '$exists', '$mod', '$text', '$all', '$elemMatch',
  '$size', '$jsonSchema', '$slice', '$comment'
]);

const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeValue(value, depth = 0) {
  if (depth > 10) return null; // Prevent deep nesting / DoS recursion

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Basic XSS escaping for dangerous script injections
    return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const cleanObj = {};
    for (const [key, val] of Object.entries(value)) {
      // 1. Block prototype pollution
      if (PROTOTYPE_KEYS.has(key)) {
        continue;
      }

      // 2. Block or strip keys starting with '$' (NoSQL operator injection)
      if (key.startsWith('$')) {
        continue;
      }

      // 3. Block keys containing dots to prevent dotted-path traversal in DB updates
      const safeKey = key.replace(/\./g, '_');

      cleanObj[safeKey] = sanitizeValue(val, depth + 1);
    }
    return cleanObj;
  }

  return value;
}

const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params);
  }
  next();
};

module.exports = {
  sanitizeInput,
  sanitizeValue
};
