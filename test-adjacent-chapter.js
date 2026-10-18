const assert = require('assert');
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
	if (id === 'obsidian') {
		return {
			getLanguage: () => 'es',
			normalizePath: (p) => p.replace(/\\/g, '/'),
			Plugin: class {},
			ItemView: class {
				constructor(leaf) {
					this.leaf = leaf;
					this.containerEl = {
						children: [],
						createDiv: () => ({ addClass: () => {}, empty: () => {}, addEventListener: () => {} }),
					};
				}
			},
			WorkspaceLeaf: class {},
			MarkdownRenderer: class {
				static async renderMarkdown() {}
			},
			PluginSettingTab: class {},
			Setting: class { setName() { return this; } setDesc() { return this; } addText() { return this; } addDropdown() { return this; } addToggle() { return this; } },
			SettingGroup: class { setHeading() { return this; } addSetting() { return this; } },
			Notice: class {},
			EditorSuggest: class {},
			AbstractInputSuggest: class {},
			SuggestModal: class {},
			MarkdownView: class {},
			TFolder: class {},
			TFile: class {},
		};
	}
	return originalRequire.apply(this, arguments);
};

// We will import from ./src/adjacent-chapter once compiled or directly
let adjacentModule;
try {
	adjacentModule = require('./src/adjacent-chapter.ts');
} catch {
	// If direct ts require fails in plain node, we can test via built bundle or ts-node / transpiled
	try {
		adjacentModule = require('./main.js');
	} catch (e) {
		console.log('Module not yet built, expecting TDD red phase:', e.message);
	}
}

console.log('Running Adjacent Chapter Calculator tests...');

if (!adjacentModule || !adjacentModule.getAdjacentChapter) {
	console.error('FAIL: getAdjacentChapter is not defined yet (RED phase).');
	process.exit(1);
}

const { getAdjacentChapter, getBookChapterCount, BIBLE_BOOK_ORDER, BIBLE_BOOK_CHAPTERS } = adjacentModule;

// Test cases
let passed = 0;

function test(desc, fn) {
	try {
		fn();
		console.log(`PASS: ${desc}`);
		passed++;
	} catch (err) {
		console.error(`FAIL: ${desc} - ${err.message}`);
		process.exit(1);
	}
}

test('Genesis 1 has no previous chapter', () => {
	const prev = getAdjacentChapter('gen', 1, 'prev');
	assert.strictEqual(prev, null);
});

test('Genesis 1 next is Genesis 2', () => {
	const next = getAdjacentChapter('gen', 1, 'next');
	assert.ok(next);
	assert.strictEqual(next.book.id, 'gen');
	assert.strictEqual(next.chapter, 2);
});

test('Genesis 50 next is Exodus 1 (crossing book boundary)', () => {
	const next = getAdjacentChapter('gen', 50, 'next');
	assert.ok(next);
	assert.strictEqual(next.book.id, 'exo');
	assert.strictEqual(next.chapter, 1);
});

test('Exodus 1 prev is Genesis 50 (crossing book boundary backwards)', () => {
	const prev = getAdjacentChapter('exo', 1, 'prev');
	assert.ok(prev);
	assert.strictEqual(prev.book.id, 'gen');
	assert.strictEqual(prev.chapter, 50);
});

test('Malachi 4 next is Matthew 1 (Testament boundary)', () => {
	const next = getAdjacentChapter('mal', 4, 'next');
	assert.ok(next);
	assert.strictEqual(next.book.id, 'mat');
	assert.strictEqual(next.chapter, 1);
});

test('Matthew 1 prev is Malachi 4 (Testament boundary backwards)', () => {
	const prev = getAdjacentChapter('mat', 1, 'prev');
	assert.ok(prev);
	assert.strictEqual(prev.book.id, 'mal');
	assert.strictEqual(prev.chapter, 4);
});

test('Revelation 22 has no next chapter', () => {
	const next = getAdjacentChapter('rev', 22, 'next');
	assert.strictEqual(next, null);
});

