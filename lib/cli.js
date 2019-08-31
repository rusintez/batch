#!/usr/bin/env node

const program = require('commander');
const batch = require('./batch');

program
  .version('0.1.0')
  .usage('[options] <script> [script-params]')
  .option('-w, --workers [numWorkers]', 'Number of parallel workers', parseInt)
  .option('-b, --base [path]', 'Relative path to persistence folder')
  .option('-p, --poll-interval [pollInterval]', 'Number of ms to wait between queue polling', parseInt)
  .option('-t, --timeout [taskTimeout]', 'Task execution timeout ms', parseInt)
  .option('-a, --attempts [maxAttempts]', 'Maximum number of attempts before task is discarded', parseInt)
  .parse(process.argv);

const options = {
  ...program.workers && { numWorkers: program.workers },
  ...program.base && { base: program.base },
  ...program.pollInterval && { pollInterval: program.pollInterval },
  ...program.timeout && { taskTimeout: program.timeout },
  ...program.attempts && { maxAttempts: program.attempts }
};

const script = program.args[0];
const params = program.args.slice(1);

if (!script) throw new Error('script is missing');

batch(options, script, params);
