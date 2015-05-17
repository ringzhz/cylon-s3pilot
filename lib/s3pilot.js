/* jshint node:true */
'use strict';

var Adaptor = require('./pilot'),
    Driver = require('./driver');

module.exports = {
  adaptors: ['s3pilot'],
  drivers: ['s3pilot'],
  dependencies: [],

  adaptor: function(opts) {
    return new Adaptor(opts);
  },

  driver: function(opts) {
    return new Driver(opts);
  }
};
