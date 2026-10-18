const assert = require('assert');
const Module = require('module');
const originalRequire = Module.prototype.require;

// Mock Obsidian module for unit tests
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
			MarkdownRenderer: {
				renderMarkdown: async (md, el) => {
					el.textContent = md;
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
		this.scrollTop = 0;
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
	appendChild(child) {
		child.parentElement = this;
		this.children.push(child);
	}
	querySelectorAll(selector) {
		const results = [];
		const walk = (node) => {
			if (
				node.tagName.toLowerCase() === selector.toLowerCase() ||
				node.classList.contains(selector.replace('.', ''))
			) {
				results.push(node);
			}
			for (const child of node.children) {
				walk(child);
			}
		};
		walk(this);
		return results;
	}
	remove() {
		if (this.parentElement) {
			const idx = this.parentElement.children.indexOf(this);
			if (idx !== -1) this.parentElement.children.splice(idx, 1);
		}
	}
}

// Load HighlightMutator from built main.js
let HighlightMutator;
try {
	const main = require('./main.js');
	HighlightMutator = main.HighlightMutator;
} catch (e) {
	console.log('Module not yet built (Red phase):', e.message);
}

console.log('Running Ticket #05 Markdown Highlight Persistence Unit Tests...\n');

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

async function testAsync(desc, fn) {
	try {
		await fn();
		console.log(`PASS: ${desc}`);
		passed++;
	} catch (e) {
		console.error(`FAIL: ${desc} - ${e.message}`);
		process.exit(1);
	}
}

if (!HighlightMutator) {
	console.error('FAIL: HighlightMutator is not defined yet (RED phase).');
	process.exit(1);
}

// 1. Basic Highlight Injection
test('Injects <mark class="hl-[color]"> around raw text', () => {
	const markdown = '<sup>1</sup> Pablo, llamado a ser apóstol de Jesucristo.';
	const result = HighlightMutator.injectHighlight(
		markdown,
		'llamado a ser apóstol',
		'yellow'
	);
	assert.strictEqual(
		result,
		'<sup>1</sup> Pablo, <mark class="hl-yellow">llamado a ser apóstol</mark> de Jesucristo.'
	);
});

// 2. Protection of structural elements: verse numbers and footnotes
test('Protects <sup> and [^ref_x] when highlight spans across them', () => {
	const markdown =
		'<sup>1</sup> Sóstenes,[^ref_1] <sup>2</sup> a la iglesia de Dios.';
	const result = HighlightMutator.injectHighlight(
		markdown,
		'Sóstenes,[^ref_1] <sup>2</sup> a la iglesia',
		'green'
	);
	// Verse number <sup>2</sup> and footnote [^ref_1] MUST NOT be wrapped inside <mark>
	assert.ok(!result.includes('<mark class="hl-green"><sup>'));
	assert.ok(!result.includes('<mark class="hl-green">[^ref_1]'));
	assert.strictEqual(
		result,
		'<sup>1</sup> <mark class="hl-green">Sóstenes,</mark>[^ref_1] <sup>2</sup> <mark class="hl-green">a la iglesia</mark> de Dios.'
	);
});

// 3. Protection of EGW commentary links
test('Protects EGW commentary links [[...|🕊️]] when highlighting adjacent text', () => {
	const markdown =
		'**1** <sup>1</sup> [[1 Corintios 1 (EGW)#^egw-1-1|🕊️]] Pablo, llamado a ser apóstol.';
	const result = HighlightMutator.injectHighlight(
		markdown,
		'Pablo, llamado a ser apóstol',
		'cyan'
	);
	assert.strictEqual(
		result,
		'**1** <sup>1</sup> [[1 Corintios 1 (EGW)#^egw-1-1|🕊️]] <mark class="hl-cyan">Pablo, llamado a ser apóstol</mark>.'
	);
});

// 4. Protection of callout syntax
test('Protects callout syntax > [!quote] from being corrupted', () => {
	const markdown =
		'> [!quote] Comentario EGW\n> Este es un comentario doctrinal sobre la fe.';
	const result = HighlightMutator.injectHighlight(
		markdown,
		'comentario doctrinal sobre la fe',
		'pink'
	);
	assert.ok(result.startsWith('> [!quote] Comentario EGW\n> Este es un '));
	assert.ok(
		result.includes(
			'<mark class="hl-pink">comentario doctrinal sobre la fe</mark>'
		)
	);
});

// 5. Verse disambiguation: highlights exact verse when word repeats across chapters
test('Disambiguates duplicate phrases across verses using verse option', () => {
	const markdown =
		'<sup>1</sup> Dios es luz y no hay tinieblas.\n<sup>2</sup> Dios es amor y quien permanece en amor permanece en Dios.';
	// Highlight "Dios" in verse 2 only
	const result = HighlightMutator.injectHighlight(markdown, 'Dios', 'orange', {
		verse: 2,
	});
	// Verse 1 must NOT have any highlight
	assert.ok(result.startsWith('<sup>1</sup> Dios es luz'));
	// Verse 2 should have highlight
	assert.ok(result.includes('<sup>2</sup> <mark class="hl-orange">Dios</mark> es amor'));
});

// 6. Overlap and nesting prevention
test('Strips existing nested marks when a new selection overlaps an existing highlight', () => {
	const markdown =
		'<sup>1</sup> Pablo, <mark class="hl-yellow">llamado a ser</mark> apóstol de Jesucristo.';
	// User selects "llamado a ser apóstol" in cyan
	const result = HighlightMutator.injectHighlight(
		markdown,
		'llamado a ser apóstol',
		'cyan'
	);
	// No nested <mark> tags!
	assert.ok(!result.includes('<mark class="hl-yellow">'));
	assert.ok(!result.includes('<mark class="hl-cyan"><mark'));
	assert.strictEqual(
		result,
		'<sup>1</sup> Pablo, <mark class="hl-cyan">llamado a ser apóstol</mark> de Jesucristo.'
	);
});

// 7. Modifying color on existing highlight
test('Replaces color class without creating nested or orphaned tags', () => {
	const markdown =
		'<sup>1</sup> Pablo, <mark class="hl-yellow">llamado a ser apóstol</mark> de Jesucristo.';
	const result = HighlightMutator.modifyHighlight(
		markdown,
		'llamado a ser apóstol',
		'green'
	);
	assert.strictEqual(
		result,
		'<sup>1</sup> Pablo, <mark class="hl-green">llamado a ser apóstol</mark> de Jesucristo.'
	);
});

// 8. Removing highlight (unmark)
test('Unwraps highlight completely, restoring raw Markdown', () => {
	const markdown =
		'<sup>1</sup> Pablo, <mark class="hl-pink">llamado a ser apóstol</mark> de Jesucristo.';
	const result = HighlightMutator.removeHighlight(
		markdown,
		'llamado a ser apóstol'
	);
	assert.strictEqual(
		result,
		'<sup>1</sup> Pablo, llamado a ser apóstol de Jesucristo.'
	);
});

// 9. Integration with Vault modification & reader view
(async () => {
	await testAsync('Vault persistence writes mutated markdown to disk via app.vault.modify', async () => {
		let writtenContent = '';
		let targetFilePath = '';

		const mockFile = { path: '70. Bible/RVG/1 Corintios/1 Corintios 1.md', name: '1 Corintios 1.md' };
		const initialMarkdown = '<sup>1</sup> Pablo, llamado a ser apóstol de Jesucristo.';

		const mockVault = {
			read: async () => initialMarkdown,
			modify: async (file, content) => {
				targetFilePath = file.path;
				writtenContent = content;
			},
		};

		// Mutate and persist
		await HighlightMutator.persistHighlight(mockVault, mockFile, {
			type: 'create',
			text: 'llamado a ser apóstol',
			color: 'yellow',
		});

		assert.strictEqual(targetFilePath, '70. Bible/RVG/1 Corintios/1 Corintios 1.md');
		assert.strictEqual(
			writtenContent,
			'<sup>1</sup> Pablo, <mark class="hl-yellow">llamado a ser apóstol</mark> de Jesucristo.'
		);
	});

	console.log(`\nAll ${passed} persistence and mutator tests passed!`);
})();
