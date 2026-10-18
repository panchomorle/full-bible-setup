// Mock obsidian module for testing in Node
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
	if (id === 'obsidian') {
		return {
			getLanguage: () => 'es',
			normalizePath: (p) => p.replace(/\\/g, '/'),
			Plugin: class {},
			PluginSettingTab: class {},
			Setting: class { setName() { return this; } setDesc() { return this; } addText() { return this; } addDropdown() { return this; } addToggle() { return this; } },
			SettingGroup: class { setHeading() { return this; } addSetting() { return this; } },
			Notice: class {},
			EditorSuggest: class {},
			AbstractInputSuggest: class {},
			SuggestModal: class {
				constructor(app) { this.app = app; }
				setPlaceholder() {}
			},
			MarkdownView: class {},
			ItemView: class {},
			MarkdownRenderer: { renderMarkdown: () => Promise.resolve() },
		};
	}
	return originalRequire.apply(this, arguments);
};

const assert = require('assert');
const plugin = require('./main.js');
const { OmniboxParser, QuickVerseSearchModal } = plugin;

console.log('Running Comprehensive Omnibox Parser & Classification specification tests...\n');

// 1. Omnibox query classification test suite
const testCases = [
	// Book shortcuts (both Old and New Testaments)
	{ query: 'gn', expected: { bookId: 'gen', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'ex', expected: { bookId: 'exo', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'lv', expected: { bookId: 'lev', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'dt', expected: { bookId: 'deu', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'sal', expected: { bookId: 'psa', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'is', expected: { bookId: 'isa', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'mt', expected: { bookId: 'mat', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'mr', expected: { bookId: 'mrk', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'lc', expected: { bookId: 'luk', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'jn', expected: { bookId: 'jhn', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'ro', expected: { bookId: 'rom', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: '1co', expected: { bookId: '1co', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'ap', expected: { bookId: 'rev', chapter: 1, verse: 1 }, category: 'shortcut' },
	{ query: 'ju', expected: { bookId: 'jdg', chapter: 1, verse: 1 }, category: 'shortcut' },

	// Full book names
	{ query: 'genesis', expected: { bookId: 'gen', chapter: 1, verse: 1 }, category: 'book' },
	{ query: 'éxodo', expected: { bookId: 'exo', chapter: 1, verse: 1 }, category: 'book' },
	{ query: 'juan', expected: { bookId: 'jhn', chapter: 1, verse: 1 }, category: 'book' },
	{ query: 'apocalipsis', expected: { bookId: 'rev', chapter: 1, verse: 1 }, category: 'book' },

	// Chapter queries (space-separated and attached)
	{ query: 'juan 3', expected: { bookId: 'jhn', chapter: 3, verse: 1 }, category: 'chapter' },
	{ query: 'gn 2', expected: { bookId: 'gen', chapter: 2, verse: 1 }, category: 'chapter' },
	{ query: 'salmo 23', expected: { bookId: 'psa', chapter: 23, verse: 1 }, category: 'chapter' },
	{ query: '1 co 13', expected: { bookId: '1co', chapter: 13, verse: 1 }, category: 'chapter' },
	{ query: 'exodo 20', expected: { bookId: 'exo', chapter: 20, verse: 1 }, category: 'chapter' },
	{ query: 'éxodo 20', expected: { bookId: 'exo', chapter: 20, verse: 1 }, category: 'chapter' },
	{ query: 'hebreos 11', expected: { bookId: 'heb', chapter: 11, verse: 1 }, category: 'chapter' },
	{ query: 'romanos 8', expected: { bookId: 'rom', chapter: 8, verse: 1 }, category: 'chapter' },
	{ query: 'jn3', expected: { bookId: 'jhn', chapter: 3, verse: 1 }, category: 'chapter_attached' },
	{ query: 'gen1', expected: { bookId: 'gen', chapter: 1, verse: 1 }, category: 'chapter_attached' },
	{ query: 'apoc22', expected: { bookId: 'rev', chapter: 22, verse: 1 }, category: 'chapter_attached' },

	// Verse queries (single, attached, and ranges)
	{ query: 'juan 3:16', expected: { bookId: 'jhn', chapter: 3, verse: 16 }, category: 'verse' },
	{ query: '1 jn 1:9', expected: { bookId: '1jn', chapter: 1, verse: 9 }, category: 'verse' },
	{ query: '1co 13:4-8', expected: { bookId: '1co', chapter: 13, verse: 4 }, category: 'verse_range' },
	{ query: 'sal 23:1', expected: { bookId: 'psa', chapter: 23, verse: 1 }, category: 'verse' },
	{ query: 'rom 8:28', expected: { bookId: 'rom', chapter: 8, verse: 28 }, category: 'verse' },
	{ query: 'ap 22:20', expected: { bookId: 'rev', chapter: 22, verse: 20 }, category: 'verse' },
	{ query: 'jn3:16', expected: { bookId: 'jhn', chapter: 3, verse: 16 }, category: 'verse_attached' },
	{ query: 'gen1:1', expected: { bookId: 'gen', chapter: 1, verse: 1 }, category: 'verse_attached' },

	// Concordance keyword queries (non-passage strings returning null targets -> routed to concordance)
	{ query: 'de tal manera', expected: null, category: 'concordance' },
	{ query: 'luz del mundo', expected: null, category: 'concordance' },
	{ query: 'el senor es mi pastor', expected: null, category: 'concordance' },
	{ query: 'bienaventurados los pobres', expected: null, category: 'concordance' },
	{ query: 'gracia y paz', expected: null, category: 'concordance' },
	{ query: 'justicia y misericordia', expected: null, category: 'concordance' },
];

let passed = 0;
let failed = 0;

console.log(`Testing ${testCases.length} query classification cases:\n`);

for (const tc of testCases) {
	const res = OmniboxParser.parsePassageTargets(tc.query);
	if (tc.expected === null) {
		if (res.length === 0) {
			console.log(`PASS [${tc.category}]: "${tc.query}" -> 0 passage targets (classified as concordance keyword)`);
			passed++;
		} else {
			console.error(`FAIL [${tc.category}]: "${tc.query}" -> Expected 0 passage targets, got:`, res);
			failed++;
		}
	} else {
		if (
			res.length > 0 &&
			res[0].bookId === tc.expected.bookId &&
			res[0].chapter === tc.expected.chapter &&
			res[0].verse === tc.expected.verse
		) {
			console.log(
				`PASS [${tc.category}]: "${tc.query}" -> ${res[0].label} (Book: ${res[0].bookId}, Ch: ${res[0].chapter}, V: ${res[0].verse})`
			);
			passed++;
		} else {
			console.error(`FAIL [${tc.category}]: "${tc.query}" -> Expected:`, tc.expected, `Got:`, res[0]);
			failed++;
		}
	}
}

// 2. Dual-category Suggestion segregation verification
console.log('\nTesting Omnibox Suggestion dual-category structure...');
const mockSettings = {
	versionFolder: '70. Bible/RVG',
	enableLivePreview: true,
	defaultBibleVersion: 'RVG',
};

const mockApp = {
	vault: {
		getFiles: () => [],
		read: async () => '',
		getAbstractFileByPath: () => null,
	},
	metadataCache: {
		getFileCache: () => null,
	},
};

const modal = new QuickVerseSearchModal(mockApp, {
	settings: mockSettings,
	searchEngine: {
		ready: true,
		indexing: false,
		buildIndex: async () => {},
		search: (q) => {
			if (q === 'luz') {
				return [
					{
						ref: { book: { id: 'jhn', name: 'Juan' }, stringify: () => 'Juan 1:5' },
						entry: { bookId: 'jhn', bookName: 'Juan', chapter: 1, verse: 5 },
					},
				];
			}
			return [];
		},
		formatSearchResults: async (matches) => {
			return matches.map((m) => ({
				text: 'La luz resplandece en las tinieblas',
				excerpt: 'La <mark>luz</mark> resplandece...',
			}));
		},
	},
});

(async () => {
	// Query "luz": Has both passage prefix (Lucas via alias or prefix) and concordance match
	const suggestions = await modal.getSuggestions('luz');
	assert.ok(Array.isArray(suggestions));

	const passageItems = suggestions.filter((s) => s.category === 'passage');
	const concordanceItems = suggestions.filter((s) => s.category === 'concordance');

	assert.ok(concordanceItems.length > 0, 'Concordance items should be present for "luz"');
	assert.strictEqual(concordanceItems[0].categoryTitle, '🔍 Concordancia de Texto');
	if (passageItems.length > 0) {
		assert.strictEqual(passageItems[0].categoryTitle, '📖 Libros y Pasajes');
	}
	console.log('PASS: Modal separates suggestions into "📖 Libros y Pasajes" and "🔍 Concordancia de Texto"');
	passed++;

	console.log(`\nOmnibox Results: ${passed} passed, ${failed} failed.`);
	if (failed > 0) process.exit(1);
})();
