import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PHOTO_LENGTH, MAX_UPLOAD_BYTES, centerSquare, isPhoto, photoProblem } from '../src/lib/photo.js';

test('isPhoto accepts small JPEG, PNG and WebP data URLs', () => {
  assert.equal(isPhoto('data:image/jpeg;base64,/9j/4AAQSkZJRg=='), true);
  assert.equal(isPhoto('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(isPhoto('data:image/webp;base64,UklGRg'), true);
});

test('isPhoto rejects missing values, links, other file types and broken data', () => {
  assert.equal(isPhoto(undefined), false);
  assert.equal(isPhoto(null), false);
  assert.equal(isPhoto(''), false);
  assert.equal(isPhoto('https://example.com/me.jpg'), false);
  assert.equal(isPhoto('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isPhoto('data:text/html;base64,PGgxPg=='), false);
  assert.equal(isPhoto('data:image/jpeg;base64,<script>'), false);
});

test('isPhoto rejects a photo over the size limit', () => {
  const prefix = 'data:image/jpeg;base64,';
  assert.equal(isPhoto(prefix + 'A'.repeat(MAX_PHOTO_LENGTH - prefix.length)), true);
  assert.equal(isPhoto(prefix + 'A'.repeat(MAX_PHOTO_LENGTH - prefix.length + 1)), false);
});

test('photoProblem allows pictures and explains everything else', () => {
  assert.equal(photoProblem({ type: 'image/jpeg', size: 2_000_000 }), null);
  assert.equal(photoProblem({ type: 'image/png', size: MAX_UPLOAD_BYTES }), null);
  assert.match(photoProblem(null), /Choose a picture/);
  assert.match(photoProblem({ type: 'application/pdf', size: 1000 }), /isn't a picture/);
  assert.match(photoProblem({ type: '', size: 1000 }), /isn't a picture/);
  assert.match(photoProblem({ type: 'image/jpeg', size: MAX_UPLOAD_BYTES + 1 }), /too large/);
});

test('centerSquare crops the middle of wide, tall and square images', () => {
  assert.deepEqual(centerSquare(400, 200), { sx: 100, sy: 0, side: 200 });
  assert.deepEqual(centerSquare(200, 400), { sx: 0, sy: 100, side: 200 });
  assert.deepEqual(centerSquare(300, 300), { sx: 0, sy: 0, side: 300 });
});
