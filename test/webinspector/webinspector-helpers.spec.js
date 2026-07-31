import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {cleanupRpcObject} from '../../lib/webinspector';

describe('webinspector helpers', function () {
  it('should cleanup an rpc object', function () {
    assert.deepStrictEqual(
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
      {
        bar: false,
        obj: {
          b: 'string',
          c: [1, 2],
        },
      },
    );
  });

  it('should leave an rpc object unchanged if nil', function () {
    assert.strictEqual(cleanupRpcObject(null), null);
  });
});
