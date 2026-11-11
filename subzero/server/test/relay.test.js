'use strict';
// End-to-end test: two clients register, publish/fetch a bundle, and relay both
// an online envelope and a store-and-forward (offline) envelope.
const assert = require('assert');
const WebSocket = require('ws');
const { server } = require('../src/server');

const PORT = 8099;
process.env.PORT = String(PORT);

function open() {
  return new Promise((res) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    ws.on('open', () => res(ws));
  });
}
function next(ws) {
  return new Promise((res) => ws.once('message', (m) => res(JSON.parse(m.toString()))));
}
const send = (ws, o) => ws.send(JSON.stringify(o));

async function main() {
  await new Promise((res) => server.listen(PORT, res));
  let failures = 0;
  try {
    // --- online relay ---
    const alice = await open();
    const bob = await open();
    send(alice, { t: 'reg', address: 'alice-address-0001' });
    send(bob, { t: 'reg', address: 'bob-address-0001' });

    send(bob, { t: 'bundle', address: 'bob-address-0001', bundle: 'BOB_PUBLIC_BUNDLE' });
    await new Promise((r) => setTimeout(r, 40)); // let the publish land first
    send(alice, { t: 'getBundle', address: 'bob-address-0001' });
    const bundleReply = await next(alice);
    assert.strictEqual(bundleReply.t, 'bundle');
    assert.strictEqual(bundleReply.bundle, 'BOB_PUBLIC_BUNDLE');

    send(alice, { t: 'env', to: 'bob-address-0001', kind: 'message', payload: 'CIPHERTEXT_1' });
    const delivered = await next(bob);
    assert.strictEqual(delivered.t, 'env');
    assert.strictEqual(delivered.payload, 'CIPHERTEXT_1');
    assert.ok(delivered.from === undefined, 'sealed sender: no from field');
    console.log('  ✓ online envelope relayed, sealed-sender');

    // --- store-and-forward while offline ---
    bob.close();
    await new Promise((r) => setTimeout(r, 50));
    send(alice, { t: 'env', to: 'bob-address-0001', kind: 'message', payload: 'CIPHERTEXT_2' });
    const ack = await next(alice);
    assert.strictEqual(ack.t, 'ack');
    assert.strictEqual(ack.queued, true);

    const bob2 = await open();
    send(bob2, { t: 'reg', address: 'bob-address-0001' });
    const flushed = await next(bob2);
    assert.strictEqual(flushed.payload, 'CIPHERTEXT_2');
    console.log('  ✓ offline envelope queued and flushed on reconnect');

    // --- signaling is not queued when peer offline ---
    const carol = await open();
    send(carol, { t: 'env', to: 'nobody-address-0001', kind: 'signal', payload: 'SDP' });
    const sigAck = await next(carol);
    assert.strictEqual(sigAck.queued, false);
    console.log('  ✓ call signaling dropped (not queued) when peer offline');

    alice.close(); bob2.close(); carol.close();
    console.log('ALL RELAY TESTS PASSED');
  } catch (e) {
    failures++;
    console.error('TEST FAILED:', e.message);
  } finally {
    server.close();
    process.exit(failures ? 1 : 0);
  }
}
main();
