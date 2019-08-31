const Worker = require('../lib/worker');
const { EventEmitter } = require('events');

require('chai').should();

describe('worker', () => {
  it('should spawn a child process', (done) => {
    const emitter = new EventEmitter();

    emitter.once('taskA', (params) => {
      params.should.deep.equal(['foo', 'bar']);
      emitter.emit('taskA', params);
    });

    let calls = 0;

    emitter.on('taskB', (params) => {
      params.should.deep.equal(['foo', 'bar']);
      calls++;
      if (calls === 2) {
        worker.stop();
        done();
      }
    });

    const worker = new Worker(emitter, `${__dirname}/helpers/worker_child.js`, ['foo', 'bar']);
  });

  it('should restart a child on failure', (done) => {
    const emitter = new EventEmitter();
    const worker = new Worker(emitter, `${__dirname}/helpers/worker_child.js`);

    worker.on('ready', () => {
      emitter.emit('taskError', 'foo');
      done();
    });

    emitter.once('taskError', () => {
      emitter.emit('taskError');
    });
  });
});
