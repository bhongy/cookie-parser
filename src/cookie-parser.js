'use strict';

const cookie = require('cookie');

module.exports = cookieParser;
module.exports.JSONCookie = JSONCookie;

function cookieParser () {
  return function cookieParserMiddleware (req, res, next) {
    req.cookies = req.headers.cookie
      ? cookie.parse(req.headers.cookie)
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

