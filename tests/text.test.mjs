import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, formatBytes, MAX_CHARACTERS } from '../src/text.js';

test('empty and whitespace-only input produces no chunks', () => {
  assert.deepEqual(chunkText(''), []);
  assert.deepEqual(chunkText(' \n '), []);
});
test('short text remains a single part', () => {
  assert.deepEqual(chunkText('Good morning.', 40), ['Good morning.']);
});
test('separates paragraphs without merging unrelated content', () => {
  assert.deepEqual(chunkText('First paragraph.\n\nSecond paragraph.', 20),
    ['First paragraph.', 'Second paragraph.']);
});
test('splits long sentences into bounded parts', () => {
  const parts = chunkText('a'.repeat(97), 30);
  assert.deepEqual(parts.map((part) => part.length), [30, 30, 30, 7]);
});
test('all chunk output stays within the limit', () => {
  const text = ('This is a test sentence. ').repeat(100);
  assert.ok(chunkText(text, 120).every((part) => part.length <= 120));
});
test('formatBytes handles progress reporting', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(3111894696), '3.11 GB');
});
test('input limit is finite and conservative', () => {
  assert.equal(MAX_CHARACTERS, 4000);
});
