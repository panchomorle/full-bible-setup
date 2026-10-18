#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_cba7a.py
ETL pipeline to parse and normalize the Seventh-day Adventist Bible Commentary
Volume 7A (Comentario Bíblico Adventista Tomo 7A: Suplemento de Elena G. de White)
into canonical JSON format for the RVG Bible and local-bible-ref plugin.
"""

import os
import re
import json
import unicodedata
from collections import defaultdict

CANONICAL_BOOKS = {
    'GENESIS': 'Génesis', 'EXODO': 'Éxodo', 'LEVITICO': 'Levítico', 'NUMEROS': 'Números', 'DEUTERONOMIO': 'Deuteronomio',
    'JOSUE': 'Josué', 'JUECES': 'Jueces', 'RUT': 'Rut', '1 SAMUEL': '1 Samuel', '2 SAMUEL': '2 Samuel',
    '1 REYES': '1 Reyes', '2 REYES': '2 Reyes', '1 CRONICAS': '1 Crónicas', '2 CRONICAS': '2 Crónicas',
    'ESDRAS': 'Esdras', 'NEHEMIAS': 'Nehemías', 'ESTER': 'Ester', 'JOB': 'Job', 'SALMOS': 'Salmos',
    'PROVERBIOS': 'Proverbios', 'PREVERBIOS': 'Proverbios', 'ECLESIASTES': 'Eclesiastés', 'CANTARES': 'Cantares',
    'ISAIAS': 'Isaías', 'JEREMIAS': 'Jeremías', 'LAMENTACIONES': 'Lamentaciones', 'EZEQUIEL': 'Ezequiel',
    'DANIEL': 'Daniel', 'OSEAS': 'Oseas', 'JOEL': 'Joel', 'AMOS': 'Amós', 'ABDIAS': 'Abdías',
    'JONAS': 'Jonás', 'MIQUEAS': 'Miqueas', 'NAHUM': 'Nahúm', 'HABACUC': 'Habacuc', 'SOFONIAS': 'Sofonías',
    'HAGEO': 'Hageo', 'ZACARIAS': 'Zacarías', 'MALAQUIAS': 'Malaquías', 'MATEO': 'Mateo', 'MARCOS': 'Marcos',
    'LUCAS': 'Lucas', 'JUAN': 'Juan', 'HECHOS': 'Hechos', 'ROMANOS': 'Romanos', '1 CORINTIOS': '1 Corintios',
    '2 CORINTIOS': '2 Corintios', 'GALATAS': 'Gálatas', 'EFESIOS': 'Efesios', 'FILIPENSES': 'Filipenses',
    'COLOSENSES': 'Colosenses', '1 TESALONICENSES': '1 Tesalonicenses', '2 TESALONICENSES': '2 Tesalonicenses',
    '1 TIMOTEO': '1 Timoteo', '2 TIMOTEO': '2 Timoteo', 'TITO': 'Tito', 'FILEMON': 'Filemón', 'HEBREOS': 'Hebreos',
    'SANTIAGO': 'Santiago', '1 PEDRO': '1 Pedro', '2 PEDRO': '2 Pedro', '1 JUAN': '1 Juan', '2 JUAN': '2 Juan',
    '3 JUAN': '3 Juan', 'JUDAS': 'Judas', 'APOCALIPSIS': 'Apocalipsis'
}

ABBREVIATIONS = {
    'PP': 'Patriarcas y Profetas',
    'PR': 'Profetas y Reyes',
    'DTG': 'El Deseado de Todas las Gentes',
    'HAp': 'Los Hechos de los Apóstoles',
    'CS': 'El Conflicto de los Siglos',
    'CC': 'El Camino a Cristo',
    'DMJ': 'El Discurso Maestro de Jesucristo',
    'PVGM': 'Palabras de Vida del Gran Maestro',
    'Ed': 'La Educación',
    'MC': 'El Ministerio de Curación',
    '1JT': 'Joyas de los Testimonios, tomo 1',
    '2JT': 'Joyas de los Testimonios, tomo 2',
    '3JT': 'Joyas de los Testimonios, tomo 3',
    '1TS': 'Testimonios Selectos, tomo 1',
    '2TS': 'Testimonios Selectos, tomo 2',
    '3TS': 'Testimonios Selectos, tomo 3',
    '4TS': 'Testimonios Selectos, tomo 4',
    '5TS': 'Testimonios Selectos, tomo 5',
    '1T': 'Testimonies for the Church, tomo 1',
    '2T': 'Testimonies for the Church, tomo 2',
    '3T': 'Testimonies for the Church, tomo 3',
    '4T': 'Testimonies for the Church, tomo 4',
    '5T': 'Testimonies for the Church, tomo 5',
    '6T': 'Testimonies for the Church, tomo 6',
    '7T': 'Testimonies for the Church, tomo 7',
    '8T': 'Testimonies for the Church, tomo 8',
    '9T': 'Testimonies for the Church, tomo 9',
    '1SG': 'Spiritual Gifts, tomo 1',
    '2SG': 'Spiritual Gifts, tomo 2',
    '3SG': 'Spiritual Gifts, tomo 3',
    '4SG': 'Spiritual Gifts, tomo 4',
    '1SP': 'Spirit of Prophecy, tomo 1',
    '2SP': 'Spirit of Prophecy, tomo 2',
    '3SP': 'Spirit of Prophecy, tomo 3',
    '4SP': 'Spirit of Prophecy, tomo 4',
    'RH': 'Review and Herald',
    'ST': 'Signs of the Times',
    'MS': 'Manuscrito',
    'Carta': 'Carta',
    'TM': 'Testimonios para los Ministros',
    'OE': 'Obreros Evangélicos',
    'PE': 'Primeros Escritos',
    'CN': 'Conducción del Niño',
    'CRA': 'Consejos sobre el Régimen Alimenticio',
    'CMC': 'Consejos sobre Mayordomía Cristiana',
    'COES': 'Consejos sobre la Obra de la Escuela Sabática',
    'CM': 'Consejos para Maestros',
    'MB': 'El Ministerio de la Bondad',
    'MJ': 'Mensajes para los Jóvenes',
    'Te': 'La Temperancia',
    'Ev': 'Evangelismo',
    'HAd': 'El Hogar Adventista',
    'MeM': 'Meditaciones Matinales',
    'CTBH': 'Christian Temperance and Bible Hygiene',
    'FE': 'Fundamentals of Christian Education',
    'CH': 'Counsels on Health',
    'CW': 'Counsels to Writers and Editors',
    'MM': 'Medical Ministry',
    'NL': 'Notebook Leaflets',
    'SpT': 'Special Testimonies',
    'SR': 'Story of Redemption'
}

def norm_str(s):
    n = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').upper().strip(' .\t\r\n')
    return re.sub(r'\s+', ' ', n)

def expand_source(raw_source):
    src = raw_source.strip('(). ')
    # check prefix abbreviation
    for abbr, full_title in ABBREVIATIONS.items():
        if src.startswith(abbr + ' ') or src.startswith(abbr + ','):
            remainder = src[len(abbr):].strip(' ,')
            if remainder.isdigit():
                return f"{full_title}, p. {remainder}"
            return f"{full_title}, {remainder}"
        elif src == abbr:
            return full_title
    return src

def clean_comment_text(lines):
    raw = ' '.join(' '.join(lines).split())
    # Remove stand-alone page numbers like ' 14 ' or ' 435 '
    cleaned = re.sub(r'\s+\d{1,4}\s+', ' ', raw)
    # Extract source citation at end: (Carta 131, 1897). or (RH 11-2 -1902).
    m_src = re.search(r'\(([^)]+)\)\.?\s*$', cleaned)
    if m_src:
        inside = m_src.group(1).strip()
        # verify if inside looks like a citation
        if any(k in inside for k in ['Carta', 'MS', 'RH', 'SG', 'SP', 'JT', 'TS', 'T', 'DTG', 'PP', 'PR', 'CS', 'Ed', 'MC', 'CC', 'CTBH', 's/f', '18', '19']):
            source = expand_source(inside)
            body = cleaned[:m_src.start()].strip()
            return body, source
    # If no citation found or is a cross-reference
    if 'Ver EGW com' in cleaned or 'Ver el comentario' in cleaned:
        return cleaned, 'CBA Tomo 7A'
    return cleaned, 'CBA Tomo 7A'

def parse_cba7a(raw_file_path):
    with open(raw_file_path, 'r', encoding='utf-8') as f:
        raw_lines = [l.strip() for l in f.readlines()]

    filtered = [l for l in raw_lines if not l.startswith('=== PAGE')]

    # Pre-process lines to join multi-line verse headers with unclosed parentheses
    lines = []
    i = 0
    while i < len(filtered):
        line = filtered[i]
        # Check if line starts with a verse number or secondary ref and has unclosed (
        if (re.match(r'^\d+.*\(', line) or line.startswith('(')) and line.count('(') > line.count(')'):
            joined = line
            lookahead = 0
            while i + 1 < len(filtered) and joined.count('(') > joined.count(')') and lookahead < 2:
                next_cand = filtered[i + 1]
                if next_cand.endswith('.-') or re.match(r'^(?:CAP[IÍ]TULO|Cap[ií]tulo)', next_cand):
                    break
                i += 1
                lookahead += 1
                joined += ' ' + filtered[i]
            lines.append(joined)
        else:
            lines.append(line)
        i += 1

    # 1. Identify book boundaries
    book_spans = []
    for i, l in enumerate(lines):
        n = norm_str(l)
        if n in CANONICAL_BOOKS:
            next_l = ''
            for k in range(i + 1, min(i + 5, len(lines))):
                cand = lines[k]
                if cand and not re.match(r'^\d+$', cand):
                    next_l = cand
                    break
            next_n = norm_str(next_l)
            if next_n not in CANONICAL_BOOKS and next_l:
                book_spans.append((i, CANONICAL_BOOKS[n]))

    print(f"Detected {len(book_spans)} canonical book sections.")

    dataset = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    total_comments_parsed = 0

    for idx, (start_line, book_name) in enumerate(book_spans):
        end_line = book_spans[idx + 1][0] if idx + 1 < len(book_spans) else len(lines)
        book_lines = lines[start_line + 1:end_line]

        curr_chapter = 1
        curr_verses = [1]
        curr_title = ''
        curr_text = []

        def flush_comment(ch, verses, title, text_lines):
            nonlocal total_comments_parsed
            if not text_lines:
                return
            body, source = clean_comment_text(text_lines)
            if not body or len(body.strip()) <= 5:
                return

            clean_title = title.rstrip('.- ').strip()
            entry = {
                'source': source,
                'text': body
            }
            if clean_title:
                entry['title'] = clean_title

            for v in verses:
                dataset[book_name][str(ch)][str(v)].append(entry)
            total_comments_parsed += 1

        for l in book_lines:
            if not l:
                continue

            # Check chapter header
            m_ch = re.match(r'^(?:CAP[IÍ]TULO|Cap[ií]tulo)S?\s+(\d+)', l)
            if m_ch:
                flush_comment(curr_chapter, curr_verses, curr_title, curr_text)
                curr_chapter = int(m_ch.group(1))
                curr_verses = [1]
                curr_title = ''
                curr_text = []
                continue

            # Check verse header (e.g. 1-3., 26 (Efe. 3: 15)., 27., 16, 17.)
            m_v = re.match(r'^(\d+(?:\s*[-–—,]\s*\d+)*)\s*(?:\([^)]*\))?\.?\s*$', l)
            if m_v:
                flush_comment(curr_chapter, curr_verses, curr_title, curr_text)
                curr_title = ''
                curr_text = []
                raw_v = m_v.group(1)
                v_list = []
                for part in raw_v.split(','):
                    part = part.strip()
                    if '-' in part:
                        p_parts = part.split('-')
                        if len(p_parts) == 2 and p_parts[0].isdigit() and p_parts[1].isdigit():
                            v_list.extend(range(int(p_parts[0]), int(p_parts[1]) + 1))
                    elif part.isdigit():
                        v_list.append(int(part))
                curr_verses = v_list if v_list else [1]
                continue

            # Check title line ending with '.-'
            if l.endswith('.-') and len(l) < 120:
                if curr_text:
                    flush_comment(curr_chapter, curr_verses, curr_title, curr_text)
                    curr_text = []
                curr_title = l
                continue

            # Check secondary scripture reference before title, e.g. (2 Ped. 1: 4).
            if l.startswith('(') and (l.endswith(').') or l.endswith(')')) and len(l) < 60:
                continue

            curr_text.append(l)

        flush_comment(curr_chapter, curr_verses, curr_title, curr_text)

    return dataset, total_comments_parsed

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    raw_path = os.path.join(base_dir, 'data', 'raw_cba7a_text.txt')
    out_path = os.path.join(base_dir, 'data', 'egw_comments_cba7a.json')

    print(f"Parsing raw CBA Tomo 7A text from: {raw_path}")
    dataset, total_comments = parse_cba7a(raw_path)

    # Convert to standard dict for clean json serialization
    json_data = {}
    total_books = len(dataset)
    total_chapters = 0
    total_verses = 0

    for book, chapters in dataset.items():
        json_data[book] = {}
        for ch, verses in chapters.items():
            total_chapters += 1
            json_data[book][ch] = {}
            for v, comments in verses.items():
                total_verses += 1
                json_data[book][ch][v] = comments

    print(f"\nExtraction summary:")
    print(f"- Books parsed: {total_books}")
    print(f"- Chapters with comments: {total_chapters}")
    print(f"- Verses indexed: {total_verses}")
    print(f"- Total comment blocks: {total_comments}")

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)

    print(f"Successfully generated normalized dataset at: {out_path}")

if __name__ == '__main__':
    main()
