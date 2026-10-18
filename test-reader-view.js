const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Module = require('module');
const originalRequire = Module.prototype.require;

const VAULT_ROOT = 'C:/Users/eljua/Documents/UAP';

// Obsidian mock
class MockWorkspaceLeaf {
	constructor(app) {
		this.app = app;
		this.view = null;
		this.viewState = null;
	}
	async setViewState(state) {
		this.viewState = state;
		if (state.type === 'local-bible-reader-view') {
			const ViewClass = pluginExports.BibleReaderView;
			this.view = new ViewClass(this, this.app.plugin);
			await this.view.onload();
		}
	}
	updateHeader() {}
}

class MockElement {
	constructor(tag = 'div', cls = '') {
		this.tagName = tag.toUpperCase();
		this.className = cls;
		this.attributes = {};
		this.style = {};
		this.children = [];
		this.parentElement = null;
		this.textContent = '';
		this.title = '';
		this.onclick = null;
		this.classList = {
			contains: (c) => this.className.split(' ').includes(c),
			add: (c) => {
				const set = new Set(this.className.split(' ').filter(Boolean));
				set.add(c);
				this.className = Array.from(set).join(' ');
			},
			remove: (c) => {
				const set = new Set(this.className.split(' ').filter(Boolean));
				set.delete(c);
				this.className = Array.from(set).join(' ');
			},
		};
	}
	setAttribute(name, val) {
		this.attributes[name] = val;
	}
	getAttribute(name) {
		return this.attributes[name] || null;
	}
	addClass(cls) {
		this.classList.add(cls);
	}
	empty() {
		this.children = [];
		this.textContent = '';
	}
	createDiv(opts = {}) {
		const div = new MockElement('div', opts.cls || '');
		div.parentElement = this;
		this.children.push(div);
		return div;
	}
	createEl(tag, opts = {}) {
		const el = new MockElement(tag, opts.cls || '');
		if (opts.text) el.textContent = opts.text;
		el.parentElement = this;
		this.children.push(el);
		return el;
	}
	querySelectorAll(selector) {
		const results = [];
		const walk = (node) => {
			if (node.tagName.toLowerCase() === selector.toLowerCase()) {
				results.push(node);
			}
			for (const child of node.children) {
				walk(child);
			}
		};
		walk(this);
		return results;
	}
	closest(selector) {
		let curr = this;
		while (curr) {
			if (curr.classList.contains(selector) || curr.tagName.toLowerCase() === selector.toLowerCase()) {
				return curr;
			}
			curr = curr.parentElement;
		}
		return null;
	}
	scrollIntoView() {
		this.scrolled = true;
	}
}

let renderedMarkdownCalls = [];

