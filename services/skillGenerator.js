function sanitizeSource(source)
{
    return source.replace(/[`*_{}\[\]()#+\-.!|~]/g, "\\$&").replace(/\n/g, " ");
}

function buildPrompt(texts, preferredLanguage)
{
    const langInstruction = preferredLanguage === "korean"
        ? "The writer primarily uses Korean. Analyze Korean-specific patterns: honorifics (합니다/한다/해요), sentence endings (~다/~요/~니다), topic markers (은/는/이/가), and code-switching with English. The analysis summary should be written primarily in Korean."
        : preferredLanguage === "english"
            ? "The writer primarily uses English."
            : "Detect the language(s) used and analyze accordingly. Mixed-language patterns are also valid traits.";

    let textBlock = "";
    for (const t of texts)
    {
        const truncated = t.content.length > 15000
            ? t.content.slice(0, 15000) + "\n[...truncated...]"
            : t.content;
        const safeSource = sanitizeSource(t.source);
        textBlock += `\n--- SOURCE: ${safeSource} ---\n${truncated}\n`;
    }

    return `You are a computational stylometry expert. Analyze these texts by the same person using established dimensions from forensic linguistics, authorship attribution research, and writeprint analysis.

Analyze each of the following 12 dimensions with concrete evidence and examples:

===== LEXICAL DIMENSIONS =====

1. FUNCTION WORDS (Writer Invariant — Mosteller/Wallace method):
   Identify the author's subconscious pattern in using function words: articles (a, an, the), prepositions (of, in, to, for, with, on, at, by, from), conjunctions (and, but, or, so, because, although), auxiliary verbs (is, was, are, were, has, have, had, will, would, can, could), pronouns (I, you, he, she, it, we, they, my, your, his, her, our, their). Look for overuse or underuse of specific function words relative to typical prose. This is the SINGLE MOST RELIABLE authorship marker.

2. VOCABULARY RICHNESS (Type-Token Ratio):
   Measure lexical diversity: ratio of unique words to total words. Does the author reuse words heavily (low TTR, repetitive style) or use many distinct words (high TTR, varied vocabulary)? Note: account for text length bias.

3. WORD LENGTH DISTRIBUTION:
   Average word length (characters), preference for short vs long words. Frequency of multi-syllable words vs monosyllabic choices. Use of contractions (isn't, don't, I'm vs is not, do not, I am).

4. SIGNATURE VOCABULARY (Idiosyncratic Lexicon):
   Recurring preferred words, pet phrases, filler words (um, like, actually, basically, literally, you know), transitional phrases (however, therefore, moreover, on the other hand, in contrast), discourse markers (well, so, anyway, I mean, look, listen), and any notably overused terms.

===== SYNTACTIC DIMENSIONS =====

5. SENTENCE ARCHITECTURE:
   Average sentence length (in words). Distribution pattern: consistent vs highly variable. Preference for: short punchy sentences vs complex multi-clause sentences. Use of fragments. Do they vary length for effect (e.g., long-short-long pattern)? Clause structure: simple/compound/complex ratio. Subordinate clause nesting depth.

6. VOICE AND PERSPECTIVE:
   Active vs passive voice ratio. First-person (I, we) vs second-person (you) vs third-person (he/she/it/they) vs impersonal constructions. Use of hedging (might, perhaps, possibly, seems, tends to, arguably). Use of boosting (certainly, definitely, absolutely, clearly, obviously). Use of direct address (you, reader, as you can see).

7. PUNCTUATION FINGERPRINT:
   Overall punctuation density (marks per sentence). Comma usage: heavy (Oxford comma, many clauses), light (minimal punctuation), or standard. Use of: semicolons, colons, em-dashes, en-dashes, parentheses, ellipses, exclamation marks, question marks. Quotation style: single vs double quotes. Bullet point style: -, *, or numbered.

===== STRUCTURAL DIMENSIONS =====

8. TEXT ARCHITECTURE:
   Paragraph length: consistently short, consistently long, or varied. How does the author start paragraphs (topic sentence pattern)? How do they end (concluding statement, transition, abrupt)? Use of headings and subheadings. Overall organizational pattern: linear/narrative, hierarchical, problem-solution, compare-contrast, list-based.

9. LIST AND ENUMERATION STYLE:
   When presenting multiple items, does the author use: numbered lists, bullet points, inline enumeration ("first... second... third"), or narrative description? Format of numbered lists: "1." vs "1)" vs "Step 1:".

===== REGISTER AND RHETORIC =====

10. TONE AND REGISTER:
    Formal vs informal vs technical vs conversational. Academic distance vs personal engagement. Humor: dry/wry, sarcastic, playful, absurdist, or absent. Level of certainty expressed. Emotional register: warm/cold, enthusiastic/restrained, optimistic/pessimistic, confrontational/diplomatic.

11. RHETORICAL DEVICES:
    Use of: metaphors and analogies, rhetorical questions, repetition for emphasis (anaphora, epistrophe), direct reader address, contrast/comparison framing, rule-of-three, storytelling/anecdote insertion, alliteration, exaggeration/hyperbole, understatement/litotes.

===== CODE AND MIXED-MEDIA DIMENSIONS =====

12. CODE STYLE (if code is present):
    Brace placement: same-line (K&R) vs next-line (Allman). Comment style: // vs /* */, inline vs block vs doc-comment. Comments: sparse, thorough, ASCII-only, or natural language. Naming conventions: camelCase, snake_case, PascalCase, Hungarian. Indentation: tabs vs spaces, width. Line length preferences. Single-exit vs early-return patterns. Const-correctness. Error handling style: try/catch, if-checks, assertions, status codes.

If no code is found, describe the general formatting patterns of prose text instead.

===== LANGUAGE SPECIFIC =====

13. LANGUAGE PREFERENCE: ${langInstruction}

Now generate a Markdown Skill file that an AI agent can load to replicate this writer's style. Follow this structure EXACTLY:

---
name: my-writing-style
description: Writing style extracted from ${texts.length} document(s) across 13 stylometric dimensions.
---

# My Writing Style

## Lexical Patterns

### Function Words
[analysis of the author's function word fingerprint — the most reliable stylometric marker]

### Vocabulary
[word length, type-token richness, preferred terms, pet phrases, filler words]

## Sentence Craft

### Architecture
[sentence length patterns, complexity, clause structure, variation]

### Voice & Perspective
[active/passive, person, hedging, boosting, directness]

### Punctuation
[punctuation fingerprint: density, comma style, special characters]

## Structure & Organization

### Text Architecture
[paragraph patterns, heading style, organizational approach]

### Lists & Enumeration
[how the author presents sequences and groups]

## Tone & Rhetoric

### Register & Tone
[formality, humor style, emotional register, conversational distance]

### Rhetorical Style
[devices used: metaphors, questions, repetition, anecdotes, etc.]

## Formatting & Conventions

### Code Style
[if applicable; otherwise describe general formatting patterns]

### Language & Expression
[language preference, code-switching, expression quirks]

## Writing Guidelines

[numbered, actionable rules that an AI can follow to replicate this style. Each rule should be concrete and testable, e.g. "Use semicolons only between closely related independent clauses, never as a list separator."]

## Example Phrases

- "[verbatim example 1 from the texts]"
- "[verbatim example 2]"
- "[verbatim example 3]"
- "[verbatim example 4]"
- "[verbatim example 5]"

${textBlock}`;
}

module.exports = { buildPrompt };
