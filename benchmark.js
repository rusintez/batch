const Freq = require('frequency-counter');
const counter = new Freq();

exports = module.exports = (queue, ...params) => {
  queue.on('taskA', (message) => {
    queue.emit('taskB', message.data);
    queue.emit('taskB', message.data);
    counter.inc();
  });

  queue.on('taskB', (message) => {
    queue.emit('taskA', message.data);
    queue.emit('taskA', message.data);
    counter.inc();
  });

  if (params[0] === 'initialize') {
    queue.emit('taskA', { hello: 'world' });
  }
}

setInterval(() => {
  console.log('rpm: ' + counter.freq());
}, 5000);