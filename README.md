# SVG 2 USE Unpolyfill

A mostly compatible implementation of SVG 1.1 'use' elements to fix context based styling that SVG 2 broke: https://github.com/w3c/svgwg/issues/367

In 2017 FireFox rolled out their implementation of the SVG 2 working draft, breaking the styling of various existing SVG content containing use elements written over the last decade. This unpolyfill is intended as a drop in fix, restoring partial support for context based styling from SVG 1.1

## Use

1. Basic Use (Entire Document):

```js
svg2useUnpolyfill();
```

Invoked _once_, at _any time_, this will search the document for use elements, hide them, generate instances and replicate mutations to the originals as they occur. It also continually observes the document for newly added use elements, so it is insensitive to _when_ it is invoked (i.e can be called before or after an SVG fragment is inserted or changed).

2. Advanced Use (Document Subsets):

```js
svg2useUnpolyfill(document.querySelector('#mysvgs'));
```

For large and dynamic documents the basic invocation _may_ impact performance. This is because the document must be observed for _all_ mutations to topology in-case any of them are use element insertions. In which case performance may be improved by observing one or more subsets by selecting a root (or roots) closer to where the SVG fragments reside.

## API

`svg2useUnpolyfill([useRoot, refRoot])`

- Element `useRoot` (default = document.body)
Searched for use elements to process and observed for inserted use elements.

- Element `refRoot` (default = document.body)
Searched for the hrefs, can also be used to isolate SVG fragments href ids.

## Unpolyfill vs SVG 1 vs SVG 2

1. Styling via _instances-context_ IS supported (as per SVG-1, not SVG-2)
2. Styling via _reference-context_ NOT supported (as per SVG-2, not SVG-1)
3. External hrefs are not implemented (differs from both specs)
4. Event inheritance is not implemented (differs from both specs)

## Why?

SVG 2 made significant breaking changes to how 'use' instances can be styled based on their context, essentially ignoring all context based CSS selectors except for those valid within the referenced subtree in isolation. This has transformed 'use' from a powerful deduplication feature into a novelty only capable of instancing visually identical copies.

This would not be so problematic had SVG 2 respected older version declarations like HTML5 or had a new mandatory declaration to prevent existing web content from breaking when SVG 2 implementations arrive. Unfortunately it interprets all SVG fragments as SVG 2, often resulting in obscured graphics filled with black for anything beyond rudimentary instancing.

The most useful parts of SVG 1.1 behaviour (styling based on instance context) was widely supported across all major browsers, including all the way back to IE9. So this change has the potential to adversely affect much existing SVG web content written over the last decade.

## How?

Full implementation of SVG 1.1 'use' is complex because it attempts to combine the cascade from both the reference-context and the instance-context. Arguably the former is redundant, omitting it significantly simplifies implementation; Whereas keeping the instance-context cascade alone is simple and indispensable for realising the full potential of 'use' elements.

This polyfill focuses on restoring only the instance-context styling behaviour. The basic concept is to generate instance trees using regular DOM, the styling behaviour of this is obvious and intuitive: The resulting instance trees can be targeted by CSS in the context of the use element _in their entirety_, just like the rest of the formal document structure.

The remainder of the implementation primarily concerns itself with catching dynamically inserted use elements and keeping existing instances in sync with mutations to their 'use' element and it's reference, this is achieved through heavy (but considerate) use of mutationObservers.

## License

[The MIT License](LICENSE.md)
