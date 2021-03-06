// Flags: --no-warnings
'use strict';
const common = require('../common');
if (!common.hasQuic)
  common.skip('missing quic');

// Test that .connect() can be called multiple times with different servers.

const assert = require('assert');
const { createQuicSocket } = require('net');

const { key, cert, ca } = require('../common/quic');
const Countdown = require('../common/countdown');

const options = { key, cert, ca, alpn: 'meow' };
const kCount = 3;
const servers = [];

const client = createQuicSocket({ client: options });
const countdown = new Countdown(kCount, () => {
  client.close();
});

async function connect(server, client) {
  const req = await client.connect({
    address: 'localhost',
    port: server.endpoints[0].address.port
  });

  req.on('stream', common.mustCall((stream) => {
    stream.on('data', common.mustCall(
      (chk) => assert.strictEqual(chk.toString(), 'Hi!')));
    stream.on('end', common.mustCall(() => {
      server.close();
      req.close();
      countdown.dec();
    }));
  }));

  req.on('close', common.mustCall());
}

(async function() {
  for (let i = 0; i < kCount; i++) {
    const server = createQuicSocket({ server: options });

    server.on('session', common.mustCall((session) => {
      session.on('secure', common.mustCall(() => {
        const stream = session.openStream({ halfOpen: true });
        stream.end('Hi!');
      }));
    }));

    server.on('close', common.mustCall());

    servers.push(server);
  }

  await Promise.all(servers.map((server) => server.listen()));

  await Promise.all(servers.map((server) => connect(server, client)));

})().then(common.mustCall());
