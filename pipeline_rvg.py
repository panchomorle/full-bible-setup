import os
import csv
import json
import urllib.request
from collections import defaultdict

BOOK_NAMES = {
    1: 'Génesis', 2: 'Éxodo', 3: 'Levítico', 4: 'Números', 5: 'Deuteronomio',
    6: 'Josué', 7: 'Jueces', 8: 'Rut', 9: '1 Samuel', 10: '2 Samuel',
    11: '1 Reyes', 12: '2 Reyes', 13: '1 Crónicas', 14: '2 Crónicas',
    15: 'Esdras', 16: 'Nehemías', 17: 'Ester', 18: 'Job', 19: 'Salmos',
    20: 'Proverbios', 21: 'Eclesiastés', 22: 'Cantares', 23: 'Isaías',
    24: 'Jeremías', 25: 'Lamentaciones', 26: 'Ezequiel', 27: 'Daniel',
    28: 'Oseas', 29: 'Joel', 30: 'Amós', 31: 'Abdías', 32: 'Jonás',
    33: 'Miqueas', 34: 'Nahúm', 35: 'Habacuc', 36: 'Sofonías', 37: 'Hageo',
    38: 'Zacarías', 39: 'Malaquías', 40: 'Mateo', 41: 'Marcos', 42: 'Lucas',
    43: 'Juan', 44: 'Hechos', 45: 'Romanos', 46: '1 Corintios', 47: '2 Corintios',
    48: 'Gálatas', 49: 'Efesios', 50: 'Filipenses', 51: 'Colosenses',
    52: '1 Tesalonicenses', 53: '2 Tesalonicenses', 54: '1 Timoteo',
    55: '2 Timoteo', 56: 'Tito', 57: 'Filemón', 58: 'Hebreos', 59: 'Santiago',
    60: '1 Pedro', 61: '2 Pedro', 62: '1 Juan', 63: '2 Juan', 64: '3 Juan',
    65: 'Judas', 66: 'Apocalipsis'
}

OSIS_TO_SPANISH = {
    'Gen': 'Gn', 'Exod': 'Ex', 'Lev': 'Lv', 'Num': 'Nm', 'Deut': 'Dt',
    'Josh': 'Jos', 'Judg': 'Jue', 'Ruth': 'Rut', '1Sam': '1S', '2Sam': '2S',
    '1Kgs': '1R', '2Kgs': '2R', '1Chr': '1Cr', '2Chr': '2Cr', 'Ezra': 'Esd',
    'Neh': 'Neh', 'Esth': 'Est', 'Job': 'Job', 'Ps': 'Sal', 'Prov': 'Pr',
    'Eccl': 'Ecl', 'Song': 'Cnt', 'Isa': 'Is', 'Jer': 'Jer', 'Lam': 'Lm',
    'Ezek': 'Ez', 'Dan': 'Dn', 'Hos': 'Os', 'Joel': 'Jl', 'Amos': 'Am',
    'Obad': 'Abd', 'Jonah': 'Jon', 'Mic': 'Miq', 'Nah': 'Nah', 'Hab': 'Hab',
    'Zeph': 'Sof', 'Hag': 'Hag', 'Zech': 'Zac', 'Mal': 'Mal', 'Matt': 'Mt',
    'Mark': 'Mr', 'Luke': 'Lc', 'John': 'Jn', 'Acts': 'Hch', 'Rom': 'Ro',
    '1Cor': '1Co', '2Cor': '2Co', 'Gal': 'Gál', 'Eph': 'Ef', 'Phil': 'Fil',
    'Col': 'Col', '1Thess': '1Ts', '2Thess': '2Ts', '1Tim': '1Tm', '2Tim': '2Tm',
    'Titus': 'Tit', 'Phlm': 'Flm', 'Heb': 'Heb', 'Jas': 'Stg', '1Pet': '1P',
    '2Pet': '2P', '1John': '1Jn', '2John': '2Jn', '3John': '3Jn', 'Jude': 'Jud',
    'Rev': 'Apoc'
}

