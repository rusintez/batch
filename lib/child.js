const ipc = require('./ipc');
const { resolve } = require('path');
const { emitter, rpc } = ipc(process);

emitter
  .on('init', ({ script, params }) => {
    const remote = rpc({});
    const path = resolve(process.cwd(), script);
    const exec = require(path);
    exec(remote, ...params);
  })
  .emit('ready');

process
  .on('uncaughtException', (e) => {
    console.error(e);
    process.exit(1);
  })
  .on('unhandledRejection', (e, p) => {
    console.error(e, p);
    process.exit(1);
  });