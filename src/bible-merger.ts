import { App, normalizePath, TFile, TFolder } from 'obsidian';

export interface CommentaryAnchor {
	startVerse: number;
	endVerse: number;
	rangeKey: string;
	anchor: string;
	noteName: string;
	badge: string;
}

export interface MergeOptions {
	baseBibleFolder: string;
	commentaryFolder: string;
	derivedVersionName?: string;
	defaultBadge?: string;
	onProgress?: (current: number, total: number, message: string) => void;
}

export interface MergeResult {
	success: boolean;
	totalChaptersMerged: number;
	totalBadgesInjected: number;
	outputFolder: string;
	error?: string;
}

/**
 * Pure function: parses commentary note content and extracts atomic anchors with metadata.
 */
export function parseCommentaryContent(
	content: string,
	noteName: string,
	defaultBadge = '🕊️'
): CommentaryAnchor[] {
	let noteBadge = defaultBadge;

	// Extract badge from YAML frontmatter if specified
	if (content.startsWith('---')) {
		const parts = content.split(/^---$/m);
		if (parts.length >= 3) {
			const frontmatter = parts[1];
			const mBadge = frontmatter.match(/^\s*badge:\s*["']?([^"'\r\n]+)["']?/m);
			if (mBadge && mBadge[1].trim()) {
				noteBadge = mBadge[1].trim();
			}
		}
	}

	const anchors: CommentaryAnchor[] = [];
	// Matches anchors like ^egw-1-1-3, ^egw-1-26, ^cba-5-13-14
	const anchorRegex = /\^([a-zA-Z0-9_]+)-(\d+)-(\d+(?:-\d+)?)/g;
	let match: RegExpExecArray | null;

	while ((match = anchorRegex.exec(content)) !== null) {
		const fullAnchor = match[0].substring(1); // strip leading ^
		const rangeKey = match[3];
		const rangeParts = rangeKey.split('-');
		const startVerse = parseInt(rangeParts[0], 10);
		const endVerse = parseInt(rangeParts[rangeParts.length - 1], 10);

		if (!isNaN(startVerse) && !isNaN(endVerse)) {
			anchors.push({
				startVerse,
				endVerse,
				rangeKey,
				anchor: fullAnchor,
				noteName,
				badge: noteBadge,
			});
		}
	}

	return anchors;
}

/**
 * Pure function: merges base Bible chapter content with commentary anchors using the
 * range de-cluttering rule (annotated badge on startVerse only).
 */
export function mergeChapterContent(
	baseContent: string,
	bookName: string,
	chapter: number,
	anchors: CommentaryAnchor[],
	derivedVersionName: string,
	baseVersionName: string,
	commentarySuffix: string
): { mergedContent: string; badgesInjected: number } {
	let badgesInjected = 0;

	// Group anchors by startVerse
	const anchorsByStart = new Map<number, CommentaryAnchor[]>();
	for (const a of anchors) {
		if (!anchorsByStart.has(a.startVerse)) {
			anchorsByStart.set(a.startVerse, []);
		}
		anchorsByStart.get(a.startVerse)?.push(a);
	}

	// Update frontmatter
	let body = baseContent;
	const derivedFrontmatter = [
		'---',
		`version: ${derivedVersionName}`,
		`base_version: ${baseVersionName}`,
		`commentary: ${commentarySuffix}`,
		`book: ${bookName}`,
		`chapter: ${chapter}`,
		'---',
	].join('\n');

	if (body.startsWith('---')) {
		const parts = body.split(/^---$/m);
		if (parts.length >= 3) {
			body = derivedFrontmatter + parts.slice(2).join('---');
		} else {
			body = derivedFrontmatter + '\n\n' + body;
		}
	} else {
		body = derivedFrontmatter + '\n\n' + body;
	}

	// Inject badges into verses matching <sup>(v)</sup>
	// Rule: only the startVerse receives a badge (e.g. 🕊️ 4-14 for spans, 🕊️ for single)
	const verseRegex = /(<sup>(\d+)<\/sup>)/g;
	body = body.replace(verseRegex, (match, fullSup, vStr) => {
		const vNum = parseInt(vStr, 10);
		const verseAnchors = anchorsByStart.get(vNum);
		if (!verseAnchors || verseAnchors.length === 0) {
			return fullSup;
		}

		const badgeLinks: string[] = [];
		for (const a of verseAnchors) {
			badgesInjected++;
			if (a.startVerse === a.endVerse) {
				badgeLinks.push(`[[${a.noteName}#^${a.anchor}|${a.badge}]]`);
			} else {
				badgeLinks.push(`[[${a.noteName}#^${a.anchor}|${a.badge} ${a.rangeKey}]]`);
			}
		}

		const uniqueBadgeLinks = Array.from(new Set(badgeLinks));
		return `${fullSup} ${uniqueBadgeLinks.join(' ')}`;
	});

	return { mergedContent: body, badgesInjected };
}

