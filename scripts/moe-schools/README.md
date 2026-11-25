# MOE school list

Builds `functions/src/data/moeSchools.json` (read-only census-number lookup) from two Ministry of Education PDFs.

Sources (download manually, the script never downloads):

- All schools (2023): https://moe.gov.lk/wp-content/uploads/2025/04/SchoolDetails.pdf
- National schools (2026): https://nstt.moe.gov.lk/instructions/List%20of%20National%20Schools.pdf

Requires `pdftotext` (poppler).

```sh
pnpm moe:build path/to/SchoolDetails.pdf path/to/NationalSchools.pdf
```

Output: `{ [censusNo]: { n, a, l, g, m, s, p?, d?, z? } }` (name, address, level, grade span, medium, sex, province, district, zone). The national list sets `l: "National"` and adds `p`/`d`/`z`. Census numbers keep leading zeros. Numeric prefixes ("4.", "11.") are stripped.

Rerun when MOE publishes new lists. The build fails if a census number is not 4-6 digits or a row cannot be parsed.
