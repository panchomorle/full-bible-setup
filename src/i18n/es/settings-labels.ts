import { PassageFormat } from 'src/passage-reference';
import { SettingsLabels } from '../models';
import { QuoteReferencePosition } from 'src/settings';

export const SETTINGS_LABELS: SettingsLabels = {
	required: {
		name: 'Requerido',
		controls: {
			biblesPath: {
				name: 'Ruta de las biblias',
				description: 'La ruta a la carpeta del vault que contiene tus biblias.',
				placeholder: 'ej. 70. Bible',
			},
		},
	},

	optional: {
		name: 'Opcional',
		controls: {
			defaultVersion: {
				name: 'Versión por defecto',
				description:
					'La versión a usar por defecto (abreviatura). Debe corresponder a una carpeta dentro de la ruta de biblias.',
				placeholder: 'ej. WEBP o RVG',
			},
			defaultPassageFormat: {
				name: 'Formato de pasaje por defecto',
				description: 'El formato markdown a utilizar por defecto para los pasajes.',
				options: {
					[PassageFormat.Manuscript]: 'Manuscrito',
					[PassageFormat.Paragraph]: 'Párrafo',
					[PassageFormat.Quote]: 'Cita (Quote)',
					[PassageFormat.Callout]: 'Callout',
				},
			},
			bibleFormat: {
				name: 'Formato de biblia',
				description:
					'El estilo de formato utilizado en tus biblias locales. Local Bible Ref lo utiliza para parsear los versículos correctamente.',
			},
			fullPreview: {
				name: 'Vista previa completa del pasaje',
				description:
					'Si se debe mostrar el pasaje completo en la vista previa o sólo un extracto breve.',
			},
		},
	},

	quoteFormat: {
		name: 'Formato de Cita (Quote)',
		controls: {
			includeReference: {
				name: 'Incluir referencia',
				description: 'Indica si se incluye la referencia al pasaje.',
			},
			referencePosition: {
				name: 'Posición de la referencia',
				description:
					'La posición de la referencia en relación al texto citado.',
				options: {
					[QuoteReferencePosition.Beginning]: 'Al principio',
					[QuoteReferencePosition.End]: 'Al final',
				},
			},
			linkToPassage: {
				name: 'Enlazar al pasaje',
				description:
					'Si se debe crear un enlace al archivo del pasaje en tu vault.',
			},
		},
	},

	calloutFormat: {
		name: 'Formato de Callout',
		controls: {
			calloutType: {
				name: 'Tipo de callout',
				description: 'El tipo de callout (quote, info, note, etc.) a utilizar.',
			},
			linkToPassage: {
				name: 'Enlazar al pasaje',
				description:
					'Si se debe crear un enlace al archivo del pasaje en tu vault.',
			},
			collapsible: {
				name: 'Colapsable',
				description:
					'Indica si el callout del pasaje debe ser colapsable.',
			},
		},
	},

	issues: {
		before:
			'Si encontrás algún problema con Local Bible Ref o tenés sugerencias, por favor ',
		link: 'abrí un issue en GitHub',
		after: '.',
	},
};
