/**
 * Disk based job queue
 * at least once delivery
 *
 * @api
 *
 * const Queue = require('./queue');
 * const queue = new Queue(__dirname + '/repo'[, { options }]);
 *
 * queue.emit(name, data[, options]);
 *
 * queue.on(name, async ({
 *  done,
 *  data,
 *  createdAt,
 *  maxAttempts,
 *  taskTimeout,
 *  attempts: [{ id, createdAt, error, result, processedAt, status }],
 *  id
 * }) => ...);
 *
 * queue.dead((job) => ...);
 *
 * queue.reset(name);
 * await queue.stop();
 */

const fs = require('fs');
const { resolve } = require('path');
const uuid = require('uuid/v1');
const mkdirp = require('mkdirp').sync;
const rimraf = require('rimraf').sync;
const serializeError = require('serialize-error');
const Deferred = require('./deferred');

const defaults = {
  pollInterval: 200,
  taskTimeout: 10000,
  maxAttempts: 4
};

const createMessage = (data, opts) => {
  return {
    id: uuid(),
    data,
    createdAt: new Date().toISOString(),
    attempts: [],
    taskTimeout: opts.taskTimeout,
    maxAttempts: opts.maxAttempts
  };
};

// TODO: touch inprogress every 10 sec,
// if inprogress havent been touched longer than timeout duration
// consider it failed

class Queue {
  constructor (base, options) {
    this._options = Object.assign({}, defaults, options);

    this._stopped = false;
    this._stopDef = new Deferred();

    this._inflight = [];
    this._deadListeners = [];
    this._root = resolve(process.cwd(), base);

    mkdirp(this._root);

    this._write = (name, stage, message) => {
      mkdirp(resolve(this._root, name, 'queued'));
      mkdirp(resolve(this._root, name, 'inprogress'));
      mkdirp(resolve(this._root, name, 'dead'));
      mkdirp(resolve(this._root, name, 'done'));
      const filename = resolve(this._root, name, stage, `${message.id}.json`);
      fs.writeFileSync(filename, JSON.stringify(message, null, 2));
    };

    this._read = (name, stage, filename) => {
      const path = resolve(this._root, name, stage, filename);
      return JSON.parse(fs.readFileSync(path));
    };

    this._move = (name, from, to, filename) => {
      fs.renameSync(
        resolve(this._root, name, from, filename),
        resolve(this._root, name, to, filename)
      );
    };

    this._list = (name, stage) => {
      try {
        return fs
          .readdirSync(resolve(this._root, name, stage))
          .map((file) => {
            const stats = fs.statSync(resolve(this._root, name, stage, file));
            return { file, time: stats.mtimeMs };
          })
          .sort((a, b) => a.time - b.time)
          .map(({ file }) => file);
      } catch (e) {
        return [];
      }
    };

    this._delete = (name, stage, message) => {
      const filename = resolve(this._root, name, stage, `${message.id}.json`);
      fs.unlinkSync(filename, JSON.stringify(message, null, 2));
    };

    this._reset = (name) => {
      // TODO: stop processing of all listeners in that namespace
      rimraf(resolve(this._root, name));
    };
  }

  emit (name, data, options) {
    const opts = Object.assign({}, this._options, options);
    this._write(name, 'queued', createMessage(data, opts));
  }

  on (name, fn) {
    const listener = {};
    this._inflight.push(listener);

    const poll = () => {
      if (this._stopped) {
        this._inflight.splice(this._inflight.indexOf(listener), 1);
        if (!this._inflight.length) {
          this._stopDef.resolve();
        }
        return;
      }

      const files = this._list(name, 'queued');

      if (!files.length) {
        return setTimeout(poll, this._options.pollInterval);
      }

      const filename = files.shift();

      this._move(name, 'queued', 'inprogress', filename);

      const message = this._read(name, 'inprogress', filename);

      const attempt = {
        id: uuid(),
        createdAt: new Date().toISOString(),
        processedAt: null,
        status: null,
        error: null,
        result: null
      };

      const prom = new Promise((resolve, reject) => {
        try {
          Promise.race([
            Promise
              .resolve(fn(message))
              .then(resolve)
              .catch(reject),
            new Promise((resolve, reject) => setTimeout(() => {
              reject(new Error('timeout'));
            }, this._options.taskTimeout))
          ]);
        } catch (e) {
          reject(e);
        }
      });

      prom
        .then((result) => {
          attempt.result = result;
          attempt.processedAt = new Date().toISOString();
          attempt.status = 'success';
          message.attempts.push(attempt);
          this._write(name, 'done', message);
          this._delete(name, 'inprogress', message);
        })
        .catch((error) => {
          attempt.error = serializeError(error);
          attempt.processedAt = new Date().toISOString();
          attempt.status = 'failure';
          message.attempts.push(attempt);
          const maxAttempts = this._options.maxAttempts;
          const numAttempts = message.attempts.length;
          const stage = numAttempts >= maxAttempts ? 'dead' : 'queued';
          this._write(name, stage, message);
          this._delete(name, 'inprogress', message);
          if (stage === 'dead') {
            this._deadListeners.forEach((listener) => {
              listener(message);
            });
          }
        })
        .finally(() => setTimeout(poll, this._options.pollInterval));
    };

    poll();

    return this;
  }

  dead (fn) {
    this._deadListeners.push(fn);
    return this;
  }

  reset (name) {
    this._reset(name);
    return this;
  }

  stop () {
    this._stopped = true;
    return this._stopDef.promise;
  }
}

/**
 * Expose
 */

exports = module.exports = Queue;
