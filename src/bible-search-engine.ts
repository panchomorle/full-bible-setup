import { App, normalizePath, TFile, TFolder } from 'obsidian';
import LocalBibleRefSettings from './settings';
import PassageReference, { PassageFormat } from './passage-reference';
import PassageResolver, { ResolvedPassage } from './passage-resolver';

export interface VerseIndexEntry {
	bookName: string;
	chapter: number;
	verse: number;
}

export interface SearchResult {
	entry: VerseIndexEntry;
	score: number;
	ref: PassageReference;
	normExcerpt: string;
}

export function normalizeSearchText(str: string): string {
	return str
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim();
}

export default class BibleSearchEngine {
	private readonly app: App;
	private readonly settings: LocalBibleRefSettings;

	private isReady = false;
	private isIndexing = false;
	private indexedVersion = '';

	private count = 0;
	private bookNames: string[] = [];
	private verseRefs: Int32Array = new Int32Array(0);
	private offsets: Int32Array = new Int32Array(0);
	private lengths: Uint16Array = new Uint16Array(0);
	private singleNormBuffer = '';

	constructor(app: App, settings: LocalBibleRefSettings) {
		this.app = app;
		this.settings = settings;
	}

	get ready(): boolean {
		return this.isReady;
	}

	get indexing(): boolean {
		return this.isIndexing;
	}

	get totalVerses(): number {
		return this.count;
	}

	/**
	 * Builds or updates the search index for the active Bible version in the background.
	 * Yields periodically to the event loop so the UI remains completely responsive.
	 */
	async buildIndex(targetVersion?: string): Promise<void> {
		const version =
			targetVersion ||
			this.settings.defaultVersionShorthand ||
			this.resolveFirstVersion();

		if (!version) return;
		if (this.isReady && this.indexedVersion === version) return;
		if (this.isIndexing) return;

		this.isIndexing = true;
		this.isReady = false;

		try {
			const files = this.collectChapterFiles(version);
			if (files.length === 0) {
				this.isIndexing = false;
				return;
			}

			const bookMap = new Map<string, number>();
			const bookList: string[] = [];
			const normChunks: string[] = [];

			// Pre-allocate typed arrays to eliminate intermediate JS heap fragmentation
			const estimatedCapacity = 32000;
			let capacity = estimatedCapacity;
			let tempRefs = new Int32Array(capacity);
			let tempOffsets = new Int32Array(capacity);
			let tempLengths = new Uint16Array(capacity);

			let currentCount = 0;
			let currentOffset = 0;

			// Process files in non-blocking batches of 25
			const BATCH_SIZE = 25;
			for (let i = 0; i < files.length; i += BATCH_SIZE) {
				const batch = files.slice(i, i + BATCH_SIZE);
				for (const item of batch) {
					let bookIdx = bookMap.get(item.bookName);
					if (bookIdx === undefined) {
						bookIdx = bookList.length;
						bookList.push(item.bookName);
						bookMap.set(item.bookName, bookIdx);
					}

					const content = await this.app.vault.cachedRead(item.file);
					const verses = this.extractVerses(content);
					if (verses.length === 0) continue;

					const chapterNorms: string[] = [];

					for (const v of verses) {
						if (currentCount >= capacity) {
							capacity = Math.floor(capacity * 1.5);
							const nextRefs = new Int32Array(capacity);
							nextRefs.set(tempRefs);
							tempRefs = nextRefs;

							const nextOffsets = new Int32Array(capacity);
							nextOffsets.set(tempOffsets);
							tempOffsets = nextOffsets;

							const nextLengths = new Uint16Array(capacity);
							nextLengths.set(tempLengths);
							tempLengths = nextLengths;
						}

						const norm = normalizeSearchText(v.text);
						tempRefs[currentCount] =
							((bookIdx & 0xff) << 24) |
							((item.chapter & 0xff) << 16) |
							(v.verse & 0xffff);
						tempOffsets[currentCount] = currentOffset;
						tempLengths[currentCount] = norm.length;

						chapterNorms.push(norm);
						currentOffset += norm.length + 1;
						currentCount++;
					}

					normChunks.push(chapterNorms.join('\n'));
				}

				// Yield to event loop to keep Obsidian UI at 60 FPS
				await new Promise((resolve) => setTimeout(resolve, 0));
			}

			this.count = currentCount;
			this.bookNames = bookList;
			this.verseRefs = tempRefs.subarray(0, currentCount);
			this.offsets = tempOffsets.subarray(0, currentCount);
			this.lengths = tempLengths.subarray(0, currentCount);
			this.singleNormBuffer = normChunks.join('\n') + '\n';
			this.indexedVersion = version;
			this.isReady = true;
			// Warm up V8 JIT so the very first live keystroke executes in < 10ms
			this.search('dios', 1);
		} finally {
			this.isIndexing = false;
		}
	}

