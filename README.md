# batch

## Installation

    $ npm install --global batch

## Usage

    $ batch [options] script [job-args...]

### Options

  - `workers`, number of workers to execute in parallel, default 1
  - `base`, path to tasks folder, default cwd
  - `poll-interval`, amount of ms to wait between queue polling, default 200
  - `timeout`, task execution timeout in ms, default 10000
  - `attempts`, number of failed attempts before discarding a task, default 4
  - `ui`, open batch progress dashboard in the browser

#### Example

    $ batch --workers 5 --base data --attempts 2 scrape.js http://dribbble.com

### Job definition

```js
exports = module.exports = (queue, args...) => {
  queue.on('taskA', async (data) => {
    // perform a task
  });

  // create a task
  queue.emit('taskA', someData);
}
```

#### Example

```js
// scrape.js

const request = require('request');
const extractLinks = require('...');

exports = module.exports = function scrape (queue, url) {
  if (url) {
    queue.emit('page', { url });
  }

  queue.on('page', async (message) => {
    const page = await request.get(message.data.url);
    
    extractLinks(page).forEach((url) => {
      queue.emit('page', { url });
    });

    return page;
  });
}
```

### Base Folder structure

  - `repo/` base folder for all queues
    - `queue1..N` queue folder
      - `stage1..4` task stage (queued, inprogress, complete, dead)
        - `task-id.json` time based uuid, task inside

## Development

### Project structure

  - `lib/cli.js` batch cli param parsing and invokation
  - `lib/batch.js` glue queue, ipc and worker together
  - `lib/queue.js` disk based message queue (at least once delivery)
  - `lib/ipc.js` wrap child_process + IPC
  - `lib/worker.js` execute a given script, communicate back to master
  - `lib/client.js` script wrapper (injects queue and args)
  - `lib/deferred.js` defer a promise (utility)

### Author

Vladimir Popov <rusintez@gmail.com>

### License

MIT