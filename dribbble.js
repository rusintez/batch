const xray = require('x-ray');

var x = xray();

exports = module.exports = (queue, ...params) => {
  x('https://dribbble.com', ['picture img@src'])((err, data) => {
    if (err) {
      throw err;
    }

    data.forEach((url) => {
      queue.emit('imgsrc', { url });
    });
  });

  setTimeout(() => {
    throw new Error('Fuckup');
  }, 2000);

  queue.on('imgsrc', (message) => {
    const url = message.data.url;
    console.log(url);
  });
};
