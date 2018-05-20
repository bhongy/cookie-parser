'use strict';

const cookie = require('cookie');

module.exports = cookieParser;
module.exports.JSONCookie = JSONCookie;
module.exports.JSONCookies = JSONCookies;

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
 * @param {String} str
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