	/**
	 * Searches indexed verses by keywords or partial substring.
	 * Executes in < 10ms with zero disk I/O.
	 */
	search(
		query: string,
		maxResults = 20,
		passageFormat: PassageFormat = this.settings.defaultPassageFormat
	): SearchResult[] {
		if (!this.isReady || this.count === 0) return [];

		const normQuery = normalizeSearchText(query);
		if (normQuery.length < 2) return [];

		const qTokens = normQuery.split(/\s+/).filter(Boolean);
		if (qTokens.length === 0) return [];

		// Sort tokens by length descending: rarest / longest token checked first
		const sortedTokens = [...qTokens].sort((a, b) => b.length - a.length);
		const primaryToken = sortedTokens[0];
		const remainingTokens = sortedTokens.slice(1);

		const results: SearchResult[] = [];
		const seenIndices = new Set<number>();
		let pos = this.singleNormBuffer.indexOf(primaryToken, 0);

		const candidateLimit = Math.max(maxResults * 2, 40);
		while (pos !== -1 && results.length < candidateLimit) {
			const i = this.findVerseIndex(pos);
			if (i !== -1 && !seenIndices.has(i)) {
				seenIndices.add(i);
				const off = this.offsets[i];
				const len = this.lengths[i];
				const norm = this.singleNormBuffer.substr(off, len);

				let allMatch = true;
				for (let j = 0; j < remainingTokens.length; j++) {
					if (!norm.includes(remainingTokens[j])) {
						allMatch = false;
						break;
					}
				}

				if (allMatch) {
					let score = 0;
					if (norm.includes(normQuery)) {
						score += 100;
					}

					for (const token of qTokens) {
						if (
							norm.includes(` ${token} `) ||
							norm.startsWith(`${token} `) ||
							norm.endsWith(` ${token}`) ||
							norm === token
						) {
							score += 15;
						}
					}

					score -= len * 0.02;

					const encoded = this.verseRefs[i];
					const bookIdx = (encoded >>> 24) & 0xff;
					const chapter = (encoded >>> 16) & 0xff;
					const verse = encoded & 0xffff;
					const bookName = this.bookNames[bookIdx];
					const entry: VerseIndexEntry = { bookName, chapter, verse };

					const book = PassageReference.getBook(bookName) ?? {
						id: bookName.toLowerCase(),
						name: bookName,
						aliases: [bookName],
					};

					const ref = new PassageReference(
						{
							startChapter: entry.chapter,
							startVerse: entry.verse,
							endChapter: entry.chapter,
							endVerse: entry.verse,
						},
						book,
						{
							version: this.indexedVersion,
							format: passageFormat,
						}
					);

					results.push({ entry, score, ref, normExcerpt: norm });
				}
			}

			pos = this.singleNormBuffer.indexOf(
				primaryToken,
				pos + primaryToken.length
			);
		}

		results.sort((a, b) => b.score - a.score);
		return results.slice(0, maxResults);
	}

	private findVerseIndex(offset: number): number {
		let low = 0;
		let high = this.count - 1;
		while (low <= high) {
			const mid = (low + high) >> 1;
			const off = this.offsets[mid];
			const len = this.lengths[mid];
			if (offset >= off && offset < off + len + 1) {
				return mid;
			}
			if (offset < off) {
				high = mid - 1;
			} else {
				low = mid + 1;
			}
		}
		return -1;
	}

	/**
	 * Retrieves the clean original verse text for a single verse from cache.
	 */
	async getVerseText(entry: VerseIndexEntry): Promise<string> {
		const book = PassageReference.getBook(entry.bookName);
		const folderName = book?.name ?? entry.bookName;
		const path = normalizePath(
			`${this.settings.biblesPath}/${this.indexedVersion}/${folderName}/${folderName} ${entry.chapter}.md`
		);
		const file = this.app.vault.getFileByPath(path);
		if (!file) return '';
		const content = await this.app.vault.cachedRead(file);
		const verses = this.extractVerses(content);
		const found = verses.find((v) => v.verse === entry.verse);
		return found?.text ?? '';
	}