BOOK_NUM_TO_OSIS = {
    1: 'Gen', 2: 'Exod', 3: 'Lev', 4: 'Num', 5: 'Deut',
    6: 'Josh', 7: 'Judg', 8: 'Ruth', 9: '1Sam', 10: '2Sam',
    11: '1Kgs', 12: '2Kgs', 13: '1Chr', 14: '2Chr', 15: 'Ezra',
    16: 'Neh', 17: 'Esth', 18: 'Job', 19: 'Ps', 20: 'Prov',
    21: 'Eccl', 22: 'Song', 23: 'Isa', 24: 'Jer', 25: 'Lam',
    26: 'Ezek', 27: 'Dan', 28: 'Hos', 29: 'Joel', 30: 'Amos',
    31: 'Obad', 32: 'Jonah', 33: 'Mic', 34: 'Nah', 35: 'Hab',
    36: 'Zeph', 37: 'Hag', 38: 'Zech', 39: 'Mal', 40: 'Matt',
    41: 'Mark', 42: 'Luke', 43: 'John', 44: 'Acts', 45: 'Rom',
    46: '1Cor', 47: '2Cor', 48: 'Gal', 49: 'Eph', 50: 'Phil',
    51: 'Col', 52: '1Thess', 53: '2Thess', 54: '1Tim', 55: '2Tim',
    56: 'Titus', 57: 'Phlm', 58: 'Heb', 59: 'Jas', 60: '1Pet',
    61: '2Pet', 62: '1John', 63: '2John', 64: '3Juan', 65: 'Jude',
    66: 'Rev'
}

# Curated foundational EGW Bible comments
EGW_COMMENTS = {
    ('Génesis', 1, 1): (
        "La obra de la creación no puede ser explicada por la ciencia. ¿Qué ciencia puede explicar el misterio del origen de la vida? "
        "En la creación de la tierra, Dios no dependió de materia preexistente. 'Él dijo, y fue hecho; Él mandó, y existió' (Salmos 33:9). "
        "Todas las cosas, materiales y espirituales, comparecieron ante el Señor Jehová a su propia voz y fueron creadas para su propio propósito. "
        "— *Patriarcas y Profetas*, p. 115."
    ),
    ('Génesis', 1, 26): (
        "El hombre fue hecho a la imagen de Dios, tanto en su naturaleza exterior como en su carácter espiritual. "
        "Solamente Cristo es 'la imagen misma de su sustancia'; pero el hombre fue formado a semejanza de Dios. Su naturaleza estaba en armonía con la voluntad divina, "
        "su mente era capaz de comprender las cosas divinas y sus afectos eran puros. "
        "— *Patriarcas y Profetas*, p. 25."
    ),
    ('Génesis', 2, 2): (
        "Dios descansó en el séptimo día, y santificó y bendijo el día de su reposo, para que el hombre, a semejanza de su Hacedor, descansase en este día sagrado, "
        "y mirando al cielo y a la tierra pudiera reflexionar sobre la gran obra de la creación de Dios. "
        "— *Comentario Bíblico Adventista*, tomo 1, p. 1094."
    ),
    ('Génesis', 3, 15): (
        "Esta primera promesa evangélica fue un rayo de luz en medio de la densa oscuridad del pecado. "
        "La enemistad de la cual habla la profecía no es natural entre Satanás y el hombre. Cuando el hombre violó la ley divina, su naturaleza se hizo depravada y estuvo en armonía con Satanás. "
        "La gracia que Cristo infunde en el alma es la que crea la enemistad contra el pecado. "
        "— *El Conflicto de los Siglos*, p. 559."
    ),
    ('Éxodo', 20, 8): (
        "El sábado no fue dado solamente para Israel, sino para el mundo entero. Había sido dado a conocer al hombre en el Edén, "
        "y como los demás preceptos del Decálogo, es de obligación inmutable... En el sábado se nos presenta el Creador de los cielos y de la tierra, "
        "distinguiéndose así del Dios verdadero de todos los dioses falsos. "
        "— *Deseado de Todas las Gentes*, p. 248."
    ),
    ('Daniel', 8, 14): (
        "La purificación del santuario terrenal se realizaba con sangre de animales; pero la del celestial debe realizarse con la sangre de Cristo. "
        "Así como en el día de la expiación típico los pecados del pueblo eran borrados del santuario terrenal, así en el gran día final los pecados de los penitentes son borrados del santuario celestial. "
        "Este juicio investigador comenzó en 1844 al cumplirse las 2.300 tardes y mañanas. "
        "— *El Conflicto de los Siglos*, pp. 473-475."
    ),
    ('Juan', 1, 1): (
        "Desde la eternidad había una perfecta unidad entre el Padre y el Hijo. Eran dos, pero poco menos que idénticos; uno en espíritu, en corazón, en carácter. "
        "Cristo era el Verbo de Dios: el pensamiento de Dios hecho audible. "
        "— *El Deseado de Todas las Gentes*, p. 11."
    ),
    ('Juan', 3, 16): (
        "Toda la ley y los profetas se concentran en el amor inmenso de Dios manifestado en Cristo. La cruz del Calvario permanecerá por la eternidad como el monumento del amor inagotable del Padre. "
        "El don de Cristo al mundo no fue una provisión posterior al pecado; fue el plan eterno puesto en acción para la redención de la raza humana. "
        "En este don incomparable, el cielo entregó todo su tesoro. "
        "— *El Camino a Cristo*, p. 13; *El Deseado de Todas las Gentes*, p. 15."
    ),
    ('Romanos', 8, 28): (
        "El Padre celestial tiene mil maneras de proveer para nosotros de las cuales nada sabemos. "
        "Los que aceptan el principio de dar al servicio de Dios el lugar supremo, verán desaparecer sus perplejidades y hallarán un camino despejado ante sus pies. "
        "— *El Ministerio de Curación*, p. 381."
    ),
    ('Apocalipsis', 14, 6): (
        "Los mensajes de los tres ángeles de Apocalipsis 14 representan el carácter de la obra que ha de ser hecha antes de la venida de Cristo. "
        "El primer mensaje proclama el juicio de Dios e invita a la reverencia y a la adoración al Creador del cielo y de la tierra. Es la verdad presente para este tiempo final. "
        "— *Joyas de los Testimonios*, tomo 3, p. 165."
    ),
    ('Apocalipsis', 14, 12): (
        "Aquí está la paciencia de los santos; aquí están los que guardan los mandamientos de Dios y la fe de Jesús. "
        "Este texto define al remanente fiel en el conflicto final sobre la adoración y la ley de Dios. Guardar la ley de Dios y tener la fe viva de Jesús es el secreto de la victoria. "
        "— *El Conflicto de los Siglos*, p. 490."
    )
}

