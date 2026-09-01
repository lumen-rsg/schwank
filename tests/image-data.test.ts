import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../lib/api-errors';
import { validateDataImage } from '../lib/image-data';

const onePixelPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const limits = {
  maximumBytes: 200,
  maximumWidth: 10,
  maximumHeight: 10,
  maximumPixels: 100,
};

void test('accepts a bounded image and permits explicit removal', () => {
  assert.equal(validateDataImage(onePixelPng, limits), onePixelPng);
  assert.equal(validateDataImage('', limits), null);
});

void test('rejects MIME spoofing and malformed image containers', () => {
  assert.throws(
    () =>
      validateDataImage(onePixelPng.replace('image/png', 'image/jpeg'), limits),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'image_invalid',
  );
  assert.throws(
    () => validateDataImage('data:image/png;base64,AAAA', limits),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'image_invalid',
  );
});

void test('enforces decoded byte and pixel limits', () => {
  assert.throws(
    () =>
      validateDataImage(onePixelPng, {
        ...limits,
        maximumBytes: 16,
      }),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'image_too_large',
  );
  assert.throws(
    () =>
      validateDataImage(onePixelPng, {
        ...limits,
        maximumPixels: 0,
      }),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'image_too_large',
  );
});
