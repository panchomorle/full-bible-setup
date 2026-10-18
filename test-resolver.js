const fs = require('fs');
const path = require('path');
const Module = require('module');
const originalRequire = Module.prototype.require;

const VAULT_ROOT = 'C:/Users/eljua/Documents/UAP';

Module.prototype.require = function (id) {
	if (id === 'obsidian') {
		return {
			getLanguage: () => 'es',
			normalizePath: (p) => p.replace(/\\/g, '/').replace(/\/+/g, '/'),
			Plugin: class {},
			PluginSettingTab: class {},
			Setting: class { setName() { return this; } setDesc() { return this; } addText() { return this; } addDropdown() { return this; } addToggle() { return this; } },
			SettingGroup: class { setHeading() { return this; } addSetting() { return this; } },
			Notice: class {},
			EditorSuggest: class {},
			AbstractInputSuggest: class {},
			SuggestModal: class {},
			MarkdownView: class {},
			ItemView: class {
				constructor(leaf) { this.leaf = leaf; }
			},
			MarkdownRenderer: { renderMarkdown: () => Promise.resolve() },
		};
	}
	return originalRequire.apply(this, arguments);
};

// Mock vault filesystem using real files from disk
const mockApp = {
	vault: {
		getFolderByPath: (p) => {
			const full = path.join(VAULT_ROOT, p);
			if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
				return { path: p };
			}
			return null;
		},
		getFileByPath: (p) => {
			const full = path.join(VAULT_ROOT, p);
			if (fs.existsSync(full) && fs.statSync(full).isFile()) {
				return { path: p };
			}
			return null;
		},
		cachedRead: async (file) => {
			const full = path.join(VAULT_ROOT, file.path);
			return fs.readFileSync(full, 'utf8');
		},
	},
	fileManager: {
		generateMarkdownLink: (file, sourcePath, subpath, alias) => {
			return `[[${file.path}${subpath ? subpath : ''}|${alias}]]`;
		},
	},
};

const settings = {
	biblesPath: '70. Bible',
	defaultVersionShorthand: 'RVG',
	defaultPassageFormat: 'callout',
	bibleFormat: 'localBibleRef',
	fullPreview: false,
	quote: {
		includeReference: true,
		referencePosition: 'end',
		linkToPassage: true,
	},
	callout: {
		type: 'quote',
		linkToPassage: true,
		collapsible: true,
	},
};

async function run() {
	const { PassageReference, PassageResolver } = require('./main.js');

	console.log('Testing PassageResolver against real vault files:');

	const resolver = new PassageResolver(mockApp, settings);

	const tests = [
		{ query: '--Juan 3:16', expectedVersion: 'RVG', expectedTextContains: 'unigénito' },
		{ query: '--Jn 3:16+WEBP', expectedVersion: 'WEBP', expectedTextContains: 'only born Son' },
		{ query: '--John 3:16', expectedVersion: 'RVG', expectedTextContains: 'unigénito' },
		{ query: '--1Jn 1:9', expectedVersion: 'RVG', expectedTextContains: 'confesamos' },
		{ query: '--1 John 1:9+WEBP', expectedVersion: 'WEBP', expectedTextContains: 'confess' },
		{ query: '--Apoc 14:12', expectedVersion: 'RVG', expectedTextContains: 'paciencia de los santos' },
	];

	for (const t of tests) {
		const res = await resolver.resolvePassage(t.query);
		if (!res) {
			console.error(`FAIL: ${t.query} returned null`);
			process.exit(1);
		}
		if (!res.text.includes(t.expectedTextContains)) {
			console.error(`FAIL: ${t.query} does not contain "${t.expectedTextContains}"\nGot:\n${res.text}`);
			process.exit(1);
		}
		console.log(`PASS: ${t.query} [${res.ref.version}] -> Excerpt: "${res.excerpt.slice(0, 50)}..."`);
	}
	console.log('\nAll integration tests passed with 100% success!');
}

run();
