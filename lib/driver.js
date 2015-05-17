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

var Driver = module.exports = function Driver(opts) {
    Driver.__super__.constructor.apply(this, arguments);
    opts = opts || {};

    this._motorsEnabled = false;

    this.details = {
        pose: new Pose(0, 0, 0)
    };

    this.events = [
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

    this.events.forEach(function (e) {
        this.defineDriverEvent(e);
    }.bind(this));

    this.connection.on('data', this.routeDataEvent.bind(this));
};

Cylon.Utils.subclass(Driver, Cylon.Driver);

Driver.prototype.start = function (cb) {
    console.log('Driver Ready. Initializing Board.');
    this.sendSerial({
        'Cmd': 'Init' //<- Not legit, but first serial msg doesn't work for some reason.
    });
    cb();
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
    if (!opts || !opts.TPR || !opts.Diam || !opts.Base || !opts.mMax) {
        throw new Error('Incorrect Geometry Parameters');
        //TODO: better error msg
    }

    console.log('Initializing Geometry');
    opts.Cmd = 'Geom';
    this.sendSerial(opts);
};

Driver.prototype.calibrateAhrs = function (opts) {
    if (!opts || !opts.Vals) {
        throw new Error('Incorrect Geometry Parameters');
        //TODO: better error msg
    }

    console.log('Calibrating AHRS');
    opts.Cmd = 'CALI';
    this.sendSerial(opts);
};

Driver.prototype.setMotorPower = function (opts) {
    if (!opts || !opts.M1 || !opts.M2) {
        throw new Error('Incorrect Geometry Parameters');
        //TODO: better error msg
    }

    console.log('Calibrating AHRS');
    opts.Cmd = 'CALI';
    this.sendSerial(opts);
};

Driver.prototype.routeDataEvent = function (data) {
    try {
        var msg = JSON.parse(data);
        switch(msg.T) {
            case 'Pose':    this.details.pose = Pose.fromMessage(msg);
                            this.emit('pose', this.details.pose);
                            break;
            default:        console.log(msg);    
        }
    } catch (err) {
        // Wasn't a JSON msg. Still could be interesting.
        var MOTOR_OUT_REGEX = /M(\d)$/;
        if (!data.match(MOTOR_OUT_REGEX)) {
            console.error(data);
        }
    }
};