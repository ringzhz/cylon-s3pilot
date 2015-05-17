/* jshint node: true */
/* global source,describe,it,expect */
'use strict';

var Cylon = require('cylon');

var Pilot = source('pilot');

describe('Pilot', function() {
  var pilot = new Pilot({serialPort:'SERIAL_PORT'});

  it('is a Cylon pilot', function() {
    expect(pilot).to.be.an.instanceOf(Cylon.Adaptor);
  });

  it('needs tests');
});
