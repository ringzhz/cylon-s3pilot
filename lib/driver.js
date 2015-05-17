/* jshint node:true */
'use strict';

var Cylon = require('cylon');

var Pose = function (x, y, h) {
    this.x = x;
    this.y = y;
    this.h = h;
    console.log('new pose: ' + x + ',' + y + ',' + h);
};
Pose.fromMessage = function (msg) {
    if (msg && msg.T === 'Pose') {
        return new Pose(msg.X, msg.Y, msg.H);
    }
    return null;
};

function verifyOpts(opts, requiredOpts) {
    var missingOpts = [];
    if (!opts) {
        missingOpts = requiredOpts;
    }
    requiredOpts.forEach(function (requiredOpt) {
        if (typeof opts[requiredOpt] === 'undefined') {
            missingOpts.push(requiredOpt);
        }
    });
    if (missingOpts && missingOpts.length > 0) {
        throw new Error('Missing required options: [' + missingOpts.join(',') + ']');
    }
}

var Driver = module.exports = function Driver(opts) {
    Driver.__super__.constructor.apply(this, arguments);
    opts = opts || {};

    if (!opts.geometry) {
        throw new Error('You must specify your robot\'s geometry');
    }


    //TODO: use real events
    this.onFirstData = function () {
        this.initializeGeometry(opts.geometry);
        if (opts.ahrsCalibration) {
            this.calibrateAhrs({
                Vals: opts.ahrsCalibration
            });
        }
    }.bind(this);

    this._motorsEnabled = false;
    this._boardReady = false;

    this.details = {
        pose: new Pose(0, 0, 0)
    };

    this.events = [
        /**
         * Emitted when the Pilot is ready to receive commands.
         * @event ready
         */
        'ready',
        /**
         * Emitted when the robot has moved.
         * {
         *   x: x          //offset from origin in meters
         *   y: y          //offset from origin in meters
         *   h: height     //offset from origin in degrees (can be negative)
         * }
         * @event pose
         */
        'pose'
    ];

    this.connection.on('data', this.routeDataEvent.bind(this));
};

Cylon.Utils.subclass(Driver, Cylon.Driver);

Driver.prototype.start = function (cb) {
    console.log('Driver Online. Waiting for Board.\nDon\'t move the bot!');
    this.boardReadyCb = cb;
};

Driver.prototype.boardReady = function () {
    if (!this._boardReady) {
        console.log('Board Ready. Driver awaiting commands.');
        this.sendSerial({
            'Cmd': 'Init' //<- Not legit, but first serial msg doesn't work for some reason.
        });
        this.boardReadyCb();
        this._boardReady = true;
    }
};
Driver.prototype.halt = function (cb) {
    cb();
};

Driver.prototype.sendSerial = function (msg) {
    if (this.connection.arduinoSerialPort && this.connection.isConnected()) {
        this.connection.arduinoSerialPort.write(JSON.stringify(msg) + '\n');
    }
};

Driver.prototype.enableMotors = function () {
    if (!this._motorsEnabled) {
        console.log('Enabling motors');
        this.sendSerial({
            'Cmd': 'Esc',
            'Value': 1
        });
        this._motorsEnabled = true;
    }
};

Driver.prototype.initializeGeometry = function (opts) {
    verifyOpts(opts, ['TPR', 'Diam', 'Base', 'mMax']);

    console.log('Initializing Geometry');
    opts.Cmd = 'Geom';
    this.sendSerial(opts);
};

Driver.prototype.calibrateAhrs = function (opts) {
    verifyOpts(opts, ['Vals']);

    console.log('Calibrating AHRS');
    opts.Cmd = 'CALI';
    this.sendSerial(opts);
};

Driver.prototype.setMotorPower = function (opts) {
    verifyOpts(opts, ['M1', 'M2']);
    opts.Cmd = 'Pwr';
    this.sendSerial(opts);
};

Driver.prototype.routeDataEvent = function (data) {
    try {
        var msg = JSON.parse(data);
        switch (msg.T) {
        case 'Pose':
            this.details.pose = Pose.fromMessage(msg);
            this.emit('pose', this.details.pose);
            break;
        case 'Moved':
            this.boardReady();
            this.emit('ready');
            break;
        default:
            console.log(msg);
        }
    } catch (err) {
        // Wasn't a JSON msg. Still could be interesting.
        var MOTOR_OUT_REGEX = /M(\d)$/;
        if (!data.match(MOTOR_OUT_REGEX)) {
            console.error(data);
        }
    }
    if (this.onFirstData) {
        this.onFirstData();
        this.onFirstData = null;
    }
};