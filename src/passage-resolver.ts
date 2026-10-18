import { App, normalizePath, TFile, TFolder } from 'obsidian';
import { BibleFormat } from './local-bible-ref-setting-tab';
import PassageReference, { PassageFormat } from './passage-reference';
import LocalBibleRefSettings, { QuoteReferencePosition } from './settings';

export interface ResolvedPassage {
	excerpt: string;
	text: string;
	ref: PassageReference;
}

export default class PassageResolver {
	private readonly app: App;
	private readonly settings: LocalBibleRefSettings;

	constructor(app: App, settings: LocalBibleRefSettings) {
		this.app = app;
		this.settings = settings;
	}

	async resolvePassage(
		query: string,
		sourceFilePath?: string
	): Promise<ResolvedPassage | null> {
		const trimmed = query.trim();
		const refText = trimmed.startsWith('--') ? trimmed : `--${trimmed}`;

		let version = this.settings.defaultVersionShorthand;
		if (!version) {
			const folder = this.app.vault.getFolderByPath(this.settings.biblesPath);
			version =
				folder?.children?.filter((c) => c instanceof TFolder)?.first()?.name ??
				'';
		}

		const passageRef = PassageReference.parse(
			refText,
			version,
			this.settings.defaultPassageFormat
		);
		if (!passageRef) return null;

		let texts = await this.getChapterTexts(passageRef);
		if (!texts) return null;

		const textFromVerse = this.getTextFromStartVerse(texts[0], passageRef);
		if (!textFromVerse) return null;
		texts[0] = textFromVerse;

		const lastIndex = texts.length - 1;
		const textToVerse = this.getTextToEndVerse(texts[lastIndex], passageRef);
		if (!textToVerse) return null;
		texts[lastIndex] = textToVerse;

		const multipleChapters = texts.length > 1;
		texts = texts.map((text, i) => {
			const chapterNumber = passageRef.startChapter + i;
			return this.cleanText(text, chapterNumber, multipleChapters);
		});

		const fullText = texts.join('\n\n');
		const excerpt = this.generateExcerpt(fullText);
		const text = this.formatTexts(texts, passageRef, sourceFilePath);

		return { excerpt, text, ref: passageRef };
	}

	async getChapterTexts(ref: PassageReference): Promise<string[] | null> {
		let basePath = '';
		let resolvedBookFolder = '';
		for (const alias of [ref.book.name, ...ref.book.aliases]) {
			const candidatePath = normalizePath(
				[this.settings.biblesPath, ref.version, alias].join('/')
			);
			if (this.app.vault.getFolderByPath(candidatePath)) {
				basePath = candidatePath;
				resolvedBookFolder = alias;
				break;
			}
		}

		if (!basePath) return null;

		const texts: string[] = [];
		for (let ch = ref.startChapter; ch <= ref.endChapter; ch++) {
			const path = `${basePath}/${resolvedBookFolder} ${ch}.md`;
			const file = this.app.vault.getFileByPath(normalizePath(path));
			if (!file) return null;

			texts.push(await this.app.vault.cachedRead(file));
		}

		return texts;
	}

	getTextFromStartVerse(text: string, ref: PassageReference): string | null {
		let pattern = '';
		if (this.settings.bibleFormat === BibleFormat.BibleLinker) {
			pattern = `#{1,6} [a-zA-Z]*${ref.startVerse}[a-zA-Z]*\\n\\w+`;
		} else {
			const quoteOrList = '(?:[>-] )*';
			const chapterNum = '(?:\\*\\*\\d{1,3}\\*\\* )?';
			const verseNum = `<sup>${ref.startVerse}</sup>`;
			pattern = quoteOrList + chapterNum + verseNum;
		}

		const regExp = new RegExp(pattern);
		const match = text.match(regExp);
		if (!match) return null;

		const verseLabel = match[0];
		const parts = text.split(regExp);
		return verseLabel + parts[1];
	}

	getTextToEndVerse(text: string, ref: PassageReference): string | null {
		if (ref.endVerse === -1) return text;

		let pattern = '';
		if (this.settings.bibleFormat === BibleFormat.BibleLinker) {
			pattern = `#{1,6} [a-zA-Z]*${ref.endVerse + 1}[a-zA-Z]*\\n\\w+`;
		} else {
			const quoteOrList = '(?:[>-] )*';
			const verseNum = `<sup>${ref.endVerse + 1}</sup>`;
			pattern = quoteOrList + verseNum;
		}

		const regex = new RegExp(pattern);
		return text.split(regex, 1)[0].trim();
	}

	cleanText(
		text: string,
		chapterNumber: number,
		multipleChapters: boolean
	): string {
		if (this.settings.bibleFormat === BibleFormat.BibleLinker) {
			text = this.formatBibleLinkerVerses(text);
		}

		text = this.removeChapterNumbers(text);
		text = this.removeHeadings(text);
		text = this.removeFootnoteRefs(text);
		text = this.removeBOF(text);
		text = this.removeEOF(text);

		if (this.settings.bibleFormat === BibleFormat.BibleLinker) {
			text = this.removeVerseSpacing(text);
		}

		const chapterMd = multipleChapters ? `**${chapterNumber}**` : '';
		if (text.startsWith('> ')) {
			const quoteMd = text.match(/^(?:> )+/)![0];
			return text.replace(quoteMd, `${quoteMd}${chapterMd} `);
		}

		if (text.startsWith('- ')) {
			const listMd = text.match(/^(?:- )+/)![0];
			return text.replace(listMd, `${listMd}${chapterMd} `);
		}

		return `${chapterMd} ${text}`;
	}

