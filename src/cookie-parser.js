'use strict';

module.exports = cookieParser;

function cookieParser () {
  return function cookieParserMiddleware (req, res, next) {
    req.cookies = Object.create(null);
    req.signedCookies = Object.create(null);
    next();
  };
}
