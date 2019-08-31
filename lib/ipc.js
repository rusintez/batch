/**
 * IPC communation over event emitter and rpc
 */
const { EventEmitter } = require('events');
const Deferred = require('./deferred');
const uuid = require('uuid/v1');

function createEmitter (proc) {
  const emitter = new EventEmitter();
  const emit = emitter.emit.bind(emitter);

  let dead = false;

  emitter.emit = (channel, ...args) => {
    if (!dead) {
      proc.send({ channel, args });
    } else {
      console.log('child missed', channel, args);
    }
  };

  proc.on('message', ({ channel, args }) => {
    emit(channel, ...args);
  });

  proc.on('error', (error) => {
    emit('error', error);
  });

  proc.on('exit', (error) => {
    dead = true;
    emit('exit', error);
  });

  return emitter;
}

function timeout (duration) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('timeout')), duration);
  });
}

function createRPC (remote, api, options = { timeout: 10000 }) {
  const incoming = {};
  const outgoing = {};
  const fds = {};

  remote.on('request', (request) => {
    incoming[request.id] = request;

    request.args = request.args.map((arg, index) => {
      if (request.fds[index]) {
        // TODO: add async processing (, wait for child to respond with the promise?)
        return (...args) => remote.emit('callback', { id: request.fds[index], args });
      } else {
        return arg;
      }
    });

    const fn = () => new Promise((resolve, reject) => {
      try {
        resolve(api[request.method](...request.args));
      } catch (e) {
        reject(e);
      }
    });

    Promise
      .race([fn(), /* cancel(deferred), */ timeout(options.timeout)])
      .then((result) => remote.emit('response', { id: request.id, result }))
      .catch((error) => remote.emit('response', { id: request.id, error }))
      .finally(() => Reflect.deleteProperty(incoming, request.id));
  });

  remote.on('response', ({ id, result, error }) => {
    const request = outgoing[id];
    Reflect.deleteProperty(outgoing, id);
    if (!request) return console.log('received a response to an non-existing request', id);
    if (error) return request.deferred.reject(error);
    request.deferred.resolve(result);
  });

  remote.on('callback', ({ id, args }) => fds[id](...args));

  return new Proxy({}, {
    get (obj, prop) {
      return prop in obj ? obj[prop] : (...args) => {
        const request = { id: uuid(), method: prop, args, deferred: new Deferred() };
        outgoing[request.id] = request;
        remote.emit('request', {
          ...request,
          deferred: null,
          fds: request
            .args
            .map((fn, index) => {
              if (typeof fn !== 'function') return null;
              const id = uuid();
              fds[id] = fn;
              return { index, id };
            })
            .filter(Boolean)
            .reduce((mem, { index, id }) => ({ ...mem, [index]: id }), {})
        });
        return request.deferred.promise;
      };
    }
  });
}

exports = module.exports = function createIPC (child, options) {
  const emitter = createEmitter(child);

  return {
    emitter,
    rpc (api) {
      return createRPC(emitter, api, options);
    }
  };
};
