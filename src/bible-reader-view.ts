import {
	App,
	ItemView,
	MarkdownRenderer,
	normalizePath,
	TFile,
	TFolder,
	WorkspaceLeaf,
} from 'obsidian';
import { Book } from './i18n/models';
import LocalBibleRefSettings from './settings';
import {
	getAdjacentChapter,
	resolveBook,
} from './adjacent-chapter';

export const VIEW_TYPE_BIBLE_READER = 'local-bible-reader-view';

export interface BibleReaderTarget {
	bookId?: string;
	bookName?: string;
	chapter: number;
	verse?: number;
	version?: string;
}

export interface ILocalBibleRefPlugin {
	app: App;
	settings: LocalBibleRefSettings;
}

export default class BibleReaderView extends ItemView {
	private readonly plugin: ILocalBibleRefPlugin;

	private headerEl: HTMLElement;
	private bodyEl: HTMLElement;
	private footerEl: HTMLElement;

	private currentBook: Book | null = null;
	private currentChapter: number = 1;
	private currentVerse?: number;
	private currentVersion: string = '';
	private currentFilePath: string = '';
	private isContentLoaded: boolean = false;

	constructor(leaf: WorkspaceLeaf, plugin: ILocalBibleRefPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_BIBLE_READER;
	}

	getDisplayText(): string {
		if (this.currentBook) {
			return `${this.currentBook.name} ${this.currentChapter}`;
		}
		return 'Bible Reader';
	}

	getIcon(): string {
		return 'book-open';
	}

	get hasContent(): boolean {
		return this.isContentLoaded;
	}

	async onload() {
		super.onload();
		this.buildLayout();
	}

	private buildLayout() {
		this.containerEl.empty();
		this.containerEl.addClass('local-bible-reader-container');

		this.headerEl = this.containerEl.createDiv({
			cls: 'local-bible-reader-header',
		});

		this.bodyEl = this.containerEl.createDiv({
			cls: 'local-bible-reader-body',
		});
		this.bodyEl.setAttribute('contenteditable', 'false');
		this.bodyEl.setAttribute('spellcheck', 'false');

		this.footerEl = this.containerEl.createDiv({
			cls: 'local-bible-reader-footer',
		});

		// Hover preview support for Obsidian links and footnotes
		this.registerDomEvent(this.bodyEl, 'mouseover', (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			const linkEl = target.closest(
				'a.internal-link, .footnote-link, .footnote-backref, a.footnote-link'
			) as HTMLElement | null;
			if (!linkEl) return;

			const linktext =
				linkEl.getAttribute('data-href') || linkEl.getAttribute('href');
			if (!linktext) return;

			this.app.workspace.trigger('hover-link', {
				event,
				source: VIEW_TYPE_BIBLE_READER,
				hoverParent: this,
				targetEl: linkEl,
				linktext,
				sourcePath: this.currentFilePath,
			});
		});

		// Prevent keyboard modifications in read-only view
		this.registerDomEvent(this.bodyEl, 'keydown', (event: KeyboardEvent) => {
			if (
				!event.ctrlKey &&
				!event.metaKey &&
				event.key.length === 1 &&
				!event.altKey
			) {
				event.preventDefault();
			}
		});
	}

	/**
	 * Opens a passage coordinate in the reader.
	 */
	async openPassage(target: BibleReaderTarget): Promise<void> {
		const book = resolveBook(target.bookId || target.bookName || 'gen');
		if (!book) {
			console.error('BibleReaderView: Book could not be resolved', target);
			return;
		}

		this.currentBook = book;
		this.currentChapter = target.chapter || 1;
		this.currentVerse = target.verse;
		this.currentVersion =
			target.version ||
			this.currentVersion ||
			this.plugin.settings.defaultVersionShorthand ||
			this.resolveFirstVersion();

		await this.renderCurrentChapter();

		if (target.verse) {
			this.scrollToVerse(target.verse);
		}
	}

	/**
	 * Opens default chapter (Genesis 1) or last read state.
	 */
	async openDefaultOrLast(): Promise<void> {
		if (this.currentBook) {
			await this.renderCurrentChapter();
		} else {
			await this.openPassage({
				bookId: 'gen',
				chapter: 1,
				verse: 1,
			});
		}
	}

	getState(): Record<string, any> {
		return {
			bookId: this.currentBook?.id,
			bookName: this.currentBook?.name,
			chapter: this.currentChapter,
			verse: this.currentVerse,
			version: this.currentVersion,
		};
	}

