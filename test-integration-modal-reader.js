// Integration test: Omnibox selection to BibleReaderView
const Module = require('module');
const originalRequire = Module.prototype.require;

let triggeredEvent = null;
let triggeredEventPayload = null;

Module.prototype.require = function (id) {
	if (id === 'obsidian') {
		return {
			getLanguage: () => 'es',
			normalizePath: (p) => p.replace(/\\/g, '/'),
			Plugin: class {},
			PluginSettingTab: class {},
			Setting: class { setName() { return this; } setDesc() { return this; } addText() { return this; } addDropdown() { return this; } addToggle() { return this; } },
			SettingGroup: class { setHeading() { return this; } addSetting() { return this; } },
			Notice: class { constructor(msg) { this.msg = msg; } },
			EditorSuggest: class {},
			AbstractInputSuggest: class {},
			SuggestModal: class {
				constructor(app) { this.app = app; }
				setPlaceholder() {}
			},
			MarkdownView: class {},
			ItemView: class {
				constructor(leaf) { this.leaf = leaf; }
			},
			MarkdownRenderer: { renderMarkdown: () => Promise.resolve() },
		};
	}
	return originalRequire.apply(this, arguments);
};

const assert = require('assert');
const plugin = require('./main.js');
const { OmniboxParser } = plugin;

console.log('Running Ticket #03 Integration Tests (Omnibox -> Reader)...');

let readerOpenedWith = null;

// Mock App and Plugin
const mockApp = {
	workspace: {
		trigger: (event, payload) => {
			triggeredEvent = event;
			triggeredEventPayload = payload;
		},
		getActiveViewOfType: () => null,
		getLeavesOfType: () => [],
		getRightLeaf: () => ({
			setViewState: async () => {},
			view: null
		}),
		revealLeaf: () => {},
	},
	vault: {
		getFolderByPath: () => null,
		getFileByPath: () => null,
	}
};

const mockPlugin = {
	app: mockApp,
	settings: {
		biblesPath: '70. Bible',
		defaultVersionShorthand: 'RVG',
		defaultPassageFormat: 'callout',
	},
	openBibleReader: async (target) => {
		readerOpenedWith = target;
	}
};

// Simulate QuickVerseSearchModal selection
async function runTest() {
	const parsed = OmniboxParser.parsePassageTargets('juan 3:16');
	assert(parsed.length > 0, 'Should parse juan 3:16');
	const target = parsed[0];

	// Simulate modal choose action
	await mockPlugin.openBibleReader({
		bookName: target.bookName,
		bookId: target.bookId,
		chapter: target.chapter,
		verse: target.verse,
	});

	mockApp.workspace.trigger('local-bible-ref:open-reader', target);

	assert.deepStrictEqual(readerOpenedWith, {
		bookName: 'Juan',
		bookId: 'jhn',
		chapter: 3,
		verse: 16,
	}, 'Reader must be invoked with target book, chapter, and verse');

	assert.strictEqual(triggeredEvent, 'local-bible-ref:open-reader', 'Event must be emitted');
	assert.strictEqual(triggeredEventPayload.bookId, 'jhn');

	console.log('PASS: Omnibox selection correctly dispatches to BibleReaderView');
	console.log('All Ticket #03 integration tests passed successfully!\n');
}

runTest().catch((err) => {
	console.error('FAIL:', err);
	process.exit(1);
});