Module.prototype.require = function (id) {
	if (id === 'obsidian') {
		return {
			getLanguage: () => 'es',
			normalizePath: (p) => p.replace(/\\/g, '/').replace(/\/+/g, '/'),
			Plugin: class {},
			ItemView: class {
				constructor(leaf) {
					this.leaf = leaf;
					this.containerEl = new MockElement('div', 'workspace-leaf-content');
					this.app = leaf.app;
				}
				async onload() {}
				registerDomEvent(el, event, handler) {}
				getState() {
					return {};
				}
				async setState(state, result) {}
			},
			WorkspaceLeaf: MockWorkspaceLeaf,
			MarkdownRenderer: {
				renderMarkdown: async (md, containerEl, sourcePath, component) => {
					renderedMarkdownCalls.push({ md, sourcePath });
					// Simulate rendering: create sup tags for verse markers
					const supMatches = md.match(/<sup>(\d+)<\/sup>/g) || [];
					for (const m of supMatches) {
						const num = m.match(/\d+/)[0];
						const sup = containerEl.createEl('sup');
						sup.textContent = num;
					}
				},
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
			TFile: class {
				constructor(p) {
					this.path = p;
					this.name = path.basename(p);
				}
			},
		};
	}
	return originalRequire.apply(this, arguments);
};

const pluginExports = require('./main.js');
const { VIEW_TYPE_BIBLE_READER, BibleReaderView } = pluginExports;

// Build real mock app referencing UAP vault files
const existingLeaves = [];
const mockApp = {
	vault: {
		getFolderByPath: (p) => {
			const full = path.join(VAULT_ROOT, p);
			if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
				const { TFile } = require('obsidian');
				const children = fs.readdirSync(full).map((name) => {
					const childPath = path.join(full, name);
					const isDir = fs.statSync(childPath).isDirectory();
					return isDir
						? {
								name,
								path: `${p}/${name}`,
								children: fs.readdirSync(childPath).map((subName) => {
									const subPath = path.join(childPath, subName);
									const isSubDir = fs.statSync(subPath).isDirectory();
									return isSubDir
										? { name: subName, path: `${p}/${name}/${subName}` }
										: new TFile(`${p}/${name}/${subName}`);
								}),
						  }
						: new TFile(`${p}/${name}`);
				});
				return { path: p, children };
			}
			return null;
		},
		getFileByPath: (p) => {
			const full = path.join(VAULT_ROOT, p);
			if (fs.existsSync(full) && fs.statSync(full).isFile()) {
				const { TFile } = require('obsidian');
				return new TFile(p);
			}
			return null;
		},
		read: async (file) => {
			const full = path.join(VAULT_ROOT, file.path);
			return fs.readFileSync(full, 'utf8');
		},
		modify: async (file, content) => {
			mockApp.vault.lastModified = { file, content };
		},
	},
	workspace: {
		getLeavesOfType: (type) => existingLeaves.filter((l) => l.viewState?.type === type),
		getRightLeaf: (split) => {
			const leaf = new MockWorkspaceLeaf(mockApp);
			existingLeaves.push(leaf);
			return leaf;
		},
		revealLeaf: (leaf) => {
			leaf.revealed = true;
		},
		trigger: () => {},
	},
};

const mockPlugin = {
	app: mockApp,
	settings: {
		biblesPath: '70. Bible',
		defaultVersionShorthand: 'RVG',
	},
};
mockApp.plugin = mockPlugin;

console.log('Running BibleReaderView Unit Tests...\n');

let passed = 0;
async function test(desc, fn) {
	try {
		await fn();
		console.log(`PASS: ${desc}`);
		passed++;
	} catch (e) {
		console.error(`FAIL: ${desc} - ${e.message}`);
		process.exit(1);
	}
}

