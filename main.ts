import { Plugin } from 'obsidian';
import LocalBibleRefSettingTab, {
	BibleFormat,
} from 'src/local-bible-ref-setting-tab';
import PassageReference, { PassageFormat } from 'src/passage-reference';
import PassageResolver from 'src/passage-resolver';
import BibleSearchEngine from 'src/bible-search-engine';
import OmniboxParser from 'src/omnibox-parser';
import {
	getAdjacentChapter,
	getBookChapterCount,
	resolveBook,
	BIBLE_BOOK_ORDER,
	BIBLE_BOOK_CHAPTERS,
} from 'src/adjacent-chapter';
import BibleReaderView, {
	VIEW_TYPE_BIBLE_READER,
	BibleReaderTarget,
} from 'src/bible-reader-view';
import BibleMerger, {
	parseCommentaryContent,
	mergeChapterContent,
} from 'src/bible-merger';
import HighlightToolbar, {
	HIGHLIGHT_PALETTE,
	HighlightColor,
} from 'src/highlight-toolbar';
import HighlightMutator, {
	HighlightOptions,
	HighlightAction,
} from 'src/highlight-mutator';
export {
	PassageReference,
	PassageResolver,
	BibleSearchEngine,
	OmniboxParser,
	getAdjacentChapter,
	getBookChapterCount,
	resolveBook,
	BIBLE_BOOK_ORDER,
	BIBLE_BOOK_CHAPTERS,
	BibleReaderView,
	VIEW_TYPE_BIBLE_READER,
	BibleMerger,
	parseCommentaryContent,
	mergeChapterContent,
	HighlightToolbar,
	HIGHLIGHT_PALETTE,
	HighlightMutator,
	QuickVerseSearchModal,
};
export type { BibleReaderTarget, HighlightColor, HighlightOptions, HighlightAction };
import PassageSuggest from 'src/passage-suggest';
import QuickVerseSearchModal from 'src/quick-search-modal';
import SwitchVersionModal from 'src/switch-version-modal';
import LocalBibleRefSettings, {
	CalloutType,
	QuoteReferencePosition,
} from 'src/settings';

export default class LocalBibleRefPlugin extends Plugin {
	settings: LocalBibleRefSettings;
	searchEngine: BibleSearchEngine;

	async onload() {
		await this.loadSettings();
		this.searchEngine = new BibleSearchEngine(this.app, this.settings);
		this.addSettingTab(new LocalBibleRefSettingTab(this.app, this));
		this.registerEditorSuggest(new PassageSuggest(this.app, this.settings));

		// Register Sidebar Bible Reader View
		this.registerView(
			VIEW_TYPE_BIBLE_READER,
			(leaf) => new BibleReaderView(leaf, this)
		);

		// Build in-memory concordance index asynchronously without blocking UI
		this.searchEngine.buildIndex();

		this.addRibbonIcon(
			'book-open',
			'Buscar pasaje bíblico / Quick Bible Lookup',
			() => {
				new QuickVerseSearchModal(this.app, this).open();
			}
		);

		this.addCommand({
			id: 'quick-verse-lookup',
			name: 'Buscar pasaje o texto bíblico / Quick Bible Lookup',
			callback: () => {
				new QuickVerseSearchModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: 'quick-concordance-search',
			name: 'Concordancia bíblica / Bible Concordance Search',
			callback: () => {
				new QuickVerseSearchModal(this.app, this, true).open();
			},
		});

		this.addCommand({
			id: 'open-bible-reader',
			name: 'Abrir lector bíblico en barra lateral / Open Bible Reader in sidebar',
			callback: () => {
				BibleReaderView.activateView(this.app, this);
			},
		});

		this.addCommand({
			id: 'switch-default-version',
			name: 'Cambiar versión bíblica por defecto / Switch default Bible version',
			callback: () => {
				new SwitchVersionModal(this.app, this).open();
			},
		});
	}

	async openBibleReader(target?: BibleReaderTarget) {
		return BibleReaderView.activateView(this.app, this, target);
	}

	onunload() {}

	async loadSettings() {
		this.settings = await this.loadData();

		const quoteSettings = {
			includeReference: true,
			referencePosition: QuoteReferencePosition.End,
			linkToPassage: true,
		};

		const calloutSettings = {
			type: CalloutType.Quote,
			linkToPassage: true,
			collapsible: true,
		};

		this.settings ??= {
			biblesPath: '',
			defaultVersionShorthand: '',
			defaultPassageFormat: PassageFormat.Callout,
			bibleFormat: BibleFormat.LocalBibleRef,
			fullPreview: false,
			quote: quoteSettings,
			callout: calloutSettings,
		};

		if (!this.settings.quote) this.settings.quote = quoteSettings;
		if (!this.settings.callout) this.settings.callout = calloutSettings;

		await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
