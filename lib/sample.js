import B from 'bluebird';

const p = new B.resolve('123');

async function func () {
  return await p;
}

export default { func };