	async setState(state: any, result: any): Promise<void> {
		super.setState(state, result);
		if (state && (state.bookId || state.bookName)) {
			await this.openPassage({
				bookId: state.bookId,
				bookName: state.bookName,
				chapter: state.chapter || 1,
				verse: state.verse,
				version: state.version,
			});
		}
	}

	/**
	 * Renders the active chapter content, header navigation, and footer navigation.
	 */
	private async renderCurrentChapter(): Promise<void> {
		if (!this.currentBook) return;

		const file = this.resolveChapterFile(
			this.currentVersion,
			this.currentBook,
			this.currentChapter
		);

		this.renderHeader();

		this.bodyEl.empty();

		if (!file) {
			const errorDiv = this.bodyEl.createDiv({
				cls: 'local-bible-reader-empty',
			});
			errorDiv.createEl('h3', {
				text: `${this.currentBook.name} ${this.currentChapter}`,
			});
			errorDiv.createEl('p', {
				text: `No se encontró el archivo del capítulo en la versión "${this.currentVersion}". Verifica la ruta configurada en ajustes.`,
			});
			this.renderFooter();
			return;
		}

		this.currentFilePath = file.path;

		const rawContent = await this.app.vault.read(file);
		const cleanMarkdown = this.stripFrontmatter(rawContent);

		// Render markdown with full Obsidian fidelity (footnotes, callouts, formatting)
		await MarkdownRenderer.renderMarkdown(
			cleanMarkdown,
			this.bodyEl,
			file.path,
			this
		);

		this.isContentLoaded = true;
		this.renderFooter();

		// Refresh view title in tab header
		const leaf = this.leaf as any;
		if (leaf?.updateHeader) {
			leaf.updateHeader();
		}
	}

	/**
	 * Renders responsive top navigation header with Prev / Title / Next controls.
	 */
	private renderHeader(): void {
		if (!this.headerEl || !this.currentBook) return;
		this.headerEl.empty();

		const prevTarget = getAdjacentChapter(
			this.currentBook.id,
			this.currentChapter,
			'prev'
		);
		const nextTarget = getAdjacentChapter(
			this.currentBook.id,
			this.currentChapter,
			'next'
		);

		// Previous Chapter button
		const prevBtn = this.headerEl.createEl('button', {
			cls: 'local-bible-reader-nav-btn prev',
			text: '‹',
		});
		if (prevTarget) {
			prevBtn.title = `Capítulo anterior: ${prevTarget.book.name} ${prevTarget.chapter}`;
			prevBtn.onclick = () =>
				this.openPassage({
					bookId: prevTarget.book.id,
					chapter: prevTarget.chapter,
				});
		} else {
			prevBtn.setAttribute('disabled', 'true');
			prevBtn.addClass('is-disabled');
		}

		// Title & Version container
		const titleContainer = this.headerEl.createDiv({
			cls: 'local-bible-reader-title-container',
		});

		titleContainer.createEl('span', {
			cls: 'local-bible-reader-title',
			text: `${this.currentBook.name} ${this.currentChapter}`,
		});

		if (this.currentVersion) {
			titleContainer.createEl('span', {
				cls: 'local-bible-reader-version-badge',
				text: this.currentVersion,
			});
		}

		// Next Chapter button
		const nextBtn = this.headerEl.createEl('button', {
			cls: 'local-bible-reader-nav-btn next',
			text: '›',
		});
		if (nextTarget) {
			nextBtn.title = `Capítulo siguiente: ${nextTarget.book.name} ${nextTarget.chapter}`;
			nextBtn.onclick = () =>
				this.openPassage({
					bookId: nextTarget.book.id,
					chapter: nextTarget.chapter,
				});
		} else {
			nextBtn.setAttribute('disabled', 'true');
			nextBtn.addClass('is-disabled');
		}
	}

