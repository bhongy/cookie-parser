const express = require('express');
const supertest = require('supertest');
const cookieParser = require('./cookie-parser');

describe('cookieParser()', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(cookieParser());
    app.get('/', (req, res) => {
      res.json({ cookies: req.cookies });
    });
    app.get('/signed', (req, res) => {
      res.json({ cookies: req.signedCookies });
    });
  });

  it('returns a function', () => {
    expect(typeof cookieParser()).toBe('function');
  });

  it('calls the next middleware', () => {
    expect.assertions(1);

    const next = jest.fn();
    app = express();
    app.use(cookieParser());
    app.get('/', (req, res) => {
      next();
      res.end();
    });

    return supertest(app)
      .get('/')
      .then(() => {
        expect(next).toHaveBeenCalledTimes(1);
      });
  });

  describe('when no cookies are sent', () => {
    it('should default req.cookies to {}', () => {
      expect.assertions(1);
      return supertest(app)
        .get('/')
        .then(res => {
          expect(res.body.cookies).toEqual({});
        });
    });

    it('should default req.signedCookies to {}', () => {
      expect.assertions(1);
      return supertest(app)
        .get('/signed')
        .then(res => {
          expect(res.body.cookies).toEqual({});
        });
    });
  });
});
