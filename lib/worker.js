/**
 * Worker wrapper
 */

/**
 * Module dependencies
 */

const { fork } = require('child_process');
const { EventEmitter } = require('events');
const ipc = require('./ipc');

class Worker extends EventEmitter {
  constructor (context, script, params = []) {
    super();
    this._stopped = false;
    this._init(context, script, params);
  }

  _init (context, script, params) {
    if (this._stopped) return;

    this._process = fork(`${__dirname}/child.js`, {
      cwd: process.cwd(),
      env: process.env,
      detached: false
      // silent: true
    });

    // TODO:
    // this._process.stdout.on('')

    this._process.on('disconnect', () => {
      this._init(context, script, params);
    });

    const { emitter, rpc } = ipc(this._process);

    this._emitter = emitter;
    this._remote = rpc(context);

    this._emitter.on('ready', () => {
      this._emitter.emit('init', { script, params });
      this.emit('ready');
    });
  }

  stop () {
    this._stopped = true;
    this._process && this._process.kill();
    return this;
  }
}

/**
 * Expose
 */

exports = module.exports = Worker;