	/**
	 * Renders responsive bottom footer navigation controls.
	 */
	private renderFooter(): void {
		if (!this.footerEl || !this.currentBook) return;
		this.footerEl.empty();

		const prevTarget = getAdjacentChapter(
			this.currentBook.id,
			this.currentChapter,
			'prev'
		);
		const nextTarget = getAdjacentChapter(
			this.currentBook.id,
			this.currentChapter,
			'next'
		);

		const footerNav = this.footerEl.createDiv({
			cls: 'local-bible-reader-footer-nav',
		});

		if (prevTarget) {
			const prevBtn = footerNav.createEl('button', {
				cls: 'local-bible-reader-footer-btn prev',
				text: `← ${prevTarget.book.name} ${prevTarget.chapter}`,
			});
			prevBtn.onclick = () =>
				this.openPassage({
					bookId: prevTarget.book.id,
					chapter: prevTarget.chapter,
				});
		} else {
			footerNav.createDiv({ cls: 'local-bible-reader-footer-placeholder' });
		}

		if (nextTarget) {
			const nextBtn = footerNav.createEl('button', {
				cls: 'local-bible-reader-footer-btn next',
				text: `${nextTarget.book.name} ${nextTarget.chapter} →`,
			});
			nextBtn.onclick = () =>
				this.openPassage({
					bookId: nextTarget.book.id,
					chapter: nextTarget.chapter,
				});
		} else {
			footerNav.createDiv({ cls: 'local-bible-reader-footer-placeholder' });
		}
	}

	/**
	 * Scrolls smoothly to a target verse number with a temporary highlight pulse.
	 */
	scrollToVerse(verse: number): void {
		if (!this.bodyEl) return;

		const schedule =
			typeof requestAnimationFrame === 'function'
				? requestAnimationFrame
				: (fn: () => void) => setTimeout(fn, 0);

		schedule(() => {
			const sups = this.bodyEl.querySelectorAll('sup');
			let targetEl: HTMLElement | null = null;

			for (const sup of Array.from(sups)) {
				const text = sup.textContent?.trim();
				if (text === String(verse) || text?.startsWith(String(verse))) {
					targetEl = sup as HTMLElement;
					break;
				}
			}

			if (targetEl) {
				targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
				const container =
					(targetEl.closest('p, div, li') as HTMLElement) || targetEl;
				container.classList.add('local-bible-reader-pulse');
				setTimeout(() => {
					container.classList.remove('local-bible-reader-pulse');
				}, 2500);
			}
		});
	}

	/**
	 * Resolves the chapter TFile from disk based on vault configuration and book aliases.
	 */
	private resolveChapterFile(
		version: string,
		book: Book,
		chapter: number
	): TFile | null {
		const biblesPath = this.plugin.settings.biblesPath;
		const aliasesToTry = [book.name, ...book.aliases];

		for (const alias of aliasesToTry) {
			const candidateFolder = normalizePath(
				[biblesPath, version, alias].join('/')
			);
			const folder = this.app.vault.getFolderByPath(candidateFolder);
			if (folder) {
				const candidateFilePath = normalizePath(
					`${candidateFolder}/${alias} ${chapter}.md`
				);
				const file = this.app.vault.getFileByPath(candidateFilePath);
				if (file && 'path' in file) return file as TFile;

				if (folder.children) {
					for (const child of folder.children) {
						if (child && 'path' in child && child.name.endsWith('.md')) {
							const m = child.name.match(/^(.*?)\s+(\d+)\.md$/);
							if (m && parseInt(m[2]) === chapter) {
								return child as TFile;
							}
						}
					}
				}
			}
		}

		return null;
	}

	private resolveFirstVersion(): string {
		const folder = this.app.vault.getFolderByPath(
			this.plugin.settings.biblesPath
		);
		return (
			folder?.children?.filter((c) => 'children' in c)?.first()?.name ?? ''
		);
	}

	private stripFrontmatter(content: string): string {
		if (content.startsWith('---')) {
			const parts = content.split(/^---$/m);
			if (parts.length >= 3) {
				return parts.slice(2).join('---').trim();
			}
		}
		return content.trim();
	}

	/**
	 * Activates or reveals the singleton BibleReaderView leaf in Obsidian's right sidebar.
	 */
	static async activateView(
		app: App,
		plugin: ILocalBibleRefPlugin,
		target?: BibleReaderTarget
	): Promise<BibleReaderView> {
		const { workspace } = app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_BIBLE_READER)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({
					type: VIEW_TYPE_BIBLE_READER,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
			const view = leaf.view;
			if (view instanceof BibleReaderView) {
				if (target) {
					await view.openPassage(target);
				} else if (!view.hasContent) {
					await view.openDefaultOrLast();
				}
				return view;
			}
		}

		throw new Error('Unable to activate BibleReaderView in workspace leaf');
	}
}
