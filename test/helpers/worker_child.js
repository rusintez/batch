exports = module.exports = (queue, ...params) => {
  queue.on('taskA', (message) => {
    queue.emit('taskB', message);
  });

  if (params.length) {
    queue.emit('taskA', params);
  } else {
    queue.emit('taskError');
  }
  
  queue.on('taskError', (message) => {
    throw new Error('Failure');
  });
}