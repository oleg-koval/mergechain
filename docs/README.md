# Launch / store assets

Drop the visual assets here. The README and store listing reference these paths.

## Capture list

| File | What to capture | Used by |
|---|---|---|
| `demo.gif` | The unblock loop: on a blocked PR, the merge button is grey → merge the dependency PR → return and watch it go green/enabled. ~5-8s, 1280px wide. | README hero, social |
| `screenshot-block.png` | A PR showing the "PR Dependencies" block (Blocked state) above the merge box, with a dep row. 1280×800. | README, Chrome Web Store |
| `screenshot-popup.png` | The toolbar popup (the placement arrow pad). | Chrome Web Store |
| `screenshot-options.png` | The Options page (sign-in + security panel). | Chrome Web Store |

## Tips

- Use a clean throwaway repo (e.g. `oleg-koval/pr-deps-e2e`) with obvious PR
  titles ("PR A: base feature", "PR B: depends on A").
- Dark theme reads best against the extension's Primer-token styling.
- For the GIF, keep it under ~3 MB so it inlines in the README.
- Chrome Web Store screenshots must be 1280×800 or 640×400 PNG/JPEG.
