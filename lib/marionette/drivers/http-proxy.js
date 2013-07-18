(function(module, ns) {

  var DEFAULT_PORT = 60023;
  var DEFAULT_MARIONETTE_PORT = 2828;
  var DEFAULT_HOST = 'localhost';
  // TODO: Use the module's name once it is updated to specify its index and
  // published to NPM.
  var sockittome = require(require('path').join(__dirname, '..', '..', '..',
    'node_modules', 'Sockit-to-me', 'build', 'Release', 'sockit'));
  var debug = require('debug')('marionette:http-proxy');

  var fork, proxyRunnerPath,
      XHR = ns.require('xhr');

  proxyRunnerPath = __dirname + '/../../http-proxy-runner';
  fork = require('child_process').fork;

  var readResponse = function(socket) {
    var match;
    var response = {
      header: readResponseHeader(socket)
    };

    match = response.header.match(/^Content-Length:\s*(\d+)\r\n/m);
    if (match) {
      response.body = socket.read(+match[1]).toString();
      response.body = JSON.parse(response.body);
    }

    return response;
  };
  var readResponseHeader = function(socket) {
    var buffer = '';
    while (!/\r\n\r\n/.test(buffer)) {
      buffer += socket.read(1);
    }
    return buffer;
  };
  var createRequest = function(options) {
    var request = [
      options.method + ' / HTTP/1.1',
      'User-Agent: node.js',
      'Accept: */*'
    ];
    var content;

    if ('data' in options) {
      content = options.data;
      if (typeof content !== 'string') {
        content = JSON.stringify(content);
      }
      request.push('Content-Type: application/json');
      request.push('Content-Length: ' + Buffer.byteLength(content));
    }
    request.push('');
    if (content) {
      request.push(content);
    }
    return request.join('\r\n');
  };

  function request(host, port, options) {
    options.method = options.method || 'POST';

    debug('REQUEST: ', options.method + ' ' + host + ':' + port);
    debug('REQUEST DATA: ', options.data);
    var sockit = new sockittome.Sockit();
    sockit.connect({ host: host, port: port });
    sockit.write(createRequest(options));
    var response = readResponse(sockit);
    sockit.close();
    return response.body;
  }

  function requestOld(host, port, options) {
    var url = 'http://' + host + ':' + port;
    options.url = url;
    options.async = false;
    options.headers = { 'Content-Type': 'application/json' };

    var xhr = new XHR(options);
    var response;
    xhr.send(function(json) {
      if (typeof(json) === 'string') {
        // for node
        json = JSON.parse(json);
      }
      response = json;
    });
    return response;
  }

  function HttpProxy(options) {
    if (options && options.hostname) {
      this.hostname = options.hostname;
    }

    if (options && options.port) {
      this.port = options.port;
    }

    if (options && options.marionettePort) {
      this.marionettePort = options.marionettePort;
    }

    this.url = 'http://' + this.hostname + ':' + this.port;
  }

  HttpProxy.prototype = {
    hostname: DEFAULT_HOST,
    port: DEFAULT_PORT,
    marionettePort: DEFAULT_MARIONETTE_PORT,
    isSync: true,
    defaultCallback: function(err, result) {
      if (err) {
        throw err;
      }
      return result;
    },

    _connectToMarionette: function(callback) {
      var data = request(this.hostname, this.port, {
        method: 'POST',
        data: { port: this.marionettePort }
      });
      this._id = data.id;
      callback();
    },

    connect: function(callback) {
      this.serverProcess = fork(
        proxyRunnerPath,
        [
          this.port,
          this.hostname
        ],
        { stdio: 'inherit' }
      );

      this.serverProcess.on('message', function(data) {
        if (data === 'ready') {
          this._connectToMarionette(callback);
        }
      }.bind(this));
    },

    send: function(command, callback) {
      var wrapper = { id: this._id, payload: command };
      var result = request(this.hostname, this.port, {
        method: 'PUT', data: wrapper
      });
      return callback(result);
    },

    close: function() {
      var response = request(this.hostname, this.port, {
        method: 'DELETE', data: { id: this._id }
      });
      if (this.serverProcess) {
        this.serverProcess.kill();
      }
      return response;
    }
  };

  module.exports = HttpProxy;

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('drivers/http-proxy'), Marionette] :
    [module, require('../marionette')]
));

