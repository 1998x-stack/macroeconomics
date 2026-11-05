// Run with: node --test tests/markdown.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'markdown.js'), 'utf8');

test('export includes each nested comment exactly once', () => {
  let ready, save, exported = '', downloads = 0;
  const parent = { closest: () => null };
  const heading = { outerHTML: '<h1>Lesson</h1>', parentElement: parent, addEventListener() {} };
  const paragraph = { outerHTML: '<p>Text<div class="comment">Note</div></p>', parentElement: parent, addEventListener() {} };
  const document = {
    addEventListener(type, cb) { if (type === 'DOMContentLoaded') ready = cb; },
    querySelectorAll(selector) {
      if (selector === 'h1, h2, h3, h4, h5, h6') return [heading];
      if (selector === 'p, li') return [paragraph];
      return [heading, paragraph];
    },
    createElement() {
      return { addEventListener(type, cb) { if (type === 'click') save = cb; }, click() { downloads++; } };
    },
    body: { appendChild() {} }
  };
  class FakeBlob { constructor(parts) { exported = parts.join(''); } }
  vm.runInNewContext(source, {
    window: {}, document, Blob: FakeBlob,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    MathJax: { typesetPromise: () => Promise.resolve() }
  });
  ready();
  save();
  assert.equal(downloads, 1);
  assert.equal(exported.match(/class="comment"/g)?.length, 1);
  assert.equal(exported.match(/<h1>/g)?.length, 1);
});

test('double submit does not append duplicate comments', () => {
  let ready, dblclick, enter, blur, appended = 0;
  const element = {
    style: {},
    querySelector: () => null,
    addEventListener(type, cb) { if (type === 'dblclick') dblclick = cb; },
    appendChild(node) { node.parentNode = this; appended++; },
    removeChild(node) { node.parentNode = null; }
  };
  const document = {
    addEventListener(type, cb) { if (type === 'DOMContentLoaded') ready = cb; },
    querySelectorAll(selector) { return selector === 'p, li' ? [element] : []; },
    createElement(tag) {
      if (tag === 'input') return {
        value: 'Note', addEventListener(type, cb) {
          if (type === 'keydown') enter = cb;
          if (type === 'blur') blur = cb;
        }, focus() {}
      };
      if (tag === 'div') return {
        className: '', parentNode: null, appendChild(node) { node.parentNode = this; },
        remove() { this.parentNode?.removeChild(this); }
      };
      return { addEventListener() {} };
    },
    body: { appendChild() {} }
  };
  vm.runInNewContext(source, {
    window: {}, document, Blob: class {},
    URL: { createObjectURL() {}, revokeObjectURL() {} },
    MathJax: { typesetPromise: () => Promise.resolve() }
  });
  ready();
  dblclick();
  enter({ key: 'Enter' });
  blur();
  assert.equal(appended, 2); // input container and one comment
});
