import test from 'node:test';
import assert from 'node:assert/strict';
import { displayPhone, formatPhone, isValidPhone, phoneHref } from '../src/lib/phone.js';

test('formats any common input the same way', () => {
  for (const input of ['5551234567', '555-123-4567', '555.123.4567', '(555)123-4567', '+1 555 123 4567', '1-555-123-4567']) {
    assert.equal(formatPhone(input), '(555) 123-4567', input);
  }
});
test('formats partial input while typing', () => {
  assert.equal(formatPhone(''), '');
  assert.equal(formatPhone('5'), '(5');
  assert.equal(formatPhone('5551'), '(555) 1');
  assert.equal(formatPhone('5551234'), '(555) 123-4');
});
test('stops at 10 digits', () => {
  assert.equal(formatPhone('555123456789'), '(555) 123-4567');
});
test('ignores letters and symbols', () => {
  assert.equal(formatPhone('abc'), '');
  assert.equal(formatPhone('555-CALL-1234'), '(555) 123-4');
});
test('only a full 10-digit number is valid', () => {
  assert.equal(isValidPhone('(555) 123-4567'), true);
  assert.equal(isValidPhone('(555) 123-456'), false);
  assert.equal(isValidPhone('5551234567'), false);
});
test('display cleans up older saved numbers when it can', () => {
  assert.equal(displayPhone('555.123.4567'), '(555) 123-4567');
  assert.equal(displayPhone('555-0100'), '555-0100');
});
test('tel links use the digits', () => {
  assert.equal(phoneHref('(555) 123-4567'), 'tel:+15551234567');
});
