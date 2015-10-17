/* jshint node:true */
'use strict';

var Cylon = require('cylon');

var Pose = function (x, y, h) {
    this.x = x;
    this.y = y;
    this.h = h;
    //console.log('new pose: ' + x + ',' + y + ',' + h);
};
Pose.fromMessage = function (msg) {
    if (msg && msg.T === 'Pose') {
        return new Pose(msg.X, msg.Y, msg.H);
    }
    return null;
};
Pose.prototype.equals = function (rhs) {
    if (typeof rhs !== 'object') {
        return false;
    }

    return (
        rhs.x === this.x &&
        rhs.y === this.y &&
        rhs.h === this.h
    );
}


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
        var configOptions = {
            Geom: [opts.geometry['ticksPerMeter'], opts.geometry['mMax']]
        };
        if (opts.mPID) {
            configOptions['mPID'] = opts.mPID;
        }
        if (opts.hPID) {
            configOptions['hPID'] = opts.hPID;
        }
        if (opts.ahrsCalibration) {
            var aC = opts.ahrsCalibration;
            configOptions['MPU'] = [aC['a_x'], aC['a_y'], aC['a_z'], aC['g_x'], aC['g_y'], aC['g_z']];
        }
        this.configure(configOptions);

        //this.initializeGeometry(opts.geometry);
        //if (opts.ahrsCalibration) {
        //    this.calibrateAhrs(opts.ahrsCalibration);
        //}
        //if (opts.mPID) {
        //    this.configure({mPID: opts.mPID});
        //}
        //if (opts.hPID) {
        //    this.configure({hPID: opts.hPID});
        //}
    }.bind(this);

    this._motorsEnabled = false;
    this._boardReady = false;

    this.details = {
        pose: new Pose(0, 0, 0),
        status: 'INITIALIZING', //TODO: Enumify
        config: {
            geometry: opts.geometry,
            ahrsCalibration: opts.ahrsCalibration
        },
        motorPids: [],
        headingPids: []
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
        'pose',
        'event'
    ];

    this.connection.on('data', this.routeDataEvent.bind(this));
};

Cylon.Utils.subclass(Driver, Cylon.Driver);

Driver.prototype.start = function (cb) {
    console.log('Driver Online. Waiting for Board.\nDon\'t move the bot!');
    this.details.status = 'Driver Online. Waiting for Board.\nDon\'t move the bot!';
    cb();
};

Driver.prototype.boardReady = function () {
    if (!this._boardReady) {
        console.log('Board Ready. Driver awaiting commands.');
        this.details.status = 'Board Ready. Driver awaiting commands.';
        this.sendSerial({
            'Cmd': 'Init' //<- Not legit, but first serial msg doesn't work for some reason.
        });
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
            'Cmd': 'ESC',
            'Value': 1
        });
        this._motorsEnabled = true;
    }
};

Driver.prototype.setMotorPower = function (opts) {
    verifyOpts(opts, ['M1', 'M2']);
    opts.Cmd = 'MOV';

    console.log('this guy wants to set motor power');
    console.log(opts);
    this.sendSerial(opts);
};

Driver.prototype.driveDistance = function (opts) {
    verifyOpts(opts, ['Dist']);
    // Optional opts:
    // Hdg
    // Pwr
    opts.Cmd = 'MOV';

    opts.Dist = normalizeNumber(opts.Dist);
    //TODO: this more places.
    if(opts.Hdg) {
        opts.Hdg = normalizeNumber(opts.Hdg);
    }
    if(opts.Pwr) {
        opts.Pwr = normalizeNumber(opts.Pwr);
    }

    console.log('this guy wants to move');
    console.log(opts);
    this.sendSerial(opts);
};

//Driver.prototype.driveToCoords = function (opts) {
//    verifyOpts(opts, ['X', 'Y']);
//    opts.Cmd = 'GOTOXY';
//    this.sendSerial(opts);
//};

Driver.prototype.turnTo = function (opts) {
    verifyOpts(opts, ['Hdg']);
    // Optional opts:
    // Pwr

    //TODO: this more places.
    opts.Hdg = normalizeNumber(opts.Hdg);
    if(opts.Pwr) {
        opts.Pwr = normalizeNumber(opts.Pwr);
    }

    console.log('this guy wants to turn');
    console.log(opts);
    opts.Cmd = 'ROTA';
    this.sendSerial(opts);
};

Driver.prototype.calibrateAhrs = function (opts) {
    verifyOpts(opts, ['a_x', 'a_y', 'a_z', 'g_x', 'g_y', 'g_z']);
    this.configure({
        'MPU': [opts['a_x'], opts['a_y'], opts['a_z'], opts['g_x'], opts['g_y'], opts['g_z']]
    });
};
Driver.prototype.initializeGeometry = function (opts) {
    verifyOpts(opts, ['ticksPerMeter', 'mMax']);
    this.configure({
        'Geom': [opts['ticksPerMeter'], opts['mMax']]
    });
};
Driver.prototype.configure = function (opts) {
    // Optional opts:
    // Geom: [ticksPerMeter, mMax]
    // mPID: [Kp, Ki, Kd]
    // hPID: [Kp, Ki, Kd]
    // MPU: [AccelOffsetX,Y,Z, GyroOffsetX,Y,Z]
    opts.Cmd = 'CONFIG';
    console.log('this guy wants to configure');
    console.log(opts);
    this.sendSerial(opts);
};

Driver.prototype.reset = function (opts) {
    if (!opts) {
        opts = {};
    }
    // Optional opts:
    // X
    // Y
    // H
    opts.Cmd = 'RESET';
    this.sendSerial(opts);
};

Driver.prototype.routeDataEvent = function (data) {
    try {
        var msg = JSON.parse(data);
        switch (msg.T) {
            case 'Log':
                if (this.onFirstData) {
                    console.log('first data');
                    setTimeout(function() {
                        this.onFirstData();
                        this.onFirstData = null;
                    }.bind(this), 200);
                }
                console.log(msg);
                break;
            case 'Pose':
                this.details.pose = Pose.fromMessage(msg);
                this.emit('pose', this.details.pose);
                break;
            case 'Moved'://get rid of this
                this.boardReady();
                this.emit('ready');
                break;
            case 'Motors':
                this.logPid(msg);
                break;
            case 'HdgPid':
                this.logHeadingPid(msg);
                break;
            case 'Event':
                this.emit('event', msg);
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
};

Driver.prototype.logPid = function (val) {
    val.ts = new Date().getTime();
    //console.log(JSON.stringify(val,null,'\t').split('\n').join(''))
    this.details.motorPids.push(val);
    while (this.details.motorPids.length > 1000) {
        this.details.motorPids.shift();
    }
};
Driver.prototype.logHeadingPid = function (val) {
    val.ts = new Date().getTime();
    //console.log(JSON.stringify(val, null, '\t').split('\n').join(''));
    this.details.headingPids.push(val);
    while (this.details.headingPids.length > 1000) {
        this.details.headingPids.shift();
    }
};

function normalizeNumber(num) {
    num = Math.floor(num * 10000);
    if(num % 10000 === 0) {
        num += 1;
    }
    return num / 10000;
}