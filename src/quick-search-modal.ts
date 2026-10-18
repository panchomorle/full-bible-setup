import { App, MarkdownView, Notice, SuggestModal } from 'obsidian';
import LocalBibleRefSettings from './settings';
import PassageReference, { PassageFormat } from './passage-reference';
import PassageResolver, { ResolvedPassage } from './passage-resolver';
import BibleSearchEngine, { SearchResult } from './bible-search-engine';
import OmniboxParser, { OmniboxPassageTarget } from './omnibox-parser';

export interface PluginLike {
	settings: LocalBibleRefSettings;
	searchEngine?: BibleSearchEngine;
}

export interface OmniboxSuggestionItem {
	category: 'passage' | 'concordance';
	isFirstInCategory: boolean;
	categoryTitle: string;
	bookName: string;
	bookId: string;
	chapter: number;
	verse: number;
	endChapter?: number;
	endVerse?: number;
	title: string;
	subtitle?: string;
	excerpt?: string;
	formattedText?: string;
	resolvedPassage?: ResolvedPassage;
}

export default class QuickVerseSearchModal extends SuggestModal<OmniboxSuggestionItem> {
	private readonly resolver: PassageResolver;
	private readonly searchEngine: BibleSearchEngine;
	private readonly settings: LocalBibleRefSettings;
	private readonly concordanceMode: boolean;

	constructor(
		app: App,
		pluginOrSettings: PluginLike | LocalBibleRefSettings,
		concordanceMode = false
	) {
		super(app);
		this.concordanceMode = concordanceMode;

		if ('settings' in pluginOrSettings) {
			this.settings = pluginOrSettings.settings;
			this.searchEngine =
				pluginOrSettings.searchEngine ??
				new BibleSearchEngine(app, this.settings);
		} else {
			this.settings = pluginOrSettings;
			this.searchEngine = new BibleSearchEngine(app, this.settings);
		}

		this.resolver = new PassageResolver(app, this.settings);

		if (this.concordanceMode) {
			this.setPlaceholder(
				'Buscar en la Biblia por palabras o texto (ej: luz del mundo, bienaventurados)...'
			);
		} else {
			this.setPlaceholder(
				'Buscar pasaje o texto (ej: juan, gn 1, juan 3:16, luz del mundo)...'
			);
		}
	}

	async getSuggestions(query: string): Promise<OmniboxSuggestionItem[]> {
		const trimmed = query.trim();
		if (trimmed.length < 2) return [];

		const items: OmniboxSuggestionItem[] = [];

		// 1. Passage and Book navigation targets (unless strictly concordanceMode)
		if (!this.concordanceMode) {
			const passageTargets = OmniboxParser.parsePassageTargets(trimmed);
			for (let i = 0; i < passageTargets.length; i++) {
				const t = passageTargets[i];
				let excerpt = '';
				let formattedText = '';
				let resolvedPassage: ResolvedPassage | undefined;

				// Fetch preview snippet asynchronously
				try {
					const res = await this.resolver.resolvePassage(t.label);
					if (res) {
						resolvedPassage = res;
						excerpt = res.excerpt;
						formattedText = res.text;
					}
				} catch {
					// Fallback to label without breaking suggestion list
				}

				items.push({
					category: 'passage',
					isFirstInCategory: i === 0,
					categoryTitle: '📖 Libros y Pasajes',
					bookName: t.bookName,
					bookId: t.bookId,
					chapter: t.chapter,
					verse: t.verse,
					endChapter: t.endChapter,
					endVerse: t.endVerse,
					title: t.label,
					subtitle: t.subtitle,
					excerpt,
					formattedText,
					resolvedPassage,
				});
			}
		}

		// 2. Full-Text Concordance search
		if (!this.searchEngine.ready && !this.searchEngine.indexing) {
			await this.searchEngine.buildIndex();
		}

		if (this.searchEngine.ready) {
			const maxConcordance = items.length > 0 ? 15 : 20;
			const matches = this.searchEngine.search(trimmed, maxConcordance);
			const formattedConcordance = await this.searchEngine.formatSearchResults(
				matches,
				this.resolver,
				trimmed
			);

			for (let i = 0; i < formattedConcordance.length; i++) {
				const fc = formattedConcordance[i];
				const match = matches[i];
				items.push({
					category: 'concordance',
					isFirstInCategory: i === 0,
					categoryTitle: '🔍 Concordancia de Texto',
					bookName: match.entry.bookName,
					bookId: match.ref.book.id,
					chapter: match.entry.chapter,
					verse: match.entry.verse,
					endChapter: match.entry.chapter,
					endVerse: match.entry.verse,
					title: match.ref.stringify(),
					excerpt: fc.excerpt,
					formattedText: fc.text,
					resolvedPassage: fc,
				});
			}
		}

		return items;
	}

	renderSuggestion(item: OmniboxSuggestionItem, el: HTMLElement): void {
		el.empty();

		if (item.isFirstInCategory) {
			el.createEl('div', {
				cls: 'local-bible-ref-omnibox-header',
				text: item.categoryTitle,
			});
		}

		const container = el.createEl('div', {
			cls: 'local-bible-ref-quick-container',
		});

		const headerRow = container.createEl('div', {
			cls: 'local-bible-ref-quick-header-row',
		});

		headerRow.createEl('span', {
			cls: 'local-bible-ref-quick-title',
			text: item.title,
		});

		if (item.subtitle) {
			headerRow.createEl('span', {
				cls: 'local-bible-ref-quick-subtitle',
				text: item.subtitle,
			});
		}

		if (item.excerpt) {
			const excerptEl = container.createEl('div', {
				cls: 'local-bible-ref-quick-excerpt',
			});

			if (item.excerpt.includes('<mark>')) {
				excerptEl.innerHTML = item.excerpt;
			} else {
				excerptEl.setText(item.excerpt);
			}
		}
	}

	onChooseSuggestion(
		item: OmniboxSuggestionItem,
		_: MouseEvent | KeyboardEvent
	): void {
		// Emit workspace event for BibleReaderView (Ticket 02/03)
		this.app.workspace.trigger('local-bible-ref:open-reader', {
			bookName: item.bookName,
			bookId: item.bookId,
			chapter: item.chapter,
			verse: item.verse,
		});

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		const textToInsert =
			item.formattedText || item.resolvedPassage?.text || item.title;

		if (activeView && activeView.editor) {
			activeView.editor.replaceSelection(textToInsert);
			new Notice(`Insertado: ${item.title}`);
		} else {
			navigator.clipboard.writeText(textToInsert);
			new Notice(`Seleccionado: ${item.title}`);
		}
	}
}
