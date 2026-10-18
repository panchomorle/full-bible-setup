import LocalBibleRefPlugin from 'main';
import {
	App,
	getLanguage,
	normalizePath,
	Notice,
	PluginSettingTab,
	Setting,
	SettingGroup,
	TextComponent,
} from 'obsidian';
import { PassageFormat } from './passage-reference';
import PathSuggest from './path-suggest';
import { CalloutType, QuoteReferencePosition } from './settings';
import VersionSuggest from './version-suggest';
import { SettingsLabels } from './i18n/models';
import { I18N } from './i18n';
import BibleMerger from './bible-merger';

export default class LocalBibleRefSettingTab extends PluginSettingTab {
	private readonly settingClass = 'local-bible-ref-setting';

	private plugin: LocalBibleRefPlugin;
	private folderDoesNotExistText = '';
	private settingsLabels: SettingsLabels;

	constructor(app: App, plugin: LocalBibleRefPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		switch (getLanguage()) {
			case 'cs':
				this.folderDoesNotExistText = I18N.CS.COMMON.folderDoesNotExist;
				this.settingsLabels = I18N.CS.SETTINGS;
				break;
			case 'de':
				this.folderDoesNotExistText = I18N.DE.COMMON.folderDoesNotExist;
				this.settingsLabels = I18N.DE.SETTINGS;
				break;
			case 'es':
				this.folderDoesNotExistText = I18N.ES.COMMON.folderDoesNotExist;
				this.settingsLabels = I18N.ES.SETTINGS;
				break;
			case 'ko':
				this.folderDoesNotExistText = I18N.KO.COMMON.folderDoesNotExist;
				this.settingsLabels = I18N.KO.SETTINGS;
				break;
			case 'en':
			default:
				this.folderDoesNotExistText = I18N.EN.COMMON.folderDoesNotExist;
				this.settingsLabels = I18N.EN.SETTINGS;
				break;
		}
	}

