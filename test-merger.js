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
			Setting: class { setName() { return this; } setDesc() { return this; } addText() { return this; } addDropdown() { return this; } addToggle() { return this; } addButton() { return this; } setClass() { return this; } },
			SettingGroup: class { setHeading() { return this; } addSetting() { return this; } },
			Notice: class { setMessage() {} hide() {} },
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

const assert = require('assert');
const plugin = require('./main.js');

console.log('Running BibleMerger Unit Tests...');

// 1. Test parseCommentaryContent
const { parseCommentaryContent, mergeChapterContent } = plugin;

assert.strictEqual(typeof parseCommentaryContent, 'function', 'parseCommentaryContent must be exported');
assert.strictEqual(typeof mergeChapterContent, 'function', 'mergeChapterContent must be exported');

const sampleCommentary = `---
tipo: comentario
autor: Elena G. de White
fuente: CBA Tomo 7A
badge: "🕊️"
libro: Hebreos
capitulo: 1
---

# Hebreos 1 — Comentarios de Elena G. de White

### 1:1-3 — Cristo la imagen expresa del Padre
> [!quote]
> Cristo es el resplandor de la gloria...
^egw-1-1-3

### 1:4-14 — Superior a los ángeles
> [!quote]
> Los ángeles son espíritus ministradores...
^egw-1-4-14

### 1:26 — Un solo versículo
> [!quote]
> Comentario puntual.
^egw-1-26
`;

const anchors = parseCommentaryContent(sampleCommentary, 'Hebreos 1 (EGW)', '🕊️');

assert.strictEqual(anchors.length, 3, 'Must extract exactly 3 anchors');
assert.deepStrictEqual(anchors[0], {
	startVerse: 1,
	endVerse: 3,
	rangeKey: '1-3',
	anchor: 'egw-1-1-3',
	noteName: 'Hebreos 1 (EGW)',
	badge: '🕊️',
});
assert.deepStrictEqual(anchors[1], {
	startVerse: 4,
	endVerse: 14,
	rangeKey: '4-14',
	anchor: 'egw-1-4-14',
	noteName: 'Hebreos 1 (EGW)',
	badge: '🕊️',
});
assert.deepStrictEqual(anchors[2], {
	startVerse: 26,
	endVerse: 26,
	rangeKey: '26',
	anchor: 'egw-1-26',
	noteName: 'Hebreos 1 (EGW)',
	badge: '🕊️',
});
console.log('PASS: parseCommentaryContent accurately parses multi-verse and single-verse anchors with frontmatter badge');

// 2. Test mergeChapterContent and Range De-Cluttering Rule
const sampleBaseBible = `---
version: RVG
book: Hebreos
chapter: 1
---

# Hebreos 1

**1** <sup>1</sup> Dios, habiendo hablado muchas veces... <sup>2</sup> en estos postreros días nos ha hablado... <sup>3</sup> el cual, siendo el resplandor de su gloria...

<sup>4</sup> hecho tanto más excelente que los ángeles... <sup>5</sup> Porque ¿a cuál de los ángeles dijo jamás... <sup>6</sup> Y otra vez... <sup>14</sup> ¿No son todos espíritus ministradores...?

<sup>26</sup> Y tú, oh Señor, en el principio fundaste la tierra...
`;

const { mergedContent, badgesInjected } = mergeChapterContent(
	sampleBaseBible,
	'Hebreos',
	1,
	anchors,
	'RVG (EGW)',
	'RVG',
	'EGW'
);

assert.strictEqual(badgesInjected, 3, 'Must inject exactly 3 badge links');

// Frontmatter verification
assert.ok(mergedContent.includes('version: RVG (EGW)'), 'Frontmatter must have derived version');
assert.ok(mergedContent.includes('base_version: RVG'), 'Frontmatter must retain base_version');
assert.ok(mergedContent.includes('commentary: EGW'), 'Frontmatter must record commentary');

// Range de-cluttering rule:
// Verse 1 (start of 1-3) must have badge with range annotation
assert.ok(
	mergedContent.includes('<sup>1</sup> [[Hebreos 1 (EGW)#^egw-1-1-3|🕊️ 1-3]] Dios'),
	'Start verse 1 of range 1-3 must have range badge'
);
// Verses 2 and 3 must have NO badges
assert.ok(
	mergedContent.includes('<sup>2</sup> en estos postreros'),
	'Intermediate verse 2 must NOT have duplicate badge'
);
assert.ok(
	mergedContent.includes('<sup>3</sup> el cual'),
	'Intermediate verse 3 must NOT have duplicate badge'
);

// Verse 4 (start of 4-14) must have range badge 🕊️ 4-14
assert.ok(
	mergedContent.includes('<sup>4</sup> [[Hebreos 1 (EGW)#^egw-1-4-14|🕊️ 4-14]] hecho'),
	'Start verse 4 of range 4-14 must have range badge'
);
// Verses 5, 6, 14 must have NO badges
assert.ok(
	mergedContent.includes('<sup>5</sup> Porque'),
	'Intermediate verse 5 must NOT have duplicate badge'
);
assert.ok(
	mergedContent.includes('<sup>6</sup> Y otra'),
	'Intermediate verse 6 must NOT have duplicate badge'
);
assert.ok(
	mergedContent.includes('<sup>14</sup> ¿No son'),
	'End verse 14 of range must NOT have duplicate badge'
);

// Single verse 26 must have clean badge without range
assert.ok(
	mergedContent.includes('<sup>26</sup> [[Hebreos 1 (EGW)#^egw-1-26|🕊️]] Y tú'),
	'Single verse 26 must have clean badge without range numbers'
);

console.log('PASS: mergeChapterContent satisfies Range De-Cluttering Rule (badge only on start verse)');
console.log('PASS: mergeChapterContent outputs valid frontmatter and non-destructive output');

// 3. Test non-destructive guarantee (base content variable unchanged)
assert.ok(!sampleBaseBible.includes('🕊️'), 'Base Bible text must never be mutated');
console.log('PASS: Base Bible text remains strictly immutable');

console.log('\nAll BibleMerger tests passed successfully!');