test('Single-chapter book: Obadiah 1 prev is Amos 9 and next is Jonah 1', () => {
	const prev = getAdjacentChapter('oba', 1, 'prev');
	assert.ok(prev);
	assert.strictEqual(prev.book.id, 'amo');
	assert.strictEqual(prev.chapter, 9);

	const next = getAdjacentChapter('oba', 1, 'next');
	assert.ok(next);
	assert.strictEqual(next.book.id, 'jon');
	assert.strictEqual(next.chapter, 1);
});

test('Book alias resolution: "Génesis" or "genesis" works as input', () => {
	const next = getAdjacentChapter('Génesis', 50, 'next');
	assert.ok(next);
	assert.strictEqual(next.book.id, 'exo');
	assert.strictEqual(next.chapter, 1);

	const prev = getAdjacentChapter('mateo', 1, 'prev');
	assert.ok(prev);
	assert.strictEqual(prev.book.id, 'mal');
	assert.strictEqual(prev.chapter, 4);
});

test('Chapter counts are accurate across all 66 books', () => {
	assert.strictEqual(getBookChapterCount('gen'), 50);
	assert.strictEqual(getBookChapterCount('psa'), 150);
	assert.strictEqual(getBookChapterCount('rev'), 22);
	assert.strictEqual(getBookChapterCount('oba'), 1);
});

test('Verifies boundary navigation forward and backward across all 66 books', () => {
	assert.strictEqual(BIBLE_BOOK_ORDER.length, 66, 'There should be 66 canonical books');

	for (let i = 0; i < BIBLE_BOOK_ORDER.length; i++) {
		const bookId = BIBLE_BOOK_ORDER[i];
		const totalChapters = BIBLE_BOOK_CHAPTERS[bookId];
		assert.ok(totalChapters > 0, `Book ${bookId} must have at least 1 chapter`);

		// 1. First chapter backwards transition
		const prev = getAdjacentChapter(bookId, 1, 'prev');
		if (i === 0) {
			assert.strictEqual(prev, null, `Genesis 1 should have no prev chapter`);
		} else {
			const expectedPrevBookId = BIBLE_BOOK_ORDER[i - 1];
			const expectedPrevChapters = BIBLE_BOOK_CHAPTERS[expectedPrevBookId];
			assert.ok(prev, `${bookId} 1 prev should exist`);
			assert.strictEqual(prev.book.id, expectedPrevBookId, `${bookId} 1 prev book should be ${expectedPrevBookId}`);
			assert.strictEqual(prev.chapter, expectedPrevChapters, `${bookId} 1 prev chapter should be ${expectedPrevChapters}`);
		}

		// 2. Last chapter forwards transition
		const next = getAdjacentChapter(bookId, totalChapters, 'next');
		if (i === BIBLE_BOOK_ORDER.length - 1) {
			assert.strictEqual(next, null, `Revelation ${totalChapters} should have no next chapter`);
		} else {
			const expectedNextBookId = BIBLE_BOOK_ORDER[i + 1];
			assert.ok(next, `${bookId} ${totalChapters} next should exist`);
			assert.strictEqual(next.book.id, expectedNextBookId, `${bookId} ${totalChapters} next book should be ${expectedNextBookId}`);
			assert.strictEqual(next.chapter, 1, `${bookId} ${totalChapters} next chapter should be 1`);
		}

		// 3. Intra-book navigation for books with multiple chapters
		if (totalChapters > 1) {
			const nextMid = getAdjacentChapter(bookId, 1, 'next');
			assert.ok(nextMid);
			assert.strictEqual(nextMid.book.id, bookId);
			assert.strictEqual(nextMid.chapter, 2);

			const prevMid = getAdjacentChapter(bookId, totalChapters, 'prev');
			assert.ok(prevMid);
			assert.strictEqual(prevMid.book.id, bookId);
			assert.strictEqual(prevMid.chapter, totalChapters - 1);
		}
	}
});

console.log(`\nAll ${passed} tests passed!`);