def format_osis_ref(target_ref):
    if '-' in target_ref:
        parts = target_ref.split('-')
        p1 = parts[0].split('.')
        p2 = parts[1].split('.')
        b1 = OSIS_TO_SPANISH.get(p1[0], p1[0])
        ch1 = p1[1] if len(p1) > 1 else ''
        v1 = p1[2] if len(p1) > 2 else ''
        ch2 = p2[1] if len(p2) > 1 else ''
        v2 = p2[2] if len(p2) > 2 else ''
        if ch1 == ch2:
            return f"{b1} {ch1}:{v1}-{v2}"
        return f"{b1} {ch1}:{v1}-{ch2}:{v2}"
    else:
        parts = target_ref.split('.')
        b = OSIS_TO_SPANISH.get(parts[0], parts[0])
        ch = parts[1] if len(parts) > 1 else ''
        v = parts[2] if len(parts) > 2 else ''
        return f"{b} {ch}:{v}" if v else f"{b} {ch}"

def main():
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(data_dir, exist_ok=True)

    csv_path = os.path.join(data_dir, 'super_bible_RVG.csv')
    xref_path = os.path.join(data_dir, 'cross_references.txt')

    print("Indexando referencias cruzadas...")
    xrefs = defaultdict(list)
    with open(xref_path, 'r', encoding='utf-8') as f:
        f.readline()
        for line in f:
            parts = line.strip().split('\t')
            if len(parts) >= 2:
                from_v = parts[0]
                to_v = parts[1]
                if len(xrefs[from_v]) < 4:
                    xrefs[from_v].append(format_osis_ref(to_v))

    print("Cargando texto bíblico RVG 2010 en UTF-8 nativo...")
    bible = defaultdict(lambda: defaultdict(list))
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            b_num = int(row['book'])
            ch = int(row['chapter'])
            v = int(row['verse'])
            txt = row['text'].strip()
            bible[b_num][ch].append((v, txt))

    egw_json_path = os.path.join(data_dir, 'egw_comments_cba7a.json')
    cba_egw = {}
    if os.path.exists(egw_json_path):
        print(f"Cargando comentarios de EGW desde {egw_json_path}...")
        with open(egw_json_path, 'r', encoding='utf-8') as f:
            cba_egw = json.load(f)
        print(f"Cargados comentarios para {len(cba_egw)} libros bíblicos.")

    vault_bible_rvg = os.path.abspath(r'C:\Users\eljua\Documents\UAP\70. Bible\RVG')
    os.makedirs(vault_bible_rvg, exist_ok=True)
    print(f"Generando Markdown en: {vault_bible_rvg}")

    total_chapters = 0
    total_verses = 0
    total_egw_callouts = 0

    for b_num in range(1, 67):
        book_name = BOOK_NAMES[b_num]
        osis_code = BOOK_NUM_TO_OSIS[b_num]
        book_dir = os.path.join(vault_bible_rvg, book_name)
        os.makedirs(book_dir, exist_ok=True)

        chapters = sorted(bible[b_num].keys())
        max_ch = max(chapters) if chapters else 0

        book_esc = book_name.replace(' ', '%20')

        for ch in chapters:
            total_chapters += 1
            filename = f"{book_name} {ch}.md"
            file_path = os.path.join(book_dir, filename)

            nav_lines = []
            if ch > 1:
                nav_lines.append(f"- [Anterior](../{book_esc}/{book_esc}%20{ch-1}.md)")
            if ch < max_ch:
                nav_lines.append(f"- [Siguiente](../{book_esc}/{book_esc}%20{ch+1}.md)")

            footnotes = []
            egw_callouts = []
            footnote_idx = 1

            verse_lines = []
            for v_num, v_text in bible[b_num][ch]:
                total_verses += 1
                osis_key = f"{osis_code}.{ch}.{v_num}"
                ref_list = xrefs.get(osis_key, [])
                egw_items = cba_egw.get(book_name, {}).get(str(ch), {}).get(str(v_num), [])
                if not egw_items and (book_name, ch, v_num) in EGW_COMMENTS:
                    egw_items = [{'text': EGW_COMMENTS[(book_name, ch, v_num)], 'source': '', 'title': None}]

                fn_tag = ""
                if ref_list or egw_items:
                    fn_name = f"ref_{footnote_idx}"
                    fn_tag = f" [^{fn_name}]"
                    fn_content = []
                    if ref_list:
                        fn_content.append(f"Véase {'; '.join(ref_list)}")
                    if egw_items:
                        fn_content.append(f"[Comentario de EGW](#^egw-{ch}-{v_num})")
                        callout_lines = [
                            f"> [!quote]- Comentario de Elena G. de White — {book_name} {ch}:{v_num} ^egw-{ch}-{v_num}"
                        ]
                        for idx_c, comm in enumerate(egw_items):
                            if idx_c > 0:
                                callout_lines.append(">")
                                callout_lines.append("> ***")
                                callout_lines.append(">")
                            title = comm.get('title')
                            source = comm.get('source')
                            text = comm.get('text', '').strip()
                            if title:
                                callout_lines.append(f"> ### {title}")
                            callout_lines.append(f"> {text}")
                            if source and source != 'CBA Tomo 7A':
                                callout_lines.append(f"> — *{source}*.")
                        egw_callouts.append("\n".join(callout_lines))
                        total_egw_callouts += 1

                    footnotes.append(f"[^{fn_name}]: {'. '.join(fn_content)}.")
                    footnote_idx += 1

                prefix = f"**{ch}** " if v_num == 1 else ""
                verse_lines.append(f"{prefix}<sup>{v_num}</sup> {v_text}{fn_tag}")

            # Group verses into readable paragraphs
            paragraphs = []
            curr_p = []
            for i, line in enumerate(verse_lines):
                curr_p.append(line)
                if len(curr_p) >= 4 or i == len(verse_lines) - 1:
                    paragraphs.append(" ".join(curr_p))
                    curr_p = []

            body_text = "\n\n".join(paragraphs)

            content = [
                "---",
                "version: RVG",
                f"book: {book_name}",
                f"chapter: {ch}",
                "---",
                "",
                f"# {book_name} {ch}",
                "",
                body_text,
                "",
                "---",
                ""
            ]

            if nav_lines:
                content.extend(nav_lines)
                content.append("")

            if footnotes:
                content.extend(footnotes)
                content.append("")

            if egw_callouts:
                content.append("## Comentarios de Elena G. de White")
                content.append("")
                content.extend(egw_callouts)
                content.append("")

            with open(file_path, 'w', encoding='utf-8') as out_f:
                out_f.write("\n".join(content))

    print(f"\n¡Éxito total! Se generaron {total_chapters} capítulos, {total_verses} versículos y {total_egw_callouts} callouts de EGW en {vault_bible_rvg}.")

if __name__ == '__main__':
    main()
