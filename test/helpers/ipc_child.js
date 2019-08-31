const ipc = require('../../lib/ipc');
const { emitter, rpc } = ipc(process);
emitter.emit('log', 'hello world');

const remote = rpc({
  sum (a, b) {
    return a + b;
  },
  echo (message) {
    remote.echo(`child: ${message}`);
  }
});