async function runAsyncTests() {
	await test('VIEW_TYPE_BIBLE_READER has expected identifier', () => {
		assert.strictEqual(VIEW_TYPE_BIBLE_READER, 'local-bible-reader-view');
	});

	await test('Singleton leaf activation creates right sidebar leaf when none exists', async () => {
		assert.strictEqual(existingLeaves.length, 0);
		const view = await BibleReaderView.activateView(mockApp, mockPlugin);
		assert.ok(view);
		assert.strictEqual(existingLeaves.length, 1);
		assert.strictEqual(existingLeaves[0].revealed, true);
		assert.strictEqual(view.getViewType(), 'local-bible-reader-view');
	});

	await test('Singleton leaf activation reuses existing leaf on subsequent calls', async () => {
		const initialCount = existingLeaves.length;
		const view2 = await BibleReaderView.activateView(mockApp, mockPlugin, {
			bookId: 'exo',
			chapter: 1,
		});
		assert.strictEqual(existingLeaves.length, initialCount);
		assert.strictEqual(view2.getDisplayText(), 'Éxodo 1');
	});

	await test('Chapter rendering uses MarkdownRenderer with file path and read-only contentEditable', async () => {
		const leaf = existingLeaves[0];
		const view = leaf.view;
		renderedMarkdownCalls = [];

		await view.openPassage({
			bookId: 'gen',
			chapter: 1,
			verse: 3,
		});

		assert.strictEqual(view.getDisplayText(), 'Génesis 1');
		assert.strictEqual(renderedMarkdownCalls.length, 1);
		assert.ok(renderedMarkdownCalls[0].sourcePath.includes('Génesis 1.md'));
		assert.strictEqual(view.bodyEl.getAttribute('contenteditable'), 'false');
	});

	await test('Header renders Prev as disabled on Genesis 1 and Next enabled for Genesis 2', async () => {
		const view = existingLeaves[0].view;
		await view.openPassage({ bookId: 'gen', chapter: 1 });

		const prevBtn = view.headerEl.children.find((c) => c.classList.contains('prev'));
		const nextBtn = view.headerEl.children.find((c) => c.classList.contains('next'));

		assert.ok(prevBtn.getAttribute('disabled'));
		assert.ok(prevBtn.classList.contains('is-disabled'));
		assert.strictEqual(nextBtn.getAttribute('disabled'), null);
		assert.ok(nextBtn.title.includes('Génesis 2'));
	});

	await test('Boundary navigation crossing: Genesis 50 next button points to Exodus 1', async () => {
		const view = existingLeaves[0].view;
		await view.openPassage({ bookId: 'gen', chapter: 50 });

		const nextBtn = view.headerEl.children.find((c) => c.classList.contains('next'));
		assert.strictEqual(nextBtn.getAttribute('disabled'), null);
		assert.ok(nextBtn.title.includes('Éxodo 1'));

		// Trigger next navigation
		await nextBtn.onclick();
		assert.strictEqual(view.getDisplayText(), 'Éxodo 1');

		// Previous button in Exodus 1 should point back to Genesis 50
		const prevBtn = view.headerEl.children.find((c) => c.classList.contains('prev'));
		assert.strictEqual(prevBtn.getAttribute('disabled'), null);
		assert.ok(prevBtn.title.includes('Génesis 50'));
	});

	await test('Footer controls render responsive adjacent chapter buttons', async () => {
		const view = existingLeaves[0].view;
		await view.openPassage({ bookId: 'mal', chapter: 4 });

		const footerNav = view.footerEl.children[0];
		const prevBtn = footerNav.children.find((c) => c.classList.contains('prev'));
		const nextBtn = footerNav.children.find((c) => c.classList.contains('next'));

		assert.ok(prevBtn.textContent.includes('Malaquías 3'));
		assert.ok(nextBtn.textContent.includes('Mateo 1'));
	});

	await test('State serialization saves and restores reader position', async () => {
		const view = existingLeaves[0].view;
		await view.openPassage({ bookId: 'jhn', chapter: 3, verse: 16 });

		const state = view.getState();
		assert.strictEqual(state.bookId, 'jhn');
		assert.strictEqual(state.chapter, 3);
		assert.strictEqual(state.verse, 16);

		// Restore to Exodus 20
		await view.setState({ bookId: 'exo', chapter: 20 }, null);
		assert.strictEqual(view.getDisplayText(), 'Éxodo 20');
	});

	await test('Highlight actions persist changes to disk via vault.modify', async () => {
		const view = existingLeaves[0].view;
		await view.openPassage({ bookId: 'gen', chapter: 1 });

		// Apply highlight
		await view.applyHighlight('yellow', 'En el principio creó Dios');
		assert.ok(mockApp.vault.lastModified, 'Vault.modify should be called on applyHighlight');
		assert.ok(
			mockApp.vault.lastModified.content.includes(
				'<mark class="hl-yellow">En el principio creó Dios</mark>'
			),
			'Content written to disk must contain highlighted mark tag'
		);
	});

	console.log(`\nAll ${passed} reader view tests passed!`);
}

runAsyncTests().catch((e) => {
	console.error('Test run failed:', e);
	process.exit(1);
});
