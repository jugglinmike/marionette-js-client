var Abstract = require('./abstract');
var debug = require('debug')('marionette:tcp-sync');
var sockittome = require(require('path').join(__dirname, '..', '..', '..',
  'node_modules', 'Sockit-to-me', 'build', 'Release', 'sockit'));
var debug = require('debug')('marionette:http-proxy');
var DEFAULT_HOST = 'localhost';
var DEFAULT_PORT = 60023;
var DEFAULT_MARIONETTE_PORT = 2828;

function TcpSync(options) {
  if (!options) {
    options = {};
  }

  Abstract.call(this, options);
  this.connectionId = 0;

  if ('marionettePort' in options) {
    this.marionettePort = options.marionettePort;
  }
  this.sockit = new sockittome.Sockit();
};

TcpSync.prototype = Object.create(Abstract.prototype);

TcpSync.prototype.isSync = true;
TcpSync.prototype.host = DEFAULT_HOST;
TcpSync.prototype.port = DEFAULT_PORT;
TcpSync.prototype.marionettePort = DEFAULT_MARIONETTE_PORT;
TcpSync.prototype.connectionTimeout = 2000;
TcpSync.prototype.retryInterval = 300;

TcpSync.prototype._connect = function() {
  var result;
  result = this.sockit.connect({ host: this.host, port: this.marionettePort });
  if (!this._beginConnect) {
    this._beginConnect = Date.now();
  }
  this._connectionAttempts++;
  if (result instanceof Error) {
    if (Date.now() - this._beginConnect >= this.connectionTimeout) {
      throw new Error('Connection timed out');
    }
    setTimeout(this._connect.bind(this), this.retryInterval);
  } else {
    setTimeout(this._readResponse.bind(this), 0);
  }
};
var wire = require('json-wire-protocol');

// Read one byte at a time until an error is returned or a valid JSON string
// has been emitted.
TcpSync.prototype._readResponse = function() {
  var buffer = '';
  var char, response;

  while (1) {
    char = this.sockit.read(1);
    if (char instanceof Error) {
      throw char;
    }
    buffer += char.toString();
    try {
      response = wire.parse(new Buffer(buffer));
      break;
    } catch (err) {}
  }

  this._onDeviceResponse({
    id: this.connectionId,
    response: response
  });
};

TcpSync.prototype._sendCommand = function(command) {
  console.log('writing ', command, 'to socket');
  this.sockit.write(wire.stringify(command));
  this._readResponse();
};

TcpSync.prototype._close = function() {
  this.sockit.close();
};

module.exports = TcpSync;
