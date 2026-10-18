import { App, MarkdownView, Notice, SuggestModal } from 'obsidian';
import LocalBibleRefSettings from './settings';
import PassageReference from './passage-reference';
import PassageResolver, { ResolvedPassage } from './passage-resolver';
import BibleSearchEngine from './bible-search-engine';

export interface PluginLike {
	settings: LocalBibleRefSettings;
	searchEngine?: BibleSearchEngine;
}

export default class QuickVerseSearchModal extends SuggestModal<ResolvedPassage> {
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
				'Buscar versículo o texto (ej: Juan 3:16, luz del mundo, Gn 1:1)...'
			);
		}
	}

	async getSuggestions(query: string): Promise<ResolvedPassage[]> {
		const trimmed = query.trim();
		if (trimmed.length < 2) return [];

		// Check if query is a reference query (e.g. Jn 3:16, Gn 1:1, 1 Co 13:4)
		const isRefQuery =
			!this.concordanceMode &&
			(trimmed.startsWith('--') ||
				PassageReference.parse(
					trimmed.startsWith('--') ? trimmed : `--${trimmed}`,
					this.settings.defaultVersionShorthand,
					this.settings.defaultPassageFormat
				) !== null);

		if (isRefQuery) {
			const res = await this.resolver.resolvePassage(trimmed);
			if (res) return [res];
		}

		// Otherwise, query Full-Text Search / Concordance engine
		if (!this.searchEngine.ready && !this.searchEngine.indexing) {
			await this.searchEngine.buildIndex();
		}

		if (!this.searchEngine.ready) {
			return [];
		}

		const matches = this.searchEngine.search(trimmed, 20);
		return await this.searchEngine.formatSearchResults(
			matches,
			this.resolver,
			trimmed
		);
	}

	renderSuggestion(item: ResolvedPassage, el: HTMLElement): void {
		el.empty();
		const container = el.createEl('div', {
			cls: 'local-bible-ref-quick-container',
		});
		container.createEl('div', {
			cls: 'local-bible-ref-quick-title',
			text: item.ref.stringify(),
		});
		const excerptEl = container.createEl('div', {
			cls: 'local-bible-ref-quick-excerpt',
		});

		if (item.excerpt.includes('<mark>')) {
			excerptEl.innerHTML = item.excerpt;
		} else {
			excerptEl.setText(item.excerpt);
		}
	}

	onChooseSuggestion(
		item: ResolvedPassage,
		_: MouseEvent | KeyboardEvent
	): void {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView && activeView.editor) {
			activeView.editor.replaceSelection(item.text);
			new Notice(`Insertado: ${item.ref.stringify()}`);
		} else {
			navigator.clipboard.writeText(item.text);
			new Notice(`Copiado al portapapeles: ${item.ref.stringify()}`);
		}
	}
}
