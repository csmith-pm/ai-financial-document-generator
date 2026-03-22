# WCAG 2.1 AA Compliance Checklist — Budget Documents

## PDF Accessibility Requirements

### Document Structure
- [ ] PDF is tagged (not just scanned images)
- [ ] Reading order is logical and matches visual layout
- [ ] Language attribute is set (e.g., `en-US`)
- [ ] Document title is set in metadata
- [ ] Bookmarks/outline matches table of contents

### Text Content
- [ ] All text is selectable (not rasterized)
- [ ] Font size minimum 10pt for body text
- [ ] Sufficient color contrast: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold)
- [ ] No information conveyed by color alone (use pattern, label, or shape in addition)
- [ ] Meaningful link text (not "click here")

### Images and Charts
- [ ] All images have alt text describing content and purpose
- [ ] Charts have alt text summarizing the data trend (not just "bar chart")
- [ ] Decorative images are marked as artifacts (no alt text needed)
- [ ] Complex charts include a data table alternative nearby

### Tables
- [ ] Table headers are properly tagged (`<TH>` elements)
- [ ] Row and column headers have scope attributes
- [ ] Tables are not used for layout purposes
- [ ] Complex tables have header-cell associations
- [ ] Table captions or summaries describe the table's purpose

### Navigation
- [ ] Table of contents links to correct pages
- [ ] Page numbers are consistent between TOC and content
- [ ] Headers are tagged with proper heading levels (H1-H6) in logical order

---

## Web Preview Accessibility Requirements

### Semantic HTML
- [ ] Heading hierarchy is logical (h1 → h2 → h3, no skipped levels)
- [ ] Lists use `<ul>`, `<ol>`, `<li>` elements
- [ ] Navigation landmarks present (`<nav>`, `<main>`, `<header>`, `<footer>`)
- [ ] Content sections use `<section>` or `<article>` with labels
- [ ] Language attribute on `<html>` element

### Keyboard Navigation
- [ ] All interactive elements are keyboard accessible
- [ ] Tab order follows visual layout
- [ ] Focus indicators are visible (no `outline: none` without alternative)
- [ ] No keyboard traps

### ARIA and Roles
- [ ] Charts have `role="img"` with `aria-label` describing the data
- [ ] Tab panels use proper ARIA roles (`tablist`, `tab`, `tabpanel`)
- [ ] Dynamic content updates use `aria-live` regions
- [ ] Modal dialogs trap focus and have proper roles

### Color and Contrast
- [ ] Text contrast ratio: 4.5:1 minimum (normal text)
- [ ] Large text contrast ratio: 3:1 minimum (18pt+ or 14pt+ bold)
- [ ] UI component contrast: 3:1 minimum against adjacent colors
- [ ] Focus indicator contrast: 3:1 minimum
- [ ] No information conveyed solely by color

### Tables (Web)
- [ ] `<table>` elements have `<caption>` or `aria-label`
- [ ] `<th>` elements have `scope="col"` or `scope="row"`
- [ ] Complex tables use `headers` attribute
- [ ] Responsive tables remain accessible on small screens

### Images and Media
- [ ] `<img>` elements have `alt` attributes
- [ ] Decorative images use `alt=""` or `aria-hidden="true"`
- [ ] SVG charts have `<title>` and `<desc>` elements
- [ ] Chart data is available in an alternative format (data table)

### Forms and Interactive Elements
- [ ] Form inputs have associated `<label>` elements
- [ ] Error messages are programmatically associated
- [ ] Required fields are indicated (not just by color)

---

## Common Budget Document Issues

### High Priority
1. **Chart images without alt text** — Every chart must describe the data trend
2. **Tables without header associations** — Revenue/expense tables need proper `<TH>` tags
3. **Color-only differentiation** — Budget vs. actuals shown only by color (add pattern or label)
4. **Insufficient contrast** — Light gray text on white background fails 4.5:1

### Medium Priority
5. **Missing reading order** — Multi-column layouts may read incorrectly
6. **Untagged PDF** — Generated PDF must include structure tags
7. **Missing document title** — PDF metadata should include descriptive title
8. **Skipped heading levels** — Jumping from H1 to H3

### Low Priority
9. **Decorative images not marked** — Logos, borders should be artifacts
10. **Missing language attribute** — Both PDF and HTML need lang set
