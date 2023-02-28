import chai from 'chai';
import { cleanupRpcObject } from '../../lib/webinspector';


chai.should();

describe('webinspector helpers', function () {

  it('should cleanup an rpc object', function () {
    cleanupRpcObject({
      bar: false,
      baz: null,
      foo: undefined,
      obj: {
        a: null,
        b: 'string',
        c: [1, 2, null],
      }
    }).should.eql({
      bar: false,
      obj: {
        b: 'string',
        c: [1, 2],
      }
    });
  });

  it('should leave an rpc object unchanged if nil', function () {
    (cleanupRpcObject(null) === null).should.be.true;
  });
});
