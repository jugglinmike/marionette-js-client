var wire = require('json-wire-protocol');
var debug = require('debug')('marionette:tcp-sync');
var sockittome = require('Sockit-to-me');
var DEFAULT_HOST = 'localhost';
var DEFAULT_PORT = 2828;

function TcpSync(options) {
  if (!options) {
    options = {};
  }

  if ('port' in options) {
    this.port = options.port;
  }
  if ('host' in options) {
    this.host = options.host;
  }

  this.sockit = new sockittome.Sockit();
};

TcpSync.prototype.isSync = true;
TcpSync.prototype.host = DEFAULT_HOST;
TcpSync.prototype.port = DEFAULT_PORT;
TcpSync.prototype.connectionTimeout = 2000;
TcpSync.prototype.retryInterval = 300;

TcpSync.prototype.connect = function(callback) {
  var result;
  result = this.sockit.connect({ host: this.host, port: this.port });
  if (!this._beginConnect) {
    this._beginConnect = Date.now();
  }

  // TODO: Re-factor Sockit-to-me methods to throw errors (instead of returning
  // them)
  if (result instanceof Error) {
    if (Date.now() - this._beginConnect >= this.connectionTimeout) {
      callback(result);
    }
    setTimeout(this.connect.bind(this, callback), this.retryInterval);
  } else {
    // Ensure this method's resolution is asynchronous in all cases
    setTimeout(function() {
      debug('socket connected');
      delete this._beginConnect;

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

// Following the json-wire-protocol implementation, read one byte at a time
// until the 'separator' character is received. The data preceding the
// delimiter describes the length of the JSON string.
// TODO: Re-factor Sockit-to-me methods to throw errors (instead of returning
// them)
TcpSync.prototype._readResponse = function() {
  var buffer = '';
  var char, length;

  while (1) {
    char = this.sockit.read(1);
    if (char instanceof Error) {
      throw char;
    }

    char = char.toString();
    if (char === wire.separator) {
      length = parseInt(buffer, 10);
      break;
    }

    buffer += char;
  }

  return JSON.parse(this.sockit.read(length));
};

TcpSync.prototype.send = function(command, callback) {
  this.sockit.write(wire.stringify(command));
  return callback(this._readResponse());
};

TcpSync.prototype.close = function() {
  this.sockit.close();
};

module.exports = TcpSync;
