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
    it('defaults req.cookies to {}', () => {
      expect.assertions(1);
      return supertest(app)
        .get('/')
        .then(res => {
          expect(res.body.cookies).toEqual({});
        });
    });

    it('defaults req.signedCookies to {}', () => {
      expect.assertions(1);
      return supertest(app)
        .get('/signed')
        .then(res => {
          expect(res.body.cookies).toEqual({});
        });
    });
  });

  describe('when cookies are sent', () => {
    it('populates req.cookies', () => {
      expect.assertions(1);
      return supertest(app)
        .get('/')
        .set('Cookie', 'foo=bar; bar=baz')
        .then(res => {
          expect(res.body.cookies).toEqual({ foo: 'bar', bar: 'baz' });
        });
    });

    it('inflates JSON cookies', () => {
      expect.assertions(1);
      return supertest(app)
        .get('/')
        .set('Cookie', 'moo=j:{"foo":"bar"}')
        .then(res => {
          expect(res.body.cookies).toEqual({ moo: { foo: 'bar' } });
        });
    });

    it('does not inflate invalid JSON cookies', () => {
      expect.assertions(1);
      return supertest(app)
        .get('/')
        .set('Cookie', 'moo=j:{"foo":')
        .then(res => {
          expect(res.body.cookies).toEqual({ moo: 'j:{"foo":' });
        });
    });
  });

  describe('when req.cookies already exists', () => {
    it('does nothing', () => {
      expect.assertions(1);

      const existingCookie = { cookie: 'set before cookieParser' };
      app = express();
      app.use((req, res, next) => {
        req.cookies = existingCookie;
        next();
      });
      app.use(cookieParser());
      app.get('/', (req, res) => {
        res.json({ cookies: req.cookies });
      });

      return supertest(app)
        .get('/')
        .set('Cookie', 'foo=bar; bar=baz')
        .then(res => {
          expect(res.body.cookies).toEqual(existingCookie);
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

describe('cookieParser.signedCookie(str, secret)', () => {
  const SECRET = 'puppies!';
  const { signedCookie } = cookieParser;

  it('is a function', () => {
    expect(typeof signedCookie).toBe('function');
  });

  it('returns undefined for non-string arguments', () => {
    expect(signedCookie(undefined, SECRET)).toBeUndefined();
    expect(signedCookie(null, SECRET)).toBeUndefined();
    expect(signedCookie(42, SECRET)).toBeUndefined();
    expect(signedCookie({ foo: 'bar' }, SECRET)).toBeUndefined();
    expect(signedCookie(['lavender'], SECRET)).toBeUndefined();
    expect(signedCookie(() => {}, SECRET)).toBeUndefined();
  });

  it('passes through non-signed string', () => {
    expect(signedCookie('', SECRET)).toBe('');
    expect(signedCookie('foo', SECRET)).toBe('foo');
    expect(signedCookie('j:{}', SECRET)).toBe('j:{}');
  });

  it('returns unsigned value for signed string', () => {
    const str =
      's:labrador.retriever.Kyj/E4CS/wky0JA1hywe0kFz7okaZcL49VWBjWoGfcI';
    expect(signedCookie(str, SECRET)).toBe('labrador.retriever');
  });

  it('returns false for tampered signed string', () => {
    const str =
      's:golden.retriever.Kyj/E4CS/wky0JA1hywe0kFz7okaZcL49VWBjWoGfcI';
    expect(signedCookie(str, SECRET)).toBe(false);
  });

  describe('when secret is an array', () => {
    const SECRETS = ['puppies!', 'unused-secret', '3p$90-3#'];

    it('returns unsigned value for the first successful decoding', () => {
      const str1 =
        's:labrador.retriever.Kyj/E4CS/wky0JA1hywe0kFz7okaZcL49VWBjWoGfcI';
      expect(signedCookie(str1, SECRETS)).toBe('labrador.retriever');

      const str2 =
        's:labrador.retriever.b+9dVEwBZdzGVMyDRGvMMW8wZKV9SKW3HOfK5ETOXys';
      expect(signedCookie(str2, SECRETS)).toBe('labrador.retriever');
    });

    it('returns false if decoding fails for all secrets', () => {
      const str =
        's:golden.retriever.Kyj/E4CS/wky0JA1hywe0kFz7okaZcL49VWBjWoGfcI';
      expect(signedCookie(str, SECRETS)).toBe(false);
    });
  });
});

describe('signedCookies(obj, secret)', () => {
  const SECRET = 'puppies!';
  const { signedCookies } = cookieParser;

  it('is a function', () => {
    expect(typeof signedCookies).toBe('function');
  });

  it('ignores non-signed strings', () => {
    expect(signedCookies({}, SECRET)).toEqual({});
    expect(signedCookies({ foo: 'bar' }, SECRET)).toEqual({});
  });

  it('includes tampered strings as false', () => {
    const obj = {
      pup: 's:golden.retriever.Kyj/E4CS/wky0JA1hywe0kFz7okaZcL49VWBjWoGfcI'
    };
    expect(signedCookies(obj, SECRET)).toEqual({ pup: false });
  });

  it('removes tampered strings from original object', () => {
    const obj = {
      pup: 's:golden.retriever.Kyj/E4CS/wky0JA1hywe0kFz7okaZcL49VWBjWoGfcI'
    };
    signedCookies(obj, SECRET);
    expect(obj).toEqual({});
  });

  it('includes unsigned strings', () => {
    const obj = {
      pup: 's:labrador.retriever.Kyj/E4CS/wky0JA1hywe0kFz7okaZcL49VWBjWoGfcI'
    };
    expect(signedCookies(obj, SECRET)).toEqual({ pup: 'labrador.retriever' });
  });

  it('removes signed strings from original object', () => {
    const obj = {
      pup: 's:labrador.retriever.Kyj/E4CS/wky0JA1hywe0kFz7okaZcL49VWBjWoGfcI'
    };
    signedCookies(obj, SECRET);
    expect(obj).toEqual({});
  });

  it('leaves non-signed strings in original object', function () {
    const obj = {
      pup: 's:labrador.retriever.Kyj/E4CS/wky0JA1hywe0kFz7okaZcL49VWBjWoGfcI',
      foo: 'a non-sign string'
    };
    expect(signedCookies(obj, SECRET)).toEqual({ pup: 'labrador.retriever' });
    expect(obj).toEqual({ foo: 'a non-sign string' });
  });

  describe('when secret is an array', () => {
    const SECRETS = ['puppies!', 'unused-secret', '3p$90-3#'];

    it('includes unsigned strings for all secrets', () => {
      const obj = {
        foo: 's:labrador.retriever.Kyj/E4CS/wky0JA1hywe0kFz7okaZcL49VWBjWoGfcI',
        bar: 's:dachshund.V9lIF2y1aSA12KMrg2G+Po/VCK0nng4xofrcwcSWt3s'
      };
      expect(signedCookies(obj, SECRETS)).toEqual({
        foo: 'labrador.retriever',
        bar: 'dachshund'
      });
    });

    it('includes false if decoding fails for all secrets', () => {
      const obj = {
        foo: 's:golden.retriever.Kyj/E4CS/wky0JA1hywe0kFz7okaZcL49VWBjWoGfcI'
      };
      expect(signedCookies(obj, SECRETS)).toEqual({ foo: false });
    });
  });
});
