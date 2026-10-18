const fs = require('fs');
const path = require('path');

// Mock obsidian module for Node
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

const { parseCommentaryContent, mergeChapterContent } = require('./main.js');

const VAULT_BIBLE_PATH = path.resolve('C:/Users/eljua/Documents/UAP/70. Bible');
const BASE_BIBLE_PATH = path.join(VAULT_BIBLE_PATH, 'RVG');
const COMENTARIOS_PATH = path.join(VAULT_BIBLE_PATH, 'Comentarios', 'EGW');
const TARGET_PATH = path.join(VAULT_BIBLE_PATH, 'RVG (EGW)');

console.log(`Starting non-destructive merge:`);
console.log(`- Base Bible: ${BASE_BIBLE_PATH}`);
console.log(`- Commentary: ${COMENTARIOS_PATH}`);
console.log(`- Output Target: ${TARGET_PATH}`);

// 1. Scan and index commentary files
console.log(`\nScanning commentary notes...`);
const commentaryIndex = new Map(); // book -> Map(chapter -> anchors[])

function scanCommentaries(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			scanCommentaries(full);
		} else if (entry.isFile() && entry.name.endsWith('.md')) {
			const m = entry.name.match(/^(.*?)\s+(\d+)\s*\([^)]+\)\.md$/);
			if (m) {
				const bookName = m[1].trim();
				const chapter = parseInt(m[2], 10);
				const content = fs.readFileSync(full, 'utf8');
				const noteName = path.basename(entry.name, '.md');
				const anchors = parseCommentaryContent(content, noteName, '🕊️');

				if (!commentaryIndex.has(bookName)) {
					commentaryIndex.set(bookName, new Map());
				}
				commentaryIndex.get(bookName).set(chapter, anchors);
			}
		}
	}
}

scanCommentaries(COMENTARIOS_PATH);
let totalCommentaryChapters = 0;
let totalCommentaryAnchors = 0;
for (const [_, chMap] of commentaryIndex) {
	totalCommentaryChapters += chMap.size;
	for (const [_, anchors] of chMap) {
		totalCommentaryAnchors += anchors.length;
	}
}
console.log(`Indexed ${totalCommentaryChapters} commentary chapters with ${totalCommentaryAnchors} atomic anchors.`);

// 2. Process all Base Bible chapters
fs.mkdirSync(TARGET_PATH, { recursive: true });

let totalChapters = 0;
let totalBadgesInjected = 0;

const bookDirs = fs.readdirSync(BASE_BIBLE_PATH, { withFileTypes: true });
for (const bDir of bookDirs) {
	if (!bDir.isDirectory()) continue;
	const bookName = bDir.name;
	const baseBookDir = path.join(BASE_BIBLE_PATH, bookName);
	const targetBookDir = path.join(TARGET_PATH, bookName);
	fs.mkdirSync(targetBookDir, { recursive: true });

	const files = fs.readdirSync(baseBookDir);
	for (const f of files) {
		if (!f.endsWith('.md')) continue;
		const m = f.match(/^(.*?)\s+(\d+)\.md$/);
		if (!m) continue;
		const chapter = parseInt(m[2], 10);

		const baseFilePath = path.join(baseBookDir, f);
		const baseContent = fs.readFileSync(baseFilePath, 'utf8');

		const anchors = commentaryIndex.get(bookName)?.get(chapter) || [];

		const { mergedContent, badgesInjected } = mergeChapterContent(
			baseContent,
			bookName,
			chapter,
			anchors,
			'RVG (EGW)',
			'RVG',
			'EGW'
		);

		totalBadgesInjected += badgesInjected;
		totalChapters++;

		const targetFilePath = path.join(targetBookDir, f);
		fs.writeFileSync(targetFilePath, mergedContent, 'utf8');
	}
}

console.log(`\n¡Fusión exitosa!`);
console.log(`- Total capítulos generados: ${totalChapters}`);
console.log(`- Total badges inyectados: ${totalBadgesInjected}`);
console.log(`- Carpeta destino: ${TARGET_PATH}`);
