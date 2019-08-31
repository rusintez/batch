const { fork } = require('child_process');
const ipc = require('../lib/ipc');

require('chai').should();

describe('ipc', () => {
  it('should create an event emitter', (done) => {
    const child = fork(`${__dirname}/helpers/ipc_child.js`);
    const { emitter } = ipc(child);

    emitter.on('log', (message) => {
      message.should.equal('hello world');
      child.kill();
      done();
    });
  });

  it('should create an rpc channel', (done) => {
    const child = fork(`${__dirname}/helpers/ipc_child.js`);
    const { rpc } = ipc(child);
    const remote = rpc({
      echo (message) {
        message.should.equal('child: hello world');
        child.kill();
        done();
      }
    });
    remote.sum(1, 2).then((result) => {
      result.should.equal(3);
      remote.echo('hello world');
    });
  });
});