	formatBibleLinkerVerses(text: string): string {
		return text.replace(
			/#{1,6} [a-zA-Z]*(\d{1,3})[a-zA-Z]*\n(\w+)/g,
			'<sup>$1</sup> $2'
		);
	}

	removeChapterNumbers(text: string): string {
		return text.replace(/\*\*\d{1,3}\*\* /g, '');
	}

	removeHeadings(text: string): string {
		return text.replace(/^#.*[\n\r\f]*/gm, '');
	}

	removeFootnoteRefs(text: string): string {
		return text.replace(/[ \t]?\[\^[^\]\r\n]*\](?!:)/g, '');
	}

	removeBOF(text: string): string {
		if (!text.startsWith('---')) return text;
		const split = text.split(/^---$/m);
		return split[2] ? split[2].trim() : text;
	}

	removeEOF(text: string): string {
		let split = text.split(/^---$/m);
		split = split[0].split(/^\[\^\d+\]:/m, 1);
		return split[0].trim();
	}

	removeVerseSpacing(text: string): string {
		return text.replace(/\n{2,}/g, ' ');
	}

	generateExcerpt(text: string): string {
		const fullPreview = this.settings.fullPreview;
		if (fullPreview) {
			text = text.replace(/<sup>/g, '');
			text = text.replace(/<\/sup>/g, '');
		} else {
			const parts = text.split(/<\/sup>/, 2);
			text = parts[1] ?? text;
			text = text.replace(/<sup>\d+<\/sup>/g, '');
			text = text.replace(/^(?:> |- )/gm, '');
		}

		text = text.replace(
			/<span(?:\s+\w+=['"][^'"]+['"])*>([^<]+)<\/span>/g,
			'$1'
		);
		if (!fullPreview) text = text.replace(/\n/g, ' ');
		text = text.replace(/ {2,}/g, ' ');
		if (fullPreview) return text;
		return text.slice(0, 45) + '...';
	}

	formatTexts(
		texts: string[],
		passageRef: PassageReference,
		sourceFilePath?: string
	): string {
		let formatted = '';
		switch (passageRef.format) {
			case PassageFormat.Manuscript:
				formatted = texts.join(' ').trim();
				formatted = formatted.replace(/\n+/g, ' ');
				formatted = formatted.replace(/\*\*\d{1,3}\*\*/g, '');
				formatted = formatted.replace(/<sup>\d{1,3}<\/sup> /g, '');
				formatted = formatted.replace(/(?:^[>-] | [>-] )/g, ' ');
				formatted = formatted.trim() + '\n\n';
				break;
			case PassageFormat.Paragraph:
				formatted = texts.join('\n\n').trim();
				formatted += '\n\n';
				break;
			case PassageFormat.Quote: {
				const { includeReference, referencePosition, linkToPassage } =
					this.settings.quote;

				let stringRef = '';
				if (includeReference) {
					if (linkToPassage)
						stringRef = this.generatePassageLink(passageRef, sourceFilePath);
					else stringRef = passageRef.stringify();
					if (referencePosition === QuoteReferencePosition.Beginning)
						stringRef += '\n';
					else stringRef = `\n> ${stringRef}`;
				}

				formatted = '> ';
				if (referencePosition === QuoteReferencePosition.Beginning)
					formatted += stringRef;
				formatted += texts.join('\n\n').trim();
				formatted = formatted.replace(/\n/gm, '\n> ');
				if (referencePosition === QuoteReferencePosition.End)
					formatted += stringRef;
				formatted += '\n\n';
				break;
			}
			case PassageFormat.Callout: {
				const { type, linkToPassage, collapsible } = this.settings.callout;

				let stringRef = '';
				if (linkToPassage)
					stringRef = this.generatePassageLink(passageRef, sourceFilePath);
				else stringRef = passageRef.stringify();

				formatted = `> [!${type}]${collapsible ? '+' : ''} ${stringRef}\n`;
				formatted += texts.join('\n\n').trim();
				formatted = formatted.replace(/\n/gm, '\n> ');
				formatted += '\n\n';
				break;
			}
		}

		return formatted;
	}

	generatePassageLink(
		ref: PassageReference,
		sourceFilePath?: string
	): string {
		const { version, book, startChapter, startVerse } = ref;
		let resolvedBookFolder = book.name;
		for (const alias of [book.name, ...book.aliases]) {
			const testPath = normalizePath(
				`${this.settings.biblesPath}/${version}/${alias}`
			);
			if (this.app.vault.getFolderByPath(testPath)) {
				resolvedBookFolder = alias;
				break;
			}
		}
		const path = `${this.settings.biblesPath}/${version}/${resolvedBookFolder}/${resolvedBookFolder} ${startChapter}.md`;
		const file = this.app.vault.getFileByPath(normalizePath(path));
		if (!file) return ref.stringify();

		return this.app.fileManager.generateMarkdownLink(
			file,
			sourceFilePath ?? '',
			this.settings.bibleFormat === BibleFormat.BibleLinker
				? `#${startVerse}`
				: undefined,
			ref.stringify()
		);
	}
}