export default class BibleMerger {
	private readonly app: App;
	private readonly biblesBasePath: string;

	constructor(app: App, biblesBasePath: string) {
		this.app = app;
		this.biblesBasePath = normalizePath(biblesBasePath);
	}

	/**
	 * Scans the vault for candidate base Bible translations under biblesBasePath.
	 * Excludes commentary folders and already derived editions.
	 */
	getAvailableBaseBibles(): string[] {
		const rootFolder = this.app.vault.getFolderByPath(this.biblesBasePath);
		if (!rootFolder || !rootFolder.children) return [];

		return rootFolder.children
			.filter((c): c is TFolder => c instanceof TFolder)
			.map((f) => f.name)
			.filter(
				(name) =>
					name.toLowerCase() !== 'comentarios' &&
					!name.includes('(') &&
					!name.includes('+')
			);
	}

	/**
	 * Scans the vault for available commentary collections under biblesBasePath/Comentarios.
	 */
	getAvailableCommentaries(): string[] {
		const comentariosPath = normalizePath(
			`${this.biblesBasePath}/Comentarios`
		);
		const comFolder = this.app.vault.getFolderByPath(comentariosPath);
		if (!comFolder || !comFolder.children) return [];

		return comFolder.children
			.filter((c): c is TFolder => c instanceof TFolder)
			.map((f) => f.name);
	}

	/**
	 * Executes the non-destructive merge of baseBibleFolder and commentaryFolder.
	 */
	async merge(options: MergeOptions): Promise<MergeResult> {
		const commentarySuffix =
			options.commentaryFolder.split('/').pop() || 'EGW';
		const derivedName =
			options.derivedVersionName ||
			`${options.baseBibleFolder} (${commentarySuffix})`;
		const defaultBadge = options.defaultBadge || '🕊️';

		// Resolve commentary path: could be "EGW" or "Comentarios/EGW"
		let fullComPath = options.commentaryFolder;
		if (!fullComPath.startsWith(this.biblesBasePath)) {
			if (!fullComPath.includes('Comentarios')) {
				fullComPath = `${this.biblesBasePath}/Comentarios/${fullComPath}`;
			} else {
				fullComPath = `${this.biblesBasePath}/${fullComPath}`;
			}
		}
		fullComPath = normalizePath(fullComPath);

		// Resolve base Bible path
		let fullBasePath = options.baseBibleFolder;
		if (!fullBasePath.startsWith(this.biblesBasePath)) {
			fullBasePath = `${this.biblesBasePath}/${fullBasePath}`;
		}
		fullBasePath = normalizePath(fullBasePath);

		const baseRoot = this.app.vault.getFolderByPath(fullBasePath);
		if (!baseRoot) {
			return {
				success: false,
				totalChaptersMerged: 0,
				totalBadgesInjected: 0,
				outputFolder: derivedName,
				error: `Base Bible folder not found at: ${fullBasePath}`,
			};
		}

		options.onProgress?.(0, 100, 'Indexando notas de comentario...');

		// 1. Scan and index all commentary anchors: book -> chapter -> anchors
		const commentaryIndex = new Map<string, Map<number, CommentaryAnchor[]>>();
		const comRoot = this.app.vault.getFolderByPath(fullComPath);

		if (comRoot) {
			await this.collectCommentaryAnchors(comRoot, commentaryIndex, defaultBadge);
		}

		// 2. Collect all base Bible chapter files
		const chapterFiles = this.collectBaseChapterFiles(baseRoot);
		const totalFiles = chapterFiles.length;

		if (totalFiles === 0) {
			return {
				success: false,
				totalChaptersMerged: 0,
				totalBadgesInjected: 0,
				outputFolder: derivedName,
				error: `No chapter markdown files found in: ${fullBasePath}`,
			};
		}

		const targetBasePath = normalizePath(
			`${this.biblesBasePath}/${derivedName}`
		);
		await this.ensureFolder(targetBasePath);

		let chaptersMerged = 0;
		let totalBadges = 0;

		// 3. Merge files in non-blocking batches of 20
		const BATCH_SIZE = 20;
		for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
			const batch = chapterFiles.slice(i, i + BATCH_SIZE);
			for (const item of batch) {
				const baseContent = await this.app.vault.read(item.file);
				const anchors =
					commentaryIndex.get(item.bookName)?.get(item.chapter) || [];

				const { mergedContent, badgesInjected } = mergeChapterContent(
					baseContent,
					item.bookName,
					item.chapter,
					anchors,
					derivedName,
					options.baseBibleFolder,
					commentarySuffix
				);

				totalBadges += badgesInjected;

				const targetBookFolder = normalizePath(
					`${targetBasePath}/${item.bookName}`
				);
				await this.ensureFolder(targetBookFolder);

				const targetFilePath = normalizePath(
					`${targetBookFolder}/${item.file.name}`
				);
				await this.writeVaultFile(targetFilePath, mergedContent);
				chaptersMerged++;
			}

			const percent = Math.round((chaptersMerged / totalFiles) * 100);
			options.onProgress?.(
				chaptersMerged,
				totalFiles,
				`Fusionando capítulos: ${chaptersMerged}/${totalFiles} (${percent}%)`
			);

			// Yield to event loop to keep Obsidian UI completely smooth
			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		return {
			success: true,
			totalChaptersMerged: chaptersMerged,
			totalBadgesInjected: totalBadges,
			outputFolder: targetBasePath,
		};
	}

