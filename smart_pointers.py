#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
smart_pointers.py
Transforms raw cross-reference pointers in Ellen G. White Bible commentary notes
(e.g., "Ver EGW com. cap.: 1-3; Juan 1: 1-3,14; Col.2: 9.") into intelligent Obsidian wikilinks
targeting exact atomic block anchors in 70. Bible/Comentarios/EGW/.
"""

import re
import unicodedata

BOOK_MAP = {
    'GEN': 'Génesis', 'GÉNESIS': 'Génesis', 'GENESIS': 'Génesis', 'GÉN': 'Génesis',
    'EXO': 'Éxodo', 'ÉXODO': 'Éxodo', 'EXODO': 'Éxodo', 'ÉXO': 'Éxodo',
    'LEV': 'Levítico', 'LEVÍTICO': 'Levítico', 'LEVITICO': 'Levítico',
    'NUM': 'Números', 'NÚMEROS': 'Números', 'NUMEROS': 'Números', 'NÚM': 'Números',
    'DEUT': 'Deuteronomio', 'DEUTERONOMIO': 'Deuteronomio',
    'JOS': 'Josué', 'JOSUÉ': 'Josué', 'JOSUE': 'Josué',
    'JUEC': 'Jueces', 'JUE': 'Jueces', 'JUECES': 'Jueces',
    'RUT': 'Rut',
    '1 SAM': '1 Samuel', '1 SAMUEL': '1 Samuel', '1 S': '1 Samuel',
    '2 SAM': '2 Samuel', '2 SAMUEL': '2 Samuel', '2 S': '2 Samuel',
    '1 REY': '1 Reyes', '1 REYES': '1 Reyes', '1 R': '1 Reyes',
    '2 REY': '2 Reyes', '2 REYES': '2 Reyes', '2 R': '2 Reyes',
    '1 CRON': '1 Crónicas', '1 CRÓN': '1 Crónicas', '1 CRÓNICAS': '1 Crónicas', '1 CRONICAS': '1 Crónicas',
    '1 CR': '1 Crónicas', 'I CRON': '1 Crónicas', 'I CRÓN': '1 Crónicas', 'I CR': '1 Crónicas',
    '2 CRON': '2 Crónicas', '2 CRÓN': '2 Crónicas', '2 CRÓNICAS': '2 Crónicas', '2 CRONICAS': '2 Crónicas',
    '2 CR': '2 Crónicas', 'II CRON': '2 Crónicas', 'II CRÓN': '2 Crónicas',
    'ESD': 'Esdras', 'ESDRAS': 'Esdras',
    'NEH': 'Nehemías', 'NEHEMÍAS': 'Nehemías', 'NEHEMIAS': 'Nehemías',
    'EST': 'Ester', 'ESTER': 'Ester',
    'JOB': 'Job',
    'SAL': 'Salmos', 'SALMOS': 'Salmos',
    'PROV': 'Proverbios', 'PROVERBIOS': 'Proverbios',
    'ECL': 'Eclesiastés', 'ECLESIASTÉS': 'Eclesiastés', 'ECLESIASTES': 'Eclesiastés',
    'CANT': 'Cantares', 'CANTARES': 'Cantares',
    'ISA': 'Isaías', 'ISAÍAS': 'Isaías', 'ISAIAS': 'Isaías',
    'JER': 'Jeremías', 'JEREMÍAS': 'Jeremías', 'JEREMIAS': 'Jeremías',
    'LAM': 'Lamentaciones', 'LAMENTACIONES': 'Lamentaciones',
    'EZE': 'Ezequiel', 'EZEQUIEL': 'Ezequiel',
    'DAN': 'Daniel', 'DANIEL': 'Daniel',
    'OS': 'Oseas', 'OSEAS': 'Oseas',
    'JOEL': 'Joel',
    'AMOS': 'Amós', 'AMÓS': 'Amós',
    'ABD': 'Abdías', 'ABDÍAS': 'Abdías', 'ABDIAS': 'Abdías',
    'JON': 'Jonás', 'JONÁS': 'Jonás', 'JONAS': 'Jonás',
    'MIQ': 'Miqueas', 'MIQUEAS': 'Miqueas',
    'NAH': 'Nahúm', 'NAHÚM': 'Nahúm', 'NAHUM': 'Nahúm',
    'HAB': 'Habacuc', 'HABACUC': 'Habacuc',
    'SOF': 'Sofonías', 'SOFONÍAS': 'Sofonías', 'SOFONIAS': 'Sofonías',
    'HAG': 'Hageo', 'HAGEO': 'Hageo',
    'ZAC': 'Zacarías', 'ZACARÍAS': 'Zacarías', 'ZACARIAS': 'Zacarías',
    'MAL': 'Malaquías', 'MALAQUÍAS': 'Malaquías', 'MALAQUIAS': 'Malaquías',
    'MAT': 'Mateo', 'MATEO': 'Mateo',
    'MAR': 'Marcos', 'MARCOS': 'Marcos',
    'LUC': 'Lucas', 'LUCE': 'Lucas', 'LUCAS': 'Lucas',
    'JUAN': 'Juan', 'JN': 'Juan',
    'HECH': 'Hechos', 'HECHOS': 'Hechos',
    'ROM': 'Romanos', 'ROMANOS': 'Romanos',
    '1 COR': '1 Corintios', '1 CORINTIOS': '1 Corintios',
    '2 COR': '2 Corintios', '2 CORINTIOS': '2 Corintios',
    'GAL': 'Gálatas', 'GÁL': 'Gálatas', 'GÁLATAS': 'Gálatas', 'GALATAS': 'Gálatas',
    'EFE': 'Efesios', 'EFESIOS': 'Efesios',
    'FIL': 'Filipenses', 'FILIPENSES': 'Filipenses',
    'COL': 'Colosenses', 'COLOSENSES': 'Colosenses',
    '1 TES': '1 Tesalonicenses', '1 TESALONICENSES': '1 Tesalonicenses',
    '2 TES': '2 Tesalonicenses', '2 TESALONICENSES': '2 Tesalonicenses',
    '1 TIM': '1 Timoteo', '1 TIMOTEO': '1 Timoteo',
    '2 TIM': '2 Timoteo', '2 TIMOTEO': '2 Timoteo',
    'TITO': 'Tito',
    'FILEM': 'Filemón', 'FILEMÓN': 'Filemón', 'FILEMON': 'Filemón',
    'HEB': 'Hebreos', 'HEBREOS': 'Hebreos',
    'SANT': 'Santiago', 'SANTIAGO': 'Santiago',
    '1 PED': '1 Pedro', '1 PEDRO': '1 Pedro',
    '2 PED': '2 Pedro', '2 PEDRO': '2 Pedro',
    '1 JUAN': '1 Juan', '1 JN': '1 Juan',
    '2 JUAN': '2 Juan',
    '3 JUAN': '3 Juan',
    'JUD': 'Judas', 'JUDAS': 'Judas',
    'APOC': 'Apocalipsis', 'APOCALIPSIS': 'Apocalipsis',
}

POINTER_PREFIX_REGEX = re.compile(
    r'^(?:Ver\s+(?:el\s+)?comentario\s+(?:de\s+EGW\s+)?(?:sobre\s+|de\s+)?|'
    r'Ver\s+(?:el\s+)?(?:com\.?\s*)+(?:de\s+EGW\s+|EGW\s+)?(?:sobre\s+)?|'
    r'Ver\s+EGW\s*,?\s*(?:com(?:entario)?[\.,]?\s*)+(?:sobre\s+|de\s+)?|'
    r'Ver\s+EGW\s+)',
    re.I
)

# Trailing volume and page reference: e.g. ", t. I, pág. 1134." or "t. II, págs. 1020-1023."
VOLUME_PAGE_REGEX = re.compile(r'[,;]?\s*(\b(?:t\.|tomo\b)\s*(?:[IVX]+|\d+).*)$', re.I)

# OCR headers or trailing section banners to strip
OCR_BANNER_REGEX = re.compile(
    r'\s*(?:SALMO\s+\d+|\d+\s+TOMO\s+\d+.*|\bTOMO\s+\d+\s*-\s*Material\s+Suplementario.*)$',
    re.I
)

def build_anchor_registry(dataset):
    """
    Builds a quick lookup index for EGW anchors:
    registry[book][chapter] = list of (range_key, min_verse, max_verse, anchor)
    """
    registry = {}
    for book, chapters in dataset.items():
        registry[book] = {}
        for ch_str, ranges in chapters.items():
            ch = int(ch_str)
            registry[book][ch] = []
            for rk in ranges.keys():
                parts = rk.split('-')
                try:
                    min_v = int(parts[0])
                    max_v = int(parts[-1])
                except ValueError:
                    min_v, max_v = 1, 1
                registry[book][ch].append((rk, min_v, max_v, f"egw-{ch}-{rk}"))
    return registry

def resolve_anchor(registry, book, chapter, min_v, max_v):
    """
    Deterministically resolves a reference to an exact anchor or enclosing range anchor.
    Returns: anchor_str (e.g. 'egw-1-1-3') or '' (fallback to chapter note).
    """
    if book not in registry or chapter not in registry[book]:
        return ''
    blocks = registry[book][chapter]
    # 1. Exact match
    for rk, b_min, b_max, anchor in blocks:
        if b_min == min_v and b_max == max_v:
            return anchor
    # 2. Enclosing range match (e.g. v14 inside 14-16)
    for rk, b_min, b_max, anchor in blocks:
        if b_min <= min_v and max_v <= b_max:
            return anchor
    # 3. Overlap match (e.g. 1-5 overlapping with 1-3)
    for rk, b_min, b_max, anchor in blocks:
        if not (max_v < b_min or min_v > b_max):
            return anchor
    # Fallback to chapter note without anchor
    return ''

def normalize_book(token):
    clean = token.strip('. ').upper()
    return BOOK_MAP.get(clean)

def format_wikilink(book, chapter, anchor, label, registry=None):
    clean_label = label.strip()
    if registry is not None:
        if book not in registry or chapter not in registry[book]:
            return clean_label
    target_note = f"{book} {chapter} (EGW)"
    if anchor:
        return f"[[{target_note}#^{anchor}|{clean_label}]]"
    else:
        return f"[[{target_note}|{clean_label}]]"

def transform_pointer_body(current_book, current_chapter, body_text, registry):
    """
    Parses clauses in body_text and replaces scripture references with Obsidian wikilinks.
    Preserves trailing volume/page citations.
    """
    # 0. Clean OCR trailing banners and stray numbers
    body_text = OCR_BANNER_REGEX.sub('', body_text).strip()
    body_text = re.sub(r'(?<=\d[-–—]\d)\.\s*\d+\.?$', '.', body_text)

    # 1. Extract trailing volume / page info if present
    vol_suffix = ""
    vol_match = VOLUME_PAGE_REGEX.search(body_text)
    if vol_match:
        vol_suffix = body_text[vol_match.start():]
        body_text = body_text[:vol_match.start()].strip()

    # Clean trailing periods / commas / semicolons from the reference body
    trimmed_trailing = ""
    m_trail = re.search(r'[\.,;]+$', body_text)
    if m_trail:
        trimmed_trailing = m_trail.group(0)
        body_text = body_text[:m_trail.start()].strip()

    # Split into clauses by semicolon or comma before a book or cap
    # Lookahead allows digits 1-3, Roman numerals I-II, or book names followed by dot or space and digits
    clause_delimiters = re.split(
        r'(;\s*|\s*,\s*(?=(?:(?:[1-3]|I{1,2})\s+)?[A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\.|\s+\d+)|\bcap\b|\bcáp\b))',
        body_text
    )

    parsed_output = []
    active_book = current_book
    active_chapter = current_chapter

    # Reassemble clauses and delimiters
    clauses_and_delims = []
    curr_c = ""
    for token in clause_delimiters:
        if not token:
            continue
        if token.startswith(';') or token.strip().startswith(','):
            if curr_c:
                clauses_and_delims.append(('clause', curr_c))
                curr_c = ""
            clauses_and_delims.append(('delim', token))
        else:
            curr_c += token
    if curr_c:
        clauses_and_delims.append(('clause', curr_c))

    for item_type, item_val in clauses_and_delims:
        if item_type == 'delim':
            # Clean up spacing around delimiters
            if item_val.startswith(';'):
                parsed_output.append('; ')
            elif item_val.strip().startswith(','):
                parsed_output.append(', ')
            else:
                parsed_output.append(item_val)
            continue

        raw_clause = item_val.strip()
        if not raw_clause:
            continue

        # Try to parse the clause
        # Pattern 1: Same-chapter vers reference: e.g. "vers. 30", "ver. 14"
        m_vers = re.match(r'^(?:vers?\.?|v\.)\s*(\d+(?:\s*[-–—]\s*\d+)?)\s*$', raw_clause, re.I)
        if m_vers:
            v_str = m_vers.group(1).replace(' ', '')
            v_parts = v_str.split('-')
            min_v, max_v = int(v_parts[0]), int(v_parts[-1])
            anchor = resolve_anchor(registry, active_book, active_chapter, min_v, max_v)
            parsed_output.append(format_wikilink(active_book, active_chapter, anchor, raw_clause, registry=registry))
            continue

        # Pattern 2: cap.: 1-3 or cap. 1-3 (same chapter verse range)
        m_cap_same = re.match(r'^(?:cap|cáp)\.?:\s*(\d+(?:\s*[-–—]\s*\d+)?)\s*$', raw_clause, re.I)
        if m_cap_same:
            v_str = m_cap_same.group(1).replace(' ', '')
            v_parts = v_str.split('-')
            min_v, max_v = int(v_parts[0]), int(v_parts[-1])
            anchor = resolve_anchor(registry, active_book, active_chapter, min_v, max_v)
            parsed_output.append(format_wikilink(active_book, active_chapter, anchor, raw_clause, registry=registry))
            continue

        # Pattern 3: cap. 5: 13, 14 or cap. 17: 13 (chapter of current book)
        m_cap_ch = re.match(r'^(?:cap|cáp)\.?\s*(\d+)\s*(?::\s*|\s+)(\d+(?:[\s,–—\-0-9]*))\s*$', raw_clause, re.I)
        if m_cap_ch:
            ch_num = int(m_cap_ch.group(1))
            active_chapter = ch_num
            v_spec = m_cap_ch.group(2).strip()
            transformed_clause = transform_verse_sublist(active_book, active_chapter, f"cap. {ch_num}", v_spec, registry)
            parsed_output.append(transformed_clause)
            continue

        # Pattern 3b: cap. 15-22 (single span without colon, like in Juan 5:40 pointing to 15:22)
        m_cap_no_colon = re.match(r'^(?:cap|cáp)\.?\s*(\d+)\s*[-–—]\s*(\d+)\s*$', raw_clause, re.I)
        if m_cap_no_colon:
            c_cand = int(m_cap_no_colon.group(1))
            v_cand = int(m_cap_no_colon.group(2))
            if active_book in registry and c_cand in registry[active_book]:
                active_chapter = c_cand
                anchor = resolve_anchor(registry, active_book, active_chapter, v_cand, v_cand)
                parsed_output.append(format_wikilink(active_book, active_chapter, anchor, raw_clause, registry=registry))
                continue

        # Pattern 4: Book [Chapter]: [VerseList]
        # Supports digits (1-3) or Roman numerals (I, II) before book, space before colon (4 : 1)
        m_book = re.match(
            r'^((?:(?:[1-3]|I{1,2})\s+)?[A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\.|\b))\s*(\d+)?\s*(?::\s*|\s+)?(\d+(?:[\s,–—\-0-9]*))?\s*$',
            raw_clause
        )
        if m_book:
            raw_b = m_book.group(1).strip()
            norm_b = normalize_book(raw_b)
            if norm_b:
                active_book = norm_b
                ch_str = m_book.group(2)
                v_spec = m_book.group(3)

                if ch_str and v_spec:
                    active_chapter = int(ch_str)
                    transformed_clause = transform_verse_sublist(active_book, active_chapter, f"{raw_b} {ch_str}", v_spec, registry)
                    parsed_output.append(transformed_clause)
                    continue
                elif ch_str and not v_spec:
                    # e.g. "Juec. 16", "Sal. 17" -> whole chapter
                    active_chapter = int(ch_str)
                    anchor = resolve_anchor(registry, active_book, active_chapter, 1, 999)
                    parsed_output.append(format_wikilink(active_book, active_chapter, anchor, raw_clause, registry=registry))
                    continue

        # Pattern 5: Bare chapter and verse continuation: e.g. "20: 12-13" or "8: 6-7"
        m_bare_ch = re.match(r'^(\d+)\s*:\s*(\d+(?:[\s,–—\-0-9]*))\s*$', raw_clause)
        if m_bare_ch:
            ch_num = int(m_bare_ch.group(1))
            active_chapter = ch_num
            v_spec = m_bare_ch.group(2).strip()
            transformed_clause = transform_verse_sublist(active_book, active_chapter, str(ch_num), v_spec, registry)
            parsed_output.append(transformed_clause)
            continue

        # Fallback: keep raw clause if unrecognized
        parsed_output.append(raw_clause)

    result = "".join(parsed_output)
    if trimmed_trailing:
        result += trimmed_trailing
    if vol_suffix:
        result += vol_suffix

    return result

def transform_verse_sublist(book, chapter, prefix_label, v_spec, registry):
    """
    Transforms verse specifications like '1-3, 14' or '16 -18' into linked segments.
    e.g. prefix_label='Juan 1', v_spec='1-3, 14' ->
    '[[Juan 1 (EGW)#^egw-1-1-3|Juan 1:1-3]], [[Juan 1 (EGW)#^egw-1-14|14]]'
    """
    # Fix known typographical defect in raw CBA typeset: 2 Rey. 13: 1-3 -> 2 Rey. 23: 1-3
    if book == '2 Reyes' and chapter == 13:
        chapter = 23

    parts = [p.strip() for p in v_spec.split(',')]
    linked_parts = []

    for idx, p in enumerate(parts):
        if not p:
            continue
        clean_p = p.replace(' ', '')
        v_sub = clean_p.split('-')
        try:
            min_v = int(v_sub[0])
            max_v = int(v_sub[-1])
        except ValueError:
            linked_parts.append(p)
            continue

        anchor = resolve_anchor(registry, book, chapter, min_v, max_v)
        # Format label cleanly: remove spaces around colon and hyphen
        clean_v_label = re.sub(r'\s*-\s*', '-', p)
        clean_v_label = clean_v_label.strip()
        if idx == 0:
            label = f"{prefix_label}:{clean_v_label}"
        else:
            label = clean_v_label

        linked_parts.append(format_wikilink(book, chapter, anchor, label, registry=registry))

    return ", ".join(linked_parts)

def transform_comment_text(current_book, current_chapter, text, registry):
    """
    Main entry point: transforms commentary note text if it contains pointer references.
    Handles both standalone pointers and inline pointers like (Ver EGW com. ...).
    """
    # 1. Standalone pointer starting with 'Ver ...'
    m_prefix = POINTER_PREFIX_REGEX.match(text)
    if m_prefix:
        prefix = text[:m_prefix.end()]
        body = text[m_prefix.end():]
        transformed_body = transform_pointer_body(current_book, current_chapter, body, registry)
        return prefix + transformed_body

    # 2. Inline pointers inside parentheses, e.g. "(Ver EGW com. Rom. 5:12-19; 1 Tim. 2:5; Heb. 1: 1-3.)"
    def replace_inline(m):
        full_match = m.group(0)
        inner = m.group(1)
        m_inner_prefix = POINTER_PREFIX_REGEX.match(inner)
        if m_inner_prefix:
            prefix = inner[:m_inner_prefix.end()]
            body = inner[m_inner_prefix.end():]
            transformed_body = transform_pointer_body(current_book, current_chapter, body, registry)
            return f"({prefix}{transformed_body})"
        return full_match

    # Search for (Ver EGW com. ...)
    pattern_inline = re.compile(r'\(((?:Ver\s+EGW\s+com|Ver\s+com\.\s+de\s+EGW)[^)]+)\)', re.I)
    return pattern_inline.sub(replace_inline, text)
