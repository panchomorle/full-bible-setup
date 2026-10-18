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
			SuggestModal: class {},
			MarkdownView: class {},
			ItemView: class {},
			MarkdownRenderer: { renderMarkdown: () => Promise.resolve() },
		};
	}
	return originalRequire.apply(this, arguments);
};

const assert = require('assert');

// We will test OmniboxParser once compiled or via TypeScript / main.js
console.log('Running Omnibox Parser specification tests...');

// Define expected test cases
const testCases = [
	{
		query: 'juan',
		expected: { bookId: 'jhn', chapter: 1, verse: 1 }
	},
	{
		query: 'genesis',
		expected: { bookId: 'gen', chapter: 1, verse: 1 }
	},
	{
		query: 'gn',
		expected: { bookId: 'gen', chapter: 1, verse: 1 }
	},
	{
		query: 'jn',
		expected: { bookId: 'jhn', chapter: 1, verse: 1 }
	},
	{
		query: 'juan 3',
		expected: { bookId: 'jhn', chapter: 3, verse: 1 }
	},
	{
		query: 'gn 2',
		expected: { bookId: 'gen', chapter: 2, verse: 1 }
	},
	{
		query: '1 co 13',
		expected: { bookId: '1co', chapter: 13, verse: 1 }
	},
	{
		query: 'juan 3:16',
		expected: { bookId: 'jhn', chapter: 3, verse: 16 }
	},
	{
		query: '1 jn 1:9',
		expected: { bookId: '1jn', chapter: 1, verse: 9 }
	},
	{
		query: 'exodo 20',
		expected: { bookId: 'exo', chapter: 20, verse: 1 }
	},
	{
		query: 'éxodo 20',
		expected: { bookId: 'exo', chapter: 20, verse: 1 }
	},
	{
		query: 'de tal manera',
		expected: null // Text concordance query
	},
	{
		query: 'ju',
		expected: { bookId: 'jdg', chapter: 1, verse: 1 } // Jueces (OT canonical order)
	},
	{
		query: '1co 13:4-8',
		expected: { bookId: '1co', chapter: 13, verse: 4 }
	}
];

const plugin = require('./main.js');
const { OmniboxParser } = plugin;

console.log('Testing OmniboxParser on ' + testCases.length + ' cases...\n');

let passed = 0;
let failed = 0;

for (const tc of testCases) {
	const res = OmniboxParser.parsePassageTargets(tc.query);
	if (tc.expected === null) {
		if (res.length === 0) {
			console.log(`PASS: "${tc.query}" -> 0 passage targets (routed to text concordance)`);
			passed++;
		} else {
			console.error(`FAIL: "${tc.query}" -> Expected 0 passage targets, got:`, res);
			failed++;
		}
	} else {
		if (res.length > 0 &&
			res[0].bookId === tc.expected.bookId &&
			res[0].chapter === tc.expected.chapter &&
			res[0].verse === tc.expected.verse) {
			console.log(`PASS: "${tc.query}" -> ${res[0].label} (Book: ${res[0].bookId}, Ch: ${res[0].chapter}, V: ${res[0].verse})`);
			passed++;
		} else {
			console.error(`FAIL: "${tc.query}" -> Expected:`, tc.expected, `Got:`, res[0]);
			failed++;
		}
	}
}

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
