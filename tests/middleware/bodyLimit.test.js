'use strict';

const express = require('express');
const http = require('http');
const bodyLimit = require('../../src/middleware/bodyLimit');

function buildApp() {
  const app = express();
  app.use(bodyLimit);
  app.use(express.json());
  app.post('/echo', (req, res) => {
    res.status(200).json({ ok: true, body: req.body });
  });
  return app;
}

function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('bodyLimit middleware', () => {
  let server;
  let port;

  beforeAll(async () => {
    server = await startServer(buildApp());
    port = server.address().port;
  });

  afterAll(async () => {
    await stopServer(server);
  });

  test('allows normal JSON requests under the limit', (done) => {
    const payload = JSON.stringify({ hello: 'world' });
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/echo',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(data)).toEqual({ ok: true, body: { hello: 'world' } });
            done();
          } catch (err) {
            done(err);
          }
        });
      }
    );
    req.on('error', done);
    req.end(payload);
  });

  test('rejects chunked requests exceeding the limit with 413', (done) => {
    const chunk = Buffer.alloc(1024, 'a');
    const totalChunks = 20; // 20 KB > 10 KB limit
    let sent = 0;

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/echo',
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=----test',
          'Transfer-Encoding': 'chunked',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          try {
            expect(res.statusCode).toBe(413);
            const parsed = JSON.parse(data);
            expect(parsed.code).toBe('PAYLOAD_TOO_LARGE');
            done();
          } catch (err) {
            done(err);
          }
        });
      }
    );

    req.on('error', (err) => {
      // Connection may be destroyed by the server after rejection; that is
      // acceptable as long as we already received the 413 response.
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        return;
      }
      done(err);
    });

    function writeNext() {
      if (sent >= totalChunks) {
        req.end();
        return;
      }
      sent += 1;
      const canContinue = req.write(chunk);
      if (canContinue) {
        setImmediate(writeNext);
      } else {
        req.once('drain', writeNext);
      }
    }

    writeNext();
  });
});
