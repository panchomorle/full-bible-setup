import os
import sys
import csv
import json
import urllib.request
from collections import defaultdict
from generate_egw_notes import generate_egw_notes

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
    61: '2Pet', 62: '1John', 63: '2John', 64: '3John', 65: 'Jude',
    66: 'Rev'
}

OSIS_TO_BOOK_NAME = {BOOK_NUM_TO_OSIS[k]: BOOK_NAMES[k] for k in BOOK_NAMES}
OSIS_TO_BOOK_NAME['3Juan'] = '3 Juan'

def format_osis_ref(target_ref):
    if '-' in target_ref:
        parts = target_ref.split('-')
        p1 = parts[0].split('.')
        p2 = parts[1].split('.')
        osis = p1[0]
        full_book = OSIS_TO_BOOK_NAME.get(osis, osis)
        ch1 = p1[1] if len(p1) > 1 else ''
        v1 = p1[2] if len(p1) > 2 else ''
        ch2 = p2[1] if len(p2) > 1 else ''
        v2 = p2[2] if len(p2) > 2 else ''
        if ch1 == ch2:
            label = f"{full_book} {ch1}:{v1}-{v2}"
        else:
            label = f"{full_book} {ch1}:{v1}-{ch2}:{v2}"
        target_ch = ch1
    else:
        parts = target_ref.split('.')
        osis = parts[0]
        full_book = OSIS_TO_BOOK_NAME.get(osis, osis)
        ch = parts[1] if len(parts) > 1 else ''
        v = parts[2] if len(parts) > 2 else ''
        label = f"{full_book} {ch}:{v}" if v else f"{full_book} {ch}"
        target_ch = ch

    book_esc = full_book.replace(' ', '%20')
    link_path = f"../{book_esc}/{book_esc}%20{target_ch}.md"
    return f"[{label}]({link_path})"

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

    clean_mode = '--clean' in sys.argv
    egw_json_path = os.path.join(data_dir, 'egw_comments_cba7a.json')
    cba_egw = {}
    if not clean_mode and os.path.exists(egw_json_path):
        print(f"Cargando comentarios de EGW desde {egw_json_path}...")
        with open(egw_json_path, 'r', encoding='utf-8') as f:
            cba_egw = json.load(f)
        print(f"Cargados comentarios para {len(cba_egw)} libros bíblicos.")

        print("Sincronizando notas desacopladas de EGW en 70. Bible/Comentarios/EGW/...")
        generate_egw_notes(cba_egw)
    elif clean_mode:
        print("Modo limpio activado (--clean): generando RVG pura sin comentarios de EGW.")

    vault_bible_rvg = os.path.abspath(r'C:\Users\eljua\Documents\UAP\70. Bible\RVG')
    os.makedirs(vault_bible_rvg, exist_ok=True)
    print(f"Generando Markdown en: {vault_bible_rvg}")

    total_chapters = 0
    total_verses = 0
    total_egw_badges = 0

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
            footnote_idx = 1

            verse_lines = []
            ch_comments = cba_egw.get(book_name, {}).get(str(ch), {})

            for v_num, v_text in bible[b_num][ch]:
                total_verses += 1
                osis_key = f"{osis_code}.{ch}.{v_num}"
                ref_list = xrefs.get(osis_key, [])

                # Clean CommonMark cross-reference footnotes
                fn_tag = ""
                if ref_list:
                    fn_name = f"ref_{footnote_idx}"
                    fn_tag = f"[^{fn_name}]"
                    footnotes.append(f"[^{fn_name}]: {'; '.join(ref_list)}")
                    footnote_idx += 1

                # Match EGW commentary blocks covering this verse
                matching_anchors = []
                for range_key, items in ch_comments.items():
                    if not items:
                        continue
                    covered_verses = items[0].get('verses')
                    if not covered_verses:
                        r_start = items[0]['range'][0]
                        r_end = items[0]['range'][-1]
                        covered_verses = range(r_start, r_end + 1)
                    if v_num in covered_verses:
                        anchor = items[0].get('anchor') or f"egw-{ch}-{range_key}"
                        if anchor not in matching_anchors:
                            matching_anchors.append(anchor)

                badge_str = ""
                if matching_anchors:
                    badges = [f"[[{book_name} {ch} (EGW)#^{anc}|🕊️]]" for anc in matching_anchors]
                    badge_str = " " + " ".join(badges)
                    total_egw_badges += len(badges)

                prefix = f"**{ch}** " if v_num == 1 else ""
                verse_lines.append(f"{prefix}<sup>{v_num}</sup> {v_text}{fn_tag}{badge_str}")

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

            with open(file_path, 'w', encoding='utf-8') as out_f:
                out_f.write("\n".join(content))

    print(f"\n¡Éxito total! Se generaron {total_chapters} capítulos, {total_verses} versículos y {total_egw_badges} badges de EGW en {vault_bible_rvg}.")

if __name__ == '__main__':
    main()