	private async collectCommentaryAnchors(
		folder: TFolder,
		index: Map<string, Map<number, CommentaryAnchor[]>>,
		defaultBadge: string
	): Promise<void> {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				await this.collectCommentaryAnchors(child, index, defaultBadge);
			} else if (child instanceof TFile && child.name.endsWith('.md')) {
				// Parse book and chapter from note name, e.g. "Génesis 1 (EGW).md"
				const m = child.name.match(/^(.*?)\s+(\d+)\s*\([^)]+\)\.md$/);
				if (m) {
					const bookName = m[1].trim();
					const chapter = parseInt(m[2], 10);
					const content = await this.app.vault.read(child);
					const noteName = child.basename;
					const anchors = parseCommentaryContent(
						content,
						noteName,
						defaultBadge
					);

					if (!index.has(bookName)) {
						index.set(bookName, new Map());
					}
					index.get(bookName)?.set(chapter, anchors);
				}
			}
		}
	}

	private collectBaseChapterFiles(
		folder: TFolder
	): { file: TFile; bookName: string; chapter: number }[] {
		const results: { file: TFile; bookName: string; chapter: number }[] = [];

		for (const bookChild of folder.children) {
			if (bookChild instanceof TFolder) {
				const bookName = bookChild.name;
				for (const fileChild of bookChild.children) {
					if (fileChild instanceof TFile && fileChild.name.endsWith('.md')) {
						const m = fileChild.name.match(/^(.*?)\s+(\d+)\.md$/);
						if (m) {
							results.push({
								file: fileChild,
								bookName,
								chapter: parseInt(m[2], 10),
							});
						}
					}
				}
			}
		}

		return results;
	}

	private async ensureFolder(path: string): Promise<void> {
		const norm = normalizePath(path);
		const existing = this.app.vault.getFolderByPath(norm);
		if (!existing) {
			try {
				await this.app.vault.createFolder(norm);
			} catch (e) {
				// Folder might have been created concurrently
			}
		}
	}

	private async writeVaultFile(path: string, content: string): Promise<void> {
		const norm = normalizePath(path);
		const existing = this.app.vault.getFileByPath(norm);
		if (existing) {
			await this.app.vault.modify(existing, content);
		} else {
			await this.app.vault.create(norm, content);
		}
	}
}
