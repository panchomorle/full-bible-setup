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
			ItemView: class {},
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

// Mock vault filesystem using real files from disk
const mockApp = {
	vault: {
		getFolderByPath: (p) => {
			const full = path.join(VAULT_ROOT, p);
			if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
				const children = fs.readdirSync(full).map((name) => {
					const childPath = path.join(full, name);
					const isDir = fs.statSync(childPath).isDirectory();
					return {
						name,
						path: `${p}/${name}`,
						children: isDir
							? fs.readdirSync(childPath).map((subName) => ({
									name: subName,
									path: `${p}/${name}/${subName}`,
							  }))
							: [],
					};
				});
				return { path: p, children };
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
	// First compile main.js
	const { execSync } = require('child_process');
	console.log('Building plugin bundle...');
	execSync('npm run build', { stdio: 'inherit' });

	const { PassageReference, PassageResolver, BibleSearchEngine } = require('./main.js');

	console.log('\n--- 1. Testing BibleSearchEngine Indexing ---');
	if (global.gc) {
		global.gc();
		global.gc();
	}
	const initialMem = process.memoryUsage().heapUsed;

	const searchEngine = new BibleSearchEngine(mockApp, settings);
	const t0Index = performance.now();
	await searchEngine.buildIndex('RVG');
	const t1Index = performance.now();

	if (global.gc) {
		global.gc();
		global.gc();
	}
	const postMem = process.memoryUsage().heapUsed;
	const memoryMB = (postMem - initialMem) / (1024 * 1024);

	console.log(`Indexed ${searchEngine.totalVerses} verses in ${(t1Index - t0Index).toFixed(1)} ms.`);
	console.log(`Additional RAM footprint: ${memoryMB.toFixed(2)} MB (Limit: < 15 MB)`);

	if (searchEngine.totalVerses !== 31102) {
		console.error(`FAIL: Expected 31102 verses, got ${searchEngine.totalVerses}`);
		process.exit(1);
	}
	if (memoryMB > 15) {
		console.error(`FAIL: Memory footprint ${memoryMB.toFixed(2)} MB exceeds 15 MB limit`);
		process.exit(1);
	}
	console.log('PASS: Total verses and memory footprint acceptance criteria met!');

	console.log('\n--- 2. Testing Substring / Concordance Search Performance (< 10ms) ---');
	const resolver = new PassageResolver(mockApp, settings);

	const queries = [
		{ q: 'luz del mundo', expectBook: 'Juan' },
		{ q: 'bienaventurados los', expectBook: 'Mateo' },
		{ q: 'unigénito hijo', expectBook: 'Juan' },
		{ q: 'unigenito hijo', expectBook: 'Juan' }, // accent insensitivity
		{ q: 'principio creó', expectBook: 'Génesis' },
		{ q: 'paciencia de los santos', expectBook: 'Apocalipsis' },
		{ q: 'Bienaventu', expectBook: 'Lucas' }, // partial substring
	];

	for (const item of queries) {
		const tStart = performance.now();
		const results = searchEngine.search(item.q, 20);
		const duration = performance.now() - tStart;

		console.log(`Query "${item.q}": ${results.length} results in ${duration.toFixed(3)} ms (Execution < 10ms: ${duration < 10 ? 'YES' : 'NO'})`);
		if (duration > 10) {
			console.error(`FAIL: Query "${item.q}" took ${duration.toFixed(3)} ms, exceeding 10ms limit!`);
			process.exit(1);
		}
		if (results.length === 0) {
			console.error(`FAIL: Query "${item.q}" returned 0 results!`);
			process.exit(1);
		}

		const formatted = await searchEngine.formatSearchResults(results, resolver, item.q);
		const top = formatted[0];
		console.log(`  Top hit: ${top.ref.stringify()} -> ${top.excerpt}`);

		const matchesExpected = results.some(r => r.ref.book.name.includes(item.expectBook) || r.entry.bookName.includes(item.expectBook));
		if (!matchesExpected) {
			console.error(`FAIL: Query "${item.q}" did not find expected book "${item.expectBook}" in top 20!`);
			process.exit(1);
		}
	}
	console.log('PASS: All concordance search queries executed in < 10ms with accurate ranking!');

	console.log('\n--- 3. Testing Reference Queries Resolution Integrity ---');
	const refQueries = [
		{ q: 'Juan 3:16', expectText: 'unigénito' },
		{ q: 'Jn 3:16', expectText: 'unigénito' },
		{ q: '1 Co 13:4-8', expectText: 'caridad es sufrida' },
		{ q: 'Apoc 14:12', expectText: 'paciencia de los santos' },
	];

	for (const rq of refQueries) {
		const t0Ref = performance.now();
		const res = await resolver.resolvePassage(rq.q);
		const refDuration = performance.now() - t0Ref;

		if (!res || !res.text.includes(rq.expectText)) {
			console.error(`FAIL: Reference query "${rq.q}" failed to resolve or match text!`);
			process.exit(1);
		}
		console.log(`PASS: Ref "${rq.q}" resolved in ${refDuration.toFixed(3)} ms: ${res.ref.stringify()}`);
	}

	console.log('\nALL ISSUE 08 ACCEPTANCE CRITERIA VERIFIED WITH 100% SUCCESS!');
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