	/**
	 * Converts search results into ResolvedPassage items formatted for modal suggestions.
	 */
	async formatSearchResults(
		results: SearchResult[],
		resolver: PassageResolver,
		query: string,
		sourceFilePath?: string
	): Promise<ResolvedPassage[]> {
		const normQuery = normalizeSearchText(query);
		const tokens = normQuery.split(/\s+/).filter((t) => t.length >= 2);

		const resolved: ResolvedPassage[] = [];
		for (const res of results) {
			const rawText = await this.getVerseText(res.entry);
			const displayText = rawText || res.normExcerpt;
			const excerpt = this.highlightExcerpt(displayText, tokens);
			const formattedText = resolver.formatTexts(
				[displayText],
				res.ref,
				sourceFilePath
			);

			resolved.push({
				excerpt,
				text: formattedText,
				ref: res.ref,
			});
		}
		return resolved;
	}

	/**
	 * Highlights matching tokens within an excerpt.
	 */
	highlightExcerpt(text: string, tokens: string[]): string {
		if (tokens.length === 0) {
			return text.length > 120 ? text.slice(0, 120) + '...' : text;
		}

		// Find earliest match position to center window
		let earliestPos = -1;
		const norm = normalizeSearchText(text);
		for (const t of tokens) {
			const pos = norm.indexOf(t);
			if (pos !== -1 && (earliestPos === -1 || pos < earliestPos)) {
				earliestPos = pos;
			}
		}

		let snippet = text;
		if (earliestPos > 50) {
			snippet = '...' + text.slice(earliestPos - 30);
		}
		if (snippet.length > 140) {
			snippet = snippet.slice(0, 140) + '...';
		}

		// Highlight matching tokens with HTML mark
		for (const t of tokens) {
			const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const reg = new RegExp(`(${escaped})`, 'gi');
			snippet = snippet.replace(reg, '<mark>$1</mark>');
		}

		return snippet;
	}

	/**
	 * Extracts clean verse texts from chapter Markdown files.
	 */
	private extractVerses(
		content: string
	): { verse: number; text: string }[] {
		const verses: {
			verse: number;
			text: string;
		}[] = [];

		// Strip frontmatter
		let body = content;
		if (body.startsWith('---')) {
			const parts = body.split(/^---$/m);
			if (parts.length >= 3) {
				body = parts.slice(2).join('---');
			}
		}

		// Strip navigation, footnotes, and EGW comments
		const fnIdx = body.search(/\n---\s*\n/);
		if (fnIdx !== -1) body = body.slice(0, fnIdx);
		const egwIdx = body.search(/\n## /);
		if (egwIdx !== -1) body = body.slice(0, egwIdx);

		// Match <sup>(\d+)</sup> followed by text up to next <sup> or end
		const regex = /<sup>(\d+)<\/sup>\s*([^<]+)/g;
		let match: RegExpExecArray | null;
		while ((match = regex.exec(body)) !== null) {
			const vNum = parseInt(match[1]);
			let vText = match[2].trim();

			// Strip footnote markers e.g. [^ref_1]
			vText = vText.replace(/\[\^[^\]]+\]/g, '').trim();
			// Strip trailing whitespace or stray markdown characters
			vText = vText.replace(/\s+/g, ' ');

			if (vText) {
				verses.push({
					verse: vNum,
					text: vText,
				});
			}
		}

		return verses;
	}

	private collectChapterFiles(
		version: string
	): { file: TFile; bookName: string; chapter: number }[] {
		const versionPath = normalizePath(
			[this.settings.biblesPath, version].join('/')
		);
		const rootFolder = this.app.vault.getFolderByPath(versionPath);
		if (!rootFolder || !rootFolder.children) return [];

		const results: { file: TFile; bookName: string; chapter: number }[] = [];

		for (const bookFolder of rootFolder.children) {
			if (!('children' in bookFolder)) continue;
			const folder = bookFolder as TFolder;
			const bookName = folder.name;

			for (const child of folder.children) {
				if (!child.name.endsWith('.md')) continue;
				// Match "<Book> <Chapter>.md"
				const m = child.name.match(/^(.*?)\s+(\d+)\.md$/);
				if (m) {
					results.push({
						file: child as TFile,
						bookName,
						chapter: parseInt(m[2]),
					});
				}
			}
		}

		return results;
	}

	private resolveFirstVersion(): string {
		const folder = this.app.vault.getFolderByPath(this.settings.biblesPath);
		return (
			folder?.children?.filter((c) => 'children' in c)?.first()?.name ?? ''
		);
	}
}
