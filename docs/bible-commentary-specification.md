# Vault Bible & Commentary Specification Standard

## 1. Overview & Architectural Principles

This document defines the canonical specification for vault-native Bible translations, external commentary corpora, and derived study editions within the `local-bible-ref` ecosystem.

### Architectural Principles:
1. **Single Source of Truth (SSOT):** Unannotated Bible translations and commentary collections are maintained as distinct, decoupled corpora. Bibles reside directly under `70. Bible/<Translation>/`, while commentary notes reside under `70. Bible/Comentarios/<Commentary>/`.
2. **Non-Destructive Derivation:** Merging a base Bible with a commentary collection NEVER mutates the base Bible files. It produces a newly derived study Bible in a dedicated folder (e.g. `RVG (EGW)`), fully indexed by `local-bible-ref`.
3. **Atomic Block Anchoring:** Commentary notes use standard Obsidian block anchors (`^<prefix>-<chapter>-<range>`) to ensure native Obsidian Page Preview popovers display exclusively the relevant commentary block.
4. **Range De-Cluttering:** For commentary items spanning multiple verses (e.g. verses 4 to 14), only the starting verse receives an annotated badge (`🕊️ 4-14`). Subsequent verses in the range remain visually clean without redundant badges.

---

## 2. Directory Layout & Folder Standards

```
70. Bible/
├── RVG/                                      <-- Base translation (pure, unannotated)
│   ├── Génesis/
│   │   ├── Génesis 1.md
│   │   └── ...
│   └── ...
├── Comentarios/
│   └── EGW/                                  <-- Decoupled commentary collection
│       ├── Génesis/
│       │   ├── Génesis 1 (EGW).md
│       │   └── ...
│       └── ...
└── RVG (EGW)/                                <-- Derived study Bible (generated)
    ├── Génesis/
    │   ├── Génesis 1.md
    │   └── ...
    └── ...
```

---

## 3. Metadata & YAML Frontmatter Contracts

### 3.1 Base Bible Translation Note
```yaml
---
version: RVG
book: Génesis
chapter: 1
---
```

### 3.2 Commentary Collection Note
```yaml
---
tipo: comentario
autor: Elena G. de White
fuente: CBA Tomo 7A
badge: "🕊️"
libro: Génesis
capitulo: 1
---
```
- `badge`: Specifies the icon/emoji to prepend when merging into a study Bible. Defaults to `"🕊️"` if omitted.
- `tipo`: Must be `"comentario"`.

### 3.3 Derived Study Bible Note
```yaml
---
version: RVG (EGW)
base_version: RVG
commentary: EGW
book: Génesis
chapter: 1
---
```

---

## 4. Verse Marking & Anchor Conventions

### 4.1 Verse Marking in Bible Text
Verses are identified by HTML superscript tags:
- Standard verse: `<sup>14</sup> Y dijo Dios...`
- Chapter start: `**1** <sup>1</sup> En el principio...`

### 4.2 Atomic Anchors in Commentary Notes
Each commentary section is enclosed within a callout block, followed by an atomic anchor:
```markdown
### 1:1-3 — La creación de los cielos y la tierra
> [!quote]
> El Creador del cielo y la tierra...
> — *Review and Herald, 1887*.
^egw-1-1-3
```
Anchor naming syntax:
`^<prefix>-<chapter>-<range_key>`
- Single verse: `^egw-1-26`
- Multi-verse range: `^egw-1-1-3`, `^egw-1-14-16`

---

## 5. Merger Engine Rules & Badge Placement

The merger engine scans the selected base Bible and commentary notes for matching books and chapters.

### 5.1 Single-Verse Badge Injection
When a commentary note has a single-verse anchor `^egw-1-26`:
- Pattern in Base Bible: `<sup>26</sup>`
- Injected in Study Bible: `<sup>26</sup> [[Génesis 1 (EGW)#^egw-1-26|🕊️]] `

### 5.2 Multi-Verse Range De-Cluttering
When a commentary note covers a range `4-14` with anchor `^egw-1-4-14`:
- Starting verse (`v4`): receives the range-annotated badge:
  `<sup>4</sup> [[Hebreos 1 (EGW)#^egw-1-4-14|🕊️ 4-14]] `
- Subsequent verses (`v5`, `v6`, ..., `v14`): receive **NO** badge.

### 5.3 Multiple Comments on Same Verse / Range
If multiple distinct commentary blocks exist for the same verse start, badges are appended in order:
`<sup>1</sup> [[Génesis 1 (EGW)#^egw-1-1-3|🕊️ 1-3]] [[Génesis 1 (EGW)#^egw-1-1|🕊️]] `

---

## 6. Integration Contract with `local-bible-ref`

1. **Vault Scanner:** The plugin settings UI scans the vault for candidate base Bible folders under `70. Bible/` (excluding `Comentarios` and already derived editions) and candidate commentary folders under `70. Bible/Comentarios/`.
2. **Derivation Name:** The output folder is named `<BaseBible> (<CommentarySuffix>)`.
3. **Automatic Discovery:** The newly created folder is immediately available to the version switcher (`SwitchVersionModal`) and the quick search engine (`BibleSearchEngine`) without requiring a vault reload.
