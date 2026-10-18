import { Plugin } from 'obsidian';
import LocalBibleRefSettingTab, {
	BibleFormat,
} from 'src/local-bible-ref-setting-tab';
import PassageReference, { PassageFormat } from 'src/passage-reference';
import PassageResolver from 'src/passage-resolver';
import BibleSearchEngine from 'src/bible-search-engine';
export { PassageReference, PassageResolver, BibleSearchEngine };
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
			id: 'switch-default-version',
			name: 'Cambiar versión bíblica por defecto / Switch default Bible version',
			callback: () => {
				new SwitchVersionModal(this.app, this).open();
			},
		});
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
