import {cleanupRpcObject} from '../../lib/webinspector';
import {describe, it} from 'node:test';
import {expect} from 'chai';

describe('webinspector helpers', function () {
  it('should cleanup an rpc object', function () {
    expect(
      cleanupRpcObject({
        bar: false,
        baz: null,
        foo: undefined,
        obj: {
          a: null,
          b: 'string',
          c: [1, 2, null],
        },
      }),
    ).to.eql({
      bar: false,
      obj: {
        b: 'string',
        c: [1, 2],
      },
    });
  });

  it('should leave an rpc object unchanged if nil', function () {
    expect(cleanupRpcObject(null)).to.be.null;
  });
});
