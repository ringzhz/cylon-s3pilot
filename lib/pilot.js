/* jshint node:true */
'use strict';

var CONNECTION_INITIALIZATION_TIME = 2000; //ms

var Cylon = require('cylon');

var serialPort = require('serialport');
var SerialPort = serialPort.SerialPort;


var Pilot = module.exports = function (opts) {
    Pilot.__super__.constructor.apply(this, arguments);

    opts = opts || {};
    if (!opts.serialPort) {
        throw new Error('S3 Pilot Board Misconfigured.' +
            '\nYou must pass a serialPort option:' +
            'ex: {serialPort: \'/dev/ttyACM0\'}');
    }
    this.serialPort = opts.serialPort;

    this.connector = this.arduinoSerialPort = null;

    this.connected = false;
    this.connectionInterval = 0;

    this.setConnectionInterval();

    //TODO: emit events
    this.events = [
//        'connect',
//        'disconnect',
        'data'
    ];
    
};

Cylon.Utils.subclass(Pilot, Cylon.Adaptor);


/**
 * Connects to the adaptor
 *
 * @param {Function} callback to be triggered when connected
 * @return {null}
 */
Pilot.prototype.connect = function (cb) {
    this.disconnect(function () {});

    var my = this;
    try {
        this.initSerialPort();
        this.arduinoSerialPort.open(function (error) {
            if (error) {
                console.log('Failed to connect to Pilot Board!\n' + error + '\n\nRetrying...');
                my.setConnectionInterval();
            } else {
                clearInterval(my.connectionInterval);
                my.connectionInterval = 0;
                my.connected = true;
                console.log('Connected to Arduino.');
                //TODO: move to pilot.onConnect event handler;


                my.events.forEach(function (name) {
                    my.defineAdaptorEvent(name);
                });
                setTimeout(cb, CONNECTION_INITIALIZATION_TIME);
            }
        });
    } catch (err) {
        console.log('Couldn\'t connect to Arduino on port ' +
            this.serialPort + '. Do you have permission?');
        console.error(err);
        throw err;
    }
};

/**
 * Disconnects from the adaptor
 *
 * @param {Function} callback to be triggered when disconnected
 * @return {null}
 */
Pilot.prototype.disconnect = function (cb) {
    if (this.arduinoSerialPort) {
        this.arduinoSerialPort.close();
    }
    this.connected = false;
    cb();
};
Pilot.prototype.setConnectionInterval = function () {
    if (!this.connectionInterval) {
        this.connectionInterval = setInterval((function (my) {
            return function () {
                my.connect();
            };
        }(this)), 2000);
    }
};
Pilot.prototype.initSerialPort = function () {
    this.connector = this.arduinoSerialPort = new SerialPort(this.serialPort, {
        baudrate: 115200,
        parser: serialPort.parsers.readline('\n')
    }, false);

    this.arduinoSerialPort.on('close', function () {
        this.setConnectionInterval();
    }.bind(this));
};
Pilot.prototype.isConnected = function() {
    return this.connected;
};