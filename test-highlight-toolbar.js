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
					this.containerEl = new MockElement('div');
				}
			},
			WorkspaceLeaf: class {},
			MarkdownRenderer: { renderMarkdown: async () => {} },
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
	setAttribute(name, val) { this.attributes[name] = val; }
	getAttribute(name) { return this.attributes[name] || null; }
	addClass(cls) { this.classList.add(cls); }
	removeClass(cls) { this.classList.remove(cls); }
	empty() { this.children = []; this.textContent = ''; }
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
			if (node.tagName.toLowerCase() === selector.toLowerCase() || node.classList.contains(selector.replace('.', ''))) {
				results.push(node);
			}
			for (const child of node.children) {
				walk(child);
			}
		};
		walk(this);
		return results;
	}
	getBoundingClientRect() {
		return { top: 100, bottom: 120, left: 50, right: 200, width: 150, height: 20 };
	}
	remove() {
		if (this.parentElement) {
			const idx = this.parentElement.children.indexOf(this);
			if (idx !== -1) this.parentElement.children.splice(idx, 1);
		}
	}
}

// We will import from built bundle or directly from src
let highlightModule;
try {
	highlightModule = require('./main.js');
} catch (e) {
	console.log('Module not yet built (Red phase):', e.message);
}

console.log('Running Floating Highlight Toolbar Unit Tests...\n');

if (!highlightModule || !highlightModule.HighlightToolbar) {
	console.error('FAIL: HighlightToolbar is not defined yet (RED phase).');
	process.exit(1);
}

const { HighlightToolbar, HIGHLIGHT_PALETTE } = highlightModule;

let passed = 0;
function test(desc, fn) {
	try {
		fn();
		console.log(`PASS: ${desc}`);
		passed++;
	} catch (e) {
		console.error(`FAIL: ${desc} - ${e.message}`);
		process.exit(1);
	}
}

test('Palette defines 5 accessible colors: yellow, green, cyan, pink, orange', () => {
	assert.ok(Array.isArray(HIGHLIGHT_PALETTE));
	assert.strictEqual(HIGHLIGHT_PALETTE.length, 5);
	const expectedIds = ['yellow', 'green', 'cyan', 'pink', 'orange'];
	const expectedClasses = ['hl-yellow', 'hl-green', 'hl-cyan', 'hl-pink', 'hl-orange'];

	HIGHLIGHT_PALETTE.forEach((item, i) => {
		assert.strictEqual(item.id, expectedIds[i]);
		assert.strictEqual(item.className, expectedClasses[i]);
		assert.ok(item.label);
		assert.ok(item.color);
	});
});

test('Toolbar renders selection popover with 5 color chips and dismiss action', () => {
	const container = new MockElement('div', 'container');
	let chosenColor = null;

	const toolbar = new HighlightToolbar(container, {
		onHighlight: (color) => {
			chosenColor = color;
		},
	});

	// Simulate selection popup
	const mockRangeRect = { top: 150, bottom: 170, left: 100, right: 250, width: 150, height: 20 };
	toolbar.showForSelection(mockRangeRect, 'Dios creó los cielos');

	assert.strictEqual(toolbar.isVisible, true);
	assert.ok(toolbar.el);

	const chips = toolbar.el.querySelectorAll('.local-bible-color-chip');
	assert.strictEqual(chips.length, 5);

	// Click green chip
	const greenChip = chips.find((c) => c.getAttribute('data-color') === 'green');
	assert.ok(greenChip);
	greenChip.onclick();

	assert.strictEqual(chosenColor, 'green');
	assert.strictEqual(toolbar.isVisible, false);
});

test('Toolbar renders edit popover when inspecting existing highlight', () => {
	const container = new MockElement('div', 'container');
	let modifiedColor = null;
	let unmarkCalled = false;

	const toolbar = new HighlightToolbar(container, {
		onModifyHighlight: (markEl, newColor) => {
			modifiedColor = newColor;
		},
		onRemoveHighlight: (markEl) => {
			unmarkCalled = true;
		},
	});

	const mockMark = new MockElement('mark', 'hl-yellow');
	mockMark.textContent = 'En el principio';

	toolbar.showForMark(mockMark);

	assert.strictEqual(toolbar.isVisible, true);
	assert.strictEqual(toolbar.mode, 'edit');

	// Verify unmark button exists
	const unmarkBtn = toolbar.el.querySelectorAll('.local-bible-unmark-btn')[0];
	assert.ok(unmarkBtn);
	assert.ok(unmarkBtn.textContent.includes('Eliminar') || unmarkBtn.title.includes('Eliminar'));

	// Click change color to cyan
	const chips = toolbar.el.querySelectorAll('.local-bible-color-chip');
	const cyanChip = chips.find((c) => c.getAttribute('data-color') === 'cyan');
	cyanChip.onclick();

	assert.strictEqual(modifiedColor, 'cyan');
	assert.strictEqual(toolbar.isVisible, false);

	// Test unmark invocation
	toolbar.showForMark(mockMark);
	const unmarkBtn2 = toolbar.el.querySelectorAll('.local-bible-unmark-btn')[0];
	unmarkBtn2.onclick();

	assert.strictEqual(unmarkCalled, true);
	assert.strictEqual(toolbar.isVisible, false);
});

test('Dismissal on Escape key hides the toolbar', () => {
	const container = new MockElement('div', 'container');
	const toolbar = new HighlightToolbar(container, {});

	toolbar.showForSelection({ top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 }, 'test');
	assert.strictEqual(toolbar.isVisible, true);

	toolbar.handleKeyDown({ key: 'Escape', preventDefault: () => {} });
	assert.strictEqual(toolbar.isVisible, false);
});

console.log(`\nAll ${passed} highlight toolbar tests passed!`);
