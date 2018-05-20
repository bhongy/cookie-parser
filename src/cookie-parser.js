'use strict';

const cookie = require('cookie');
const signature = require('cookie-signature');

module.exports = cookieParser;
module.exports.JSONCookie = JSONCookie;
module.exports.JSONCookies = JSONCookies;
module.exports.signedCookie = decodeSignedCookie;

// TODO: refactor for cleaner implementation
function cookieParser () {
  return function cookieParserMiddleware (req, res, next) {
    if (req.cookies) {
      return next();
    }
    req.cookies = req.headers.cookie
      ? JSONCookies(cookie.parse(req.headers.cookie))
      : Object.create(null);
    req.signedCookies = Object.create(null);
    next();
  };
}

/**
 * Parse JSON cookie string.
 *
 * @param {string} str
 * @return {?Object} Parsed object or undefined if not json cookie
 * @public
 */

function JSONCookie (str) {
  if (typeof str !== 'string' || str.substr(0, 2) !== 'j:') {
    return undefined;
  }
  try {
    return JSON.parse(str.substr(2));
  } catch (ex) {
    return undefined;
  }
}

function isPlainObject (obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/**
 * Parse all values (non-recursive) of an object as JSON cookies.
 *
 * @param {Object} obj
 * @return {Object}
 * @public
 */

// TODO: refactor for cleaner implementation
function JSONCookies (obj) {
  if (!isPlainObject(obj)) {
    return obj;
  }
  return Object.entries(obj).reduce((newObj, [k, v]) => {
    const parsed = JSONCookie(v);
    newObj[k] = typeof parsed === 'undefined' ? v : parsed;
    return newObj;
  }, {});
}

/**
 * Decode a signed cookie string.
 *
 * @param {string} str signed cookie string
 * @param {string|string[]} secret
 * @returns {string | false} decoded value
 * @public
 */

function decodeSignedCookie (str, secret) {
  if (typeof str !== 'string') {
    return undefined;
  }

  if (str.substr(0, 2) !== 's:') {
    return str;
  }

  const encoded = str.substr(2);
  const secrets = Array.isArray(secret)
    ? secret
    : typeof secret === 'string'
      ? [secret]
      : [];

  let decode;
  secrets.find(s => {
    decode = signature.unsign(encoded, s);
    return decode !== false;
  });

  return decode;
}
