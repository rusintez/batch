/**
 * Batch node api
 */

/**
 * Module dependencies
 */

const Queue = require('./queue');
const Worker = require('./worker');
const { resolve } = require('path');
// TODO: use robust implementation, assume workers can die at any time
// const { createPool } = require('generic-pool');
const log = require('debug')('batch');

/**
 * Batch process a script
 *
 * @param {Object} options, execution options
 * @param {String} script, path to script to execute
 * @param {Array<String>} params, script params
 */

function batch (options, script, params) {
  log('initialize batch with %j, %s %j', options, script, params);

  const base = resolve(process.cwd(), options.base || '');
  log('base is %s', base);

  let numWorkers = options.numWorkers || 1;
  log('number of workers is %s', numWorkers);

  const queue = new Queue(base, options);

  while (numWorkers--) {
    // prevent stupid eslint errors;
    this.w = new Worker(queue, script, params);
  }
}

/**
 * Expose
 */

exports = module.exports = batch;
