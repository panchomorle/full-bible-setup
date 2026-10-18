// Mock obsidian module for testing in Node
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
	if (id === 'obsidian') {
		return {
			getLanguage: () => 'es',
			normalizePath: (p) => p.replace(/\\/g, '/'),
			Plugin: class {},
			ItemView: class {},
			PluginSettingTab: class {},
			Setting: class { setName() { return this; } setDesc() { return this; } addText() { return this; } addDropdown() { return this; } addToggle() { return this; } },
			SettingGroup: class { setHeading() { return this; } addSetting() { return this; } },
			Notice: class {},
			EditorSuggest: class {},
			AbstractInputSuggest: class {},
			SuggestModal: class {},
			MarkdownView: class {},
		};
	}
	return originalRequire.apply(this, arguments);
};

const plugin = require('./main.js');

// Test regex directly from the bundle
const mainJs = require('fs').readFileSync('./main.js', 'utf8');

// Test input cases
const testCases = [
	'--Jn 3:16',
	'--Jn3:16',
	'--John 3:16',
	'--John3:16',
	'--Juan 3:16',
	'--Juan3:16',
	'--1Jn 1:9',
	'--1 Jn 1:9',
	'--1 Juan 1:9',
	'--1John 1:9',
	'--1 John 1:9',
	'--1 Co 13:4-8',
	'--1co 13:4-8',
	'--1Corintios 13:4',
	'--Apoc 22:20+callout',
	'--Rev 22:20+callout',
	'--Génesis 1:1',
	'--Genesis 1:1',
	'--Gn 1:1',
	'--Salmos 23:1',
	'--Salmo 23:1',
	'--Sal 23:1',
	'--Ps 23:1',
];

const { PassageReference } = plugin;

console.log('Testing PassageReference.parse on ' + testCases.length + ' cases...\n');

let passed = 0;
let failed = 0;

for (const query of testCases) {
	const ref = PassageReference.parse(query, 'WEBP', 'callout');
	if (!ref) {
		console.error(`FAIL parse returned null: ${query}`);
		failed++;
		continue;
	}
	console.log(`PASS: "${query}" -> Book ID: "${ref.book.id}", Name: "${ref.book.name}", Chapter: ${ref.startChapter}:${ref.startVerse}, Stringified: "${ref.stringify()}"`);
	passed++;
}

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
