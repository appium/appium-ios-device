import {sample} from '..';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';


chai.should();
chai.use(chaiAsPromised);

describe('sample', function () {
  it('should-work', async function () {
    let res = await sample.func();
    res.should.equal('123');
  });
});
