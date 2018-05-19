const express = require('express');
const supertest = require('supertest');
const cookieParser = require('./cookie-parser');

/**
 * notes:
 * - don't test status code - cookieParser is agnostic of status code
 *   (it is not responsible to set status code)
 */

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

    const nextMiddleware = jest.fn((req, res) => res.end());
    app = express();
    app.use(cookieParser());
    app.use(nextMiddleware);

    return supertest(app)
      .get('/')
      .then(() => {
        expect(nextMiddleware).toHaveBeenCalledTimes(1);
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

  describe('when cookies are sent', () => {
    it('should populate req.cookies', () => {
      expect.assertions(1);
      return supertest(app)
        .get('/')
        .set('Cookie', 'foo=bar; bar=baz')
        .then(res => {
          expect(res.body.cookies).toEqual({ foo: 'bar', bar: 'baz' });
        });
    });

    // it('should inflate JSON cookies', () => {
    //   expect.assertions(1);
    //   return supertest(app)
    //     .get('/')
    //     .set('Cookie', 'moo=j:{"foo":"bar"}')
    //     .then(res => {
    //       expect(res.body.cookies).toEqual({ moo: { foo: 'bar' } });
    //     });
    // });

    it('should not inflate invalid JSON cookies', () => {
      expect.assertions(1);
      return supertest(app)
        .get('/')
        .set('Cookie', 'moo=j:{"foo":')
        .then(res => {
          expect(res.body.cookies).toEqual({ moo: 'j:{"foo":' });
        });
    });
  });
});

describe('cookieParser.JSONCookie(str)', () => {
  const { JSONCookie } = cookieParser;

  it('is a function', () => {
    expect(typeof JSONCookie).toBe('function');
  });

  it('returns undefined for non-string arguments', () => {
    expect(JSONCookie()).toBeUndefined();
    expect(JSONCookie(undefined)).toBeUndefined();
    expect(JSONCookie(null)).toBeUndefined();
    expect(JSONCookie(42)).toBeUndefined();
    expect(JSONCookie({ foo: 'bar' })).toBeUndefined();
    expect(JSONCookie(['foo', 'bar'])).toBeUndefined();
    expect(JSONCookie(function () {})).toBeUndefined();
  });

  it('returns undefined for non-JSON cookie string', () => {
    expect(JSONCookie('')).toBeUndefined();
    expect(JSONCookie('foo')).toBeUndefined();
    expect(JSONCookie('{}')).toBeUndefined();
  });

  it('returns undefined for JSON cookie string without "j:" prefix', () => {
    expect(JSONCookie('""')).toBeUndefined();
    expect(JSONCookie('"moo"')).toBeUndefined();
    expect(JSONCookie('2')).toBeUndefined();
    expect(JSONCookie('true')).toBeUndefined();
    expect(
      JSONCookie('{"planet":"hoth","numSuns":1,"visited":false}')
    ).toBeUndefined();
  });

  it('returns parsed value for JSON cookie string with "j:" prefix', () => {
    expect(JSONCookie('j:""')).toEqual('');
    expect(JSONCookie('j:"moo"')).toEqual('moo');
    expect(JSONCookie('j:2')).toEqual(2);
    expect(JSONCookie('j:true')).toEqual(true);
    expect(
      JSONCookie('j:{"planet":"hoth","numSuns":1,"visited":false}')
    ).toEqual({
      planet: 'hoth',
      numSuns: 1,
      visited: false
    });
  });

  it('returns object for valid JSON cookie with extra whitespaces', () => {
    expect(JSONCookie('j:  { "planet" :"hoth"  }')).toEqual({ planet: 'hoth' });
  });

  it('returns undefined on invalid JSON', function () {
    expect(JSONCookie('j:{planet:"hoth"}')).toBeUndefined();
    expect(JSONCookie('j:{"planet":"hoth"')).toBeUndefined();
  });
});

describe('cookieParser.JSONCookies(obj)', () => {
  const { JSONCookies } = cookieParser;

  it('is a function', () => {
    expect(typeof JSONCookies).toBe('function');
  });

  describe('when input is not an object', () => {
    it('returns the input as-is', () => {
      expect(JSONCookies(void 0)).toBeUndefined();
      expect(JSONCookies(null)).toBeNull();
      expect(JSONCookies('string')).toEqual('string');
      expect(JSONCookies([1, 'abc'])).toEqual([1, 'abc']);
      expect(JSONCookies([{}])).toEqual([{}]);
    });
  });

  describe('when input is an object', () => {
    it('parses values of the input object', () => {
      expect(
        JSONCookies({
          distance: 'j:{"unit":"meter","value":10}',
          mass: 'j:{"unit":"gram"}'
        })
      ).toEqual({
        distance: { unit: 'meter', value: 10 },
        mass: { unit: 'gram' }
      });
    });

    it('works with objects created with Object.create(null)', () => {
      const obj = Object.create(null);
      obj.mass = 'j:{"unit":"pound"}';
      expect(JSONCookies(obj)).toEqual({ mass: { unit: 'pound' } });
    });

    it('ignores values that are non-JSON cookie strings', () => {
      expect(
        JSONCookies({
          time: undefined,
          distance: '{"unit":"meter"}',
          mass: {}
        })
      ).toEqual({
        time: undefined,
        distance: '{"unit":"meter"}',
        mass: {}
      });
    });

    it('works with a mix of valid and invalid values', () => {
      expect(
        JSONCookies({
          distance: 'j:{"unit":"meter"}',
          mass: '{10kg}'
        })
      ).toEqual({
        distance: { unit: 'meter' },
        mass: '{10kg}'
      });
    });

    it('does not recursively parse values', () => {
      expect(
        JSONCookies({ distance: { unit: 'j:{"label":"meter"}' } })
      ).toEqual({
        distance: { unit: 'j:{"label":"meter"}' }
      });
    });
  });
});
