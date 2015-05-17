/* jshint node: true */
/* global source,describe,it,expect */
'use strict';

var s3pilot = source('s3pilot');

var Adaptor = source('pilot'),
    Driver = source('driver');

describe('s3pilot', function() {
  describe('#adaptors', function() {
    it('is an array of supplied adaptors', function() {
      expect(s3pilot.adaptors).to.be.eql(['s3pilot']);
    });
  });

  describe('#drivers', function() {
    it('is an array of supplied drivers', function() {
      expect(s3pilot.drivers).to.be.eql(['s3pilot']);
    });
  });

  describe('#dependencies', function() {
    it('is an array of supplied dependencies', function() {
      expect(s3pilot.dependencies).to.be.eql([]);
    });
  });

  describe('#driver', function() {
    it('returns an instance of the Driver', function() {
      expect(s3pilot.driver()).to.be.instanceOf(Driver);
    });
  });

  describe('#adaptor', function() {
    it('returns an instance of the Adaptor', function() {
      expect(s3pilot.adaptor({
          serialPort: 'SERIAL_PORT'
      })).to.be.instanceOf(Adaptor);
    });
  });
});
