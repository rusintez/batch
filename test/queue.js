const Queue = require('../lib/queue');
const fs = require('fs');
const { resolve } = require('path');
const rimraf = require('rimraf').sync;

require('chai').should();

const repo = resolve(__dirname, 'repo');

describe('queue', () => {
  afterEach(() => {
    rimraf(repo);
  });

  describe('#constructor', () => {
    it('should create a new queue', () => {
      const queue = new Queue(repo);
      queue.should.be.instanceOf(Queue);
      queue._stopped.should.equal(false);
      queue._options.should.deep.equal({
        pollInterval: 200,
        taskTimeout: 10000,
        maxAttempts: 4
      });
    });
  });

  describe('#emit', () => {
    it('should create a new task', () => {
      const queue = new Queue(repo);

      queue.emit('taskA', { hello: 'world' });

      fs.readdirSync(repo)
        .should.deep.equal(['taskA']);

      fs.readdirSync(`${repo}/taskA`)
        .should.deep.equal(['dead', 'done', 'inprogress', 'queued']);

      const files = fs.readdirSync(`${repo}/taskA/queued`);
      files.should.have.length(1);

      const file = fs.readFileSync(`${repo}/taskA/queued/${files[0]}`);
      const message = JSON.parse(file);

      message.id.should.be.a('string');
      message.should.be.an('object');
      message.data.should.deep.equal({ hello: 'world' });
      message.createdAt.should.be.a('string');
      message.attempts.should.deep.equal([]);
      message.taskTimeout.should.equal(10000);
      message.maxAttempts.should.equal(4);
    });
  });

  describe('#on', () => {
    it('should consume tasks 1 by one', (done) => {
      const queue = new Queue(repo);
      queue.emit('taskB', { hello: 'world' });

      fs.readdirSync(`${repo}/taskB/queued`)
        .should.have.length(1);

      queue.on('taskB', (message) => {
        fs.readdirSync(`${repo}/taskB/queued`)
          .should.have.length(0);

        fs.readdirSync(`${repo}/taskB/inprogress`)
          .should.have.length(1);

        message.id.should.be.a('string');
        message.should.be.an('object');
        message.data.should.deep.equal({ hello: 'world' });
        message.createdAt.should.be.a('string');
        message.attempts.should.deep.equal([]);
        message.taskTimeout.should.equal(10000);
        message.maxAttempts.should.equal(4);

        setTimeout(() => {
          fs.readdirSync(`${repo}/taskB/inprogress`)
            .should.have.length(0);

          fs.readdirSync(`${repo}/taskB/done`)
            .should.have.length(1);

          queue.stop().then(done);
        }, 0);
      });
    });

    it('should persist the result', (done) => {
      const queue = new Queue(repo);
      queue.emit('taskC', { foo: 'bar' });
      queue.on('taskC', (message) => {
        setTimeout(() => {
          const files = fs.readdirSync(`${repo}/taskC/done`);
          const file = fs.readFileSync(`${repo}/taskC/done/${files[0]}`);

          const message = JSON.parse(file);
          message.attempts.should.have.length(1);

          const attempt = message.attempts[0];
          attempt.id.should.be.a('string');
          attempt.createdAt.should.be.a('string');
          attempt.processedAt.should.be.a('string');
          attempt.status.should.equal('success');
          attempt.result.should.deep.equal({ baz: 'qux' });

          queue.stop().then(done);
        }, 0);

        return { baz: 'qux' };
      });
    });

    it('should persist an error', (done) => {
      const queue = new Queue(repo);
      queue.emit('taskC', { foo: 'bar' });
      queue.on('taskC', (message) => {
        setTimeout(() => {
          const files = fs.readdirSync(`${repo}/taskC/queued`);
          const file = fs.readFileSync(`${repo}/taskC/queued/${files[0]}`);

          const message = JSON.parse(file);
          message.attempts.should.have.length(1);

          const attempt = message.attempts[0];
          attempt.id.should.be.a('string');
          attempt.createdAt.should.be.a('string');
          attempt.processedAt.should.be.a('string');
          attempt.status.should.equal('failure');
          attempt.error.should.be.an('object');
          attempt.error.name.should.equal('Error');
          attempt.error.message.should.equal('foo');
          attempt.error.stack.should.be.a('string');

          queue.stop().then(done);
        }, 0);

        throw new Error('foo');
      });
    });
  });
});
