# Bookplates: the only place for AI images

Covers stay computed (docs/COVERS.md). A test with four Copilot images (2026-09-27) showed why:
- **Numbers were garbled.** Both IDs came back wrong ("1C0418").
- **The map was invented.** It became a star from one hub, and the canton outline turned into a cog.
- **The bars were right**, but only because the prompt gave all 40 values, and our generator
  draws that exactly.
- **What made the images attractive was the print texture**, and the covers now have it
  without AI (`printDefs` in `src/cover.ts`).

So AI images are used for **one plate per category** and nothing else. A plate illustrates the
topic, never a dataset, and it carries no fact.

## Rules
- **Where a plate may appear:** on the shelf ends, as board headers, and on the v2 hero. Never
  on a dataset's cover or in its panel.
- **Style:** two-colour linocut, ink in the category's cloth colour (`CATEGORY_CLOTH`) on paper
  `#f4f0e6`. Square, with a wide margin.
- **What a plate contains:** one bold motif, drawn with fewer than about 15 carved shapes.
- **What a plate never contains:** text, numbers, people, buildings, or a recognisable real place.
- **Human review:** a person picks every plate. The page labels it "Illustration (KI)".
- **Record keeping:** each accepted plate stores its prompt, the tool and the date next to the
  image.
- **Reference:** the accepted "Umwelt & Klima" tree is the standard for simplicity. The first
  "Mobilität" plate (crossroads, tram, bridge) was rejected: too busy at shelf-end size, and it
  looks like a real Basel spot without being one.

## Shared prompt tail
Append to every prompt:

```
Two-colour linocut print, flat ink on warm off-white paper (#f4f0e6), bold carved shapes with visible gouge marks, no gradients, no shading, no photorealism. One single motif, fewer than fifteen shapes, centred in a square with a wide empty margin. No text, no letters, no numbers, no people, no buildings, no recognisable real place. Calm and restrained, like a 1930s library ex-libris stamp. It must belong to one set with a simple linocut tree bookplate.
```

## Prompts (one per category)
| Category | Ink | Motif |
|---|---|---|
| Umwelt & Klima | `#3f6b4a` | *Accepted:* a single broad tree canopy over a curving path, three wind strokes. |
| Mobilität & Verkehr | `#2b5c73` | Two gently curving parallel rails crossing one straight path, seen from above; one small wheel shape where they meet. |
| Bevölkerung & Gesellschaft | `#74506b` | Three simple round heads of different sizes side by side, no faces, like pebbles in a row. |
| Gebaute Stadt & Infrastruktur | `#6b5a48` | A single arch of a stone bridge with three carved blocks, reflected once below. |
| Öffentlicher Raum & Freizeit | `#a8692f` | An empty park bench under the arc of a low sun, a few grass strokes. |
| Gesundheit | `#8a3f3f` | A single leaf with a clear central vein held in a cupped outline, like a herbal. |
| Bildung | `#3f4f8a` | An open book seen from the side, pages fanning, one bookmark ribbon. |
| Kultur | `#86692a` | A simple theatre curtain drawn open around an empty round stage. |
| Staat & Wirtschaft | `#4a4a52` | A balance scale with two level pans, one small coin on each. |

Each prompt is: *"A small ex-libris bookplate. Ink colour {Ink}. Motif: {Motif}"* followed by the
shared tail.

## Acceptance check
- Does the plate read at 64 px, as a shelf-end plaque?
- Does it sit calmly next to the tree plate?
- Does it contain nothing that could be read as data, a place, or a person?

If any answer is no, generate again. Do not edit an image to "fix" it.