	display(): void {
		const { containerEl } = this;
		const { required, optional, quoteFormat, calloutFormat, issues } =
			this.settingsLabels;
		containerEl.empty();

		// required settings ---
		let biblesPathTimeout: number;
		new SettingGroup(containerEl)
			.setHeading(required.name)
			.addSetting((setting) =>
				setting
					.setName(required.controls.biblesPath.name)
					.setDesc(required.controls.biblesPath.description)
					.setClass(this.settingClass)
					.addText((text) => {
						text
							.setPlaceholder(required.controls.biblesPath.placeholder)
							.setValue(this.plugin.settings.biblesPath)
							.onChange(async (value) => {
								// toggle editability of default version setting
								if (value) {
									defaultVersionSetting.setDisabled(false);
								} else {
									defaultVersionSetting.setDisabled(true);
									const textComponent = defaultVersionSetting
										.components[0] as TextComponent;
									textComponent.inputEl.value = '';
									this.plugin.settings.defaultVersionShorthand = '';
								}

								const path = value ? normalizePath(value) : '';
								this.plugin.settings.biblesPath = path;
								await this.plugin.saveSettings();

								clearTimeout(biblesPathTimeout);
								biblesPathTimeout = window.setTimeout(async () => {
									if (!path) return;
									const exists = this.app.vault.getFolderByPath(path);
									if (!exists)
										new Notice(`${this.folderDoesNotExistText} ${path}.`);
								}, 1000);
							});

						new PathSuggest(this.app, text.inputEl);
					})
			);

		// optional settings ---
		let defaultVersionTimeout: number;
		let defaultVersionSetting = {} as Setting;
		new SettingGroup(containerEl)
			.setHeading(optional.name)
			.addSetting((setting) => {
				setting
					.setName(optional.controls.defaultVersion.name)
					.setDesc(optional.controls.defaultVersion.description)
					.setClass(this.settingClass)
					.addText((text) => {
						text
							.setPlaceholder(optional.controls.defaultVersion.placeholder)
							.setValue(this.plugin.settings.defaultVersionShorthand)
							.onChange(async (value) => {
								this.plugin.settings.defaultVersionShorthand = value;
								await this.plugin.saveSettings();

								clearTimeout(defaultVersionTimeout);
								defaultVersionTimeout = window.setTimeout(async () => {
									const path = `${this.plugin.settings.biblesPath}/${value}`;
									const exists = this.app.vault.getFolderByPath(
										normalizePath(path)
									);
									if (!exists)
										new Notice(`${this.folderDoesNotExistText} ${path}.`);
								}, 1000);
							});

						new VersionSuggest(this.app, text.inputEl, this.plugin.settings);
					});

				if (this.plugin.settings.biblesPath) setting.setDisabled(false);
				else setting.setDisabled(true);
				defaultVersionSetting = setting;
			})
			.addSetting((setting) =>
				setting
					.setName(optional.controls.defaultPassageFormat.name)
					.setDesc(optional.controls.defaultPassageFormat.description)
					.setClass(this.settingClass)
					.addDropdown((dropdown) =>
						dropdown
							.addOptions(optional.controls.defaultPassageFormat.options)
							.setValue(this.plugin.settings.defaultPassageFormat)
							.onChange(async (value) => {
								this.plugin.settings.defaultPassageFormat =
									value as PassageFormat;
								await this.plugin.saveSettings();
							})
					)
			)
			.addSetting((setting) =>
				setting
					.setName(optional.controls.bibleFormat.name)
					.setDesc(optional.controls.bibleFormat.description)
					.setClass(this.settingClass)
					.addDropdown((dropdown) =>
						dropdown
							.addOptions({
								[BibleFormat.LocalBibleRef]: 'Local Bible Ref',
								[BibleFormat.BibleLinker]: 'Bible Linker',
							})
							.setValue(this.plugin.settings.bibleFormat)
							.onChange(async (value) => {
								this.plugin.settings.bibleFormat = value as BibleFormat;
								await this.plugin.saveSettings();
							})
					)
			)
			.addSetting((setting) =>
				setting
					.setName(optional.controls.fullPreview.name)
					.setDesc(optional.controls.fullPreview.description)
					.setClass(this.settingClass)
					.addToggle((toggle) =>
						toggle
							.setValue(this.plugin.settings.fullPreview)
							.onChange(async (value) => {
								this.plugin.settings.fullPreview = value;
								await this.plugin.saveSettings();
							})
					)
			);

		// quote format settings ---
		let quoteRefPositionSetting = {} as Setting;
		let quoteRefLinkSetting = {} as Setting;
		new SettingGroup(containerEl)
			.setHeading(quoteFormat.name)
			.addSetting((setting) =>
				setting
					.setName(quoteFormat.controls.includeReference.name)
					.setDesc(quoteFormat.controls.includeReference.description)
					.setClass(this.settingClass)
					.addToggle((toggle) =>
						toggle
							.setValue(this.plugin.settings.quote.includeReference)
							.onChange(async (value) => {
								// toggle editability of other paragraph reference settings
								if (value) {
									quoteRefPositionSetting.setDisabled(false);
									quoteRefLinkSetting.setDisabled(false);
								} else {
									quoteRefPositionSetting.setDisabled(true);
									quoteRefLinkSetting.setDisabled(true);
								}

								this.plugin.settings.quote.includeReference = value;
								await this.plugin.saveSettings();
							})
					)
			)
			.addSetting((setting) => {
				setting
					.setName(quoteFormat.controls.referencePosition.name)
					.setDesc(quoteFormat.controls.referencePosition.description)
					.setClass(this.settingClass)
					.addDropdown((dropdown) =>
						dropdown
							.addOptions(quoteFormat.controls.referencePosition.options)
							.setValue(this.plugin.settings.quote.referencePosition)
							.onChange(async (value) => {
								this.plugin.settings.quote.referencePosition =
									value as QuoteReferencePosition;
								await this.plugin.saveSettings();
							})
					);

				const includeRef = this.plugin.settings.quote.includeReference;
				if (includeRef) setting.setDisabled(false);
				else setting.setDisabled(true);
				quoteRefPositionSetting = setting;
			})
			.addSetting((setting) => {
				setting
					.setName(quoteFormat.controls.linkToPassage.name)
					.setDesc(quoteFormat.controls.linkToPassage.description)
					.setClass(this.settingClass)
					.addToggle((toggle) =>
						toggle
							.setValue(this.plugin.settings.quote.linkToPassage)
							.onChange(async (value) => {
								this.plugin.settings.quote.linkToPassage = value;
								await this.plugin.saveSettings();
							})
					);

				const includeRef = this.plugin.settings.quote.includeReference;
				if (includeRef) setting.setDisabled(false);
				else setting.setDisabled(true);
				quoteRefLinkSetting = setting;
			});

		// callout format settings ---
		new SettingGroup(containerEl)
			.setHeading(calloutFormat.name)
			.addSetting((setting) =>
				setting
					.setName(calloutFormat.controls.calloutType.name)
					.setDesc(calloutFormat.controls.calloutType.description)
					.setClass(this.settingClass)
					.addDropdown((dropdown) =>
						dropdown
							.addOptions({
								note: 'Note',
								abstract: 'Abstract',
								info: 'Info',
								todo: 'Todo',
								tip: 'Tip',
								success: 'Success',
								question: 'Question',
								warning: 'Warning',
								failure: 'Failure',
								danger: 'Danger',
								bug: 'Bug',
								example: 'Example',
								quote: 'Quote',
							})
							.setValue(this.plugin.settings.callout.type)
							.onChange(async (value) => {
								this.plugin.settings.callout.type = value as CalloutType;
								await this.plugin.saveSettings();
							})
					)
			)
			.addSetting((setting) =>
				setting
					.setName(calloutFormat.controls.linkToPassage.name)
					.setDesc(calloutFormat.controls.linkToPassage.description)
					.setClass(this.settingClass)
					.addToggle((toggle) =>
						toggle
							.setValue(this.plugin.settings.callout.linkToPassage)
							.onChange(async (value) => {
								this.plugin.settings.callout.linkToPassage = value;
								await this.plugin.saveSettings();
							})
					)
			)
			.addSetting((setting) =>
				setting
					.setName(calloutFormat.controls.collapsible.name)
					.setDesc(calloutFormat.controls.collapsible.description)
					.setClass(this.settingClass)
					.addToggle((toggle) =>
						toggle
							.setValue(this.plugin.settings.callout.collapsible)
							.onChange(async (value) => {
								this.plugin.settings.callout.collapsible = value;
								await this.plugin.saveSettings();
							})
					)
			);

		// Bible & Commentary Merger section
		let selectedBase = '';
		let selectedCommentary = '';
		let customBadge = '🕊️';

		const merger = new BibleMerger(this.app, this.plugin.settings.biblesPath);
		const availableBibles = merger.getAvailableBaseBibles();
		const availableCommentaries = merger.getAvailableCommentaries();

		if (availableBibles.length > 0) selectedBase = availableBibles[0];
		if (availableCommentaries.length > 0) selectedCommentary = availableCommentaries[0];

		const mergerGroup = new SettingGroup(containerEl).setHeading(
			'Fusionar Biblia y Comentarios / Bible & Commentary Merger'
		);

		mergerGroup.addSetting((setting) =>
			setting
				.setName('Traducción bíblica base / Base Bible')
				.setDesc('Selecciona la traducción base que se utilizará como texto canónico sin modificar.')
				.setClass(this.settingClass)
				.addDropdown((dropdown) => {
					availableBibles.forEach((b) => dropdown.addOption(b, b));
					if (selectedBase) dropdown.setValue(selectedBase);
					dropdown.onChange((val) => {
						selectedBase = val;
					});
				})
		);

		mergerGroup.addSetting((setting) =>
			setting
				.setName('Colección de comentarios / Commentary Collection')
				.setDesc('Selecciona el corpus de notas de comentario ubicado en Comentarios/.')
				.setClass(this.settingClass)
				.addDropdown((dropdown) => {
					availableCommentaries.forEach((c) => dropdown.addOption(c, c));
					if (selectedCommentary) dropdown.setValue(selectedCommentary);
					dropdown.onChange((val) => {
						selectedCommentary = val;
					});
				})
		);

		mergerGroup.addSetting((setting) =>
			setting
				.setName('Insignia / Badge Icon')
				.setDesc('Emoji o texto breve que identificará las notas en el texto bíblico (por defecto: 🕊️).')
				.setClass(this.settingClass)
				.addText((text) => {
					text.setValue(customBadge).onChange((val) => {
						customBadge = val.trim() || '🕊️';
					});
				})
		);

		mergerGroup.addSetting((setting) => {
			setting
				.setName('Iniciar fusión / Start Merge')
				.setDesc('Genera la edición de estudio derivada (ej. RVG (EGW)) en una carpeta separada sin alterar la Biblia base.')
				.setClass(this.settingClass)
				.addButton((btn) => {
					btn
						.setButtonText('Fusionar / Merge')
						.setCta()
						.onClick(async () => {
							if (!selectedBase || !selectedCommentary) {
								new Notice('Debes seleccionar una Biblia base y un comentario.');
								return;
							}
							btn.setDisabled(true);
							btn.setButtonText('Fusionando...');
							const progressNotice = new Notice('Iniciando fusión...', 0);

							try {
								const result = await merger.merge({
									baseBibleFolder: selectedBase,
									commentaryFolder: selectedCommentary,
									defaultBadge: customBadge,
									onProgress: (_curr, _total, msg) => {
										progressNotice.setMessage(msg);
									},
								});

								progressNotice.hide();

								if (result.success) {
									new Notice(
										`¡Fusión completada con éxito! Se crearon ${result.totalChaptersMerged} capítulos con ${result.totalBadgesInjected} insignias de comentarios.`,
										8000
									);
									this.display();
								} else {
									new Notice(`Error al fusionar: ${result.error}`, 8000);
								}
							} catch (err: any) {
								progressNotice.hide();
								new Notice(`Error inesperado al fusionar: ${err?.message || err}`, 8000);
							} finally {
								btn.setDisabled(false);
								btn.setButtonText('Fusionar / Merge');
							}
						});
				});
		});

		// just acts as a spacer for the issues link
		new Setting(containerEl).setHeading();

		const issuesLink = document.createElement('a');
		issuesLink.href = 'https://github.com/camelChief/local-bible-ref/issues';
		issuesLink.textContent = issues.link;

		const issuesNote = new Setting(containerEl)
			.setDesc(issues.before)
			.setHeading().descEl;
		issuesNote.append(issuesLink);
		issuesNote.append(issues.after ?? '');
	}
}

export enum BibleFormat {
	LocalBibleRef = 'localBibleRef',
	BibleLinker = 'bibleLinker',
}
