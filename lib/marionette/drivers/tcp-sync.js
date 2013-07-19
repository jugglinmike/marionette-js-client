var Abstract = require('./abstract');
var wire = require('json-wire-protocol');
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

TcpSync.prototype.connect = function(callback) {
  var result;
  result = this.sockit.connect({ host: this.host, port: this.marionettePort });
  if (!this._beginConnect) {
    this._beginConnect = Date.now();
  }
  this._connectionAttempts++;
  if (result instanceof Error) {
    if (Date.now() - this._beginConnect >= this.connectionTimeout) {
      callback(new Error('Connection timed out'));
    }
    setTimeout(this.connect.bind(this, callback), this.retryInterval);
  } else {
    setTimeout(function() {
      this._readResponse();
      callback();
    }.bind(this), 0);
  }
};

TcpSync.prototype.defaultCallback = function(err, result) {
  if (err) {
    throw err;
  }
  return result;
};

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

  return response;
};

TcpSync.prototype.send = function(command, callback) {
  this.sockit.write(wire.stringify(command));
  return callback(this._readResponse());
};

TcpSync.prototype.close = function() {
  this.sockit.close();
};

module.exports = TcpSync;
