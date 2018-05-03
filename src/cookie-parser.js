'use strict';

const cookie = require('cookie');

module.exports = cookieParser;

function cookieParser () {
  return function cookieParserMiddleware (req, res, next) {
    req.cookies = req.headers.cookie
      ? cookie.parse(req.headers.cookie)
      : Object.create(null);
    req.signedCookies = Object.create(null);
    next();
  };
}
