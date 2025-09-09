/*
https://github.com/uuidjs/uuid

The MIT License (MIT)

Copyright (c) 2010-2020 Robert Kieffer and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { validate } from './validate';

export function parse(uuid: string): Uint8Array {
  if (!validate(uuid)) {
    throw TypeError('Invalid UUID');
  }

  let v: number;
  return Uint8Array.of(
    (v = parseInt(uuid.slice(0, 8), 16)) >>> 24,
    (v >>> 16) & 0xff,
    (v >>> 8) & 0xff,
    v & 0xff,

    // Parse ........-####-....-....-............
    (v = parseInt(uuid.slice(9, 13), 16)) >>> 8,
    v & 0xff,

    // Parse ........-....-####-....-............
    (v = parseInt(uuid.slice(14, 18), 16)) >>> 8,
    v & 0xff,

    // Parse ........-....-....-####-............
    (v = parseInt(uuid.slice(19, 23), 16)) >>> 8,
    v & 0xff,

    // Parse ........-....-....-....-############
    // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)
    ((v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000) & 0xff,
    (v / 0x100000000) & 0xff,
    (v >>> 24) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 8) & 0xff,
    v & 0xff
  );
}
