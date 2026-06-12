# Visual Style Guide — the "anime film" look

Target: warm golden-hour key light, cool ambient shadow, banded cel shading,
gentle bloom over emissives and rim light, soft snowy air. The builders set
most of this; here is what each knob does and where to push it.

## 1. Cel shading — `ReImpact/Toon`

| Property | Default | Notes |
|---|---|---|
| `_ShadowTint` | (0.62, 0.55, 0.72) | Purple-ish shadows read "anime"; never use pure black. |
| `_BandSoft` | 0.04 | Lower = crisper bands. 0.01 for characters, 0.08 for big props. |
| `_RimColor` / `_RimStrength` | warm white / 0.35 | Backlight halo. Raise to ~0.5 at dusk. |
| `_OutlineWidth` | 0.004 | Characters 0.004–0.006; large buildings 0 (turn it off) to avoid heavy contours. |

VRM characters come with **MToon** — keep it; it is already a better anime
shader for faces (shade shift, outline width per material). Match its shade
color to `_ShadowTint` so characters sit in the same light as the world.

## 2. Lighting (set by the district builder)

- Sun: directional, warm `(1.0, 0.91, 0.78)`, intensity 1.15, soft shadows,
  ~38° elevation. Golden hour = low sun + warm color, that's the whole trick.
- Ambient: Trilight — sky `(0.62, 0.72, 0.92)`, equator `(0.78, 0.70, 0.66)`,
  ground `(0.40, 0.38, 0.34)`. Cool sky fill against the warm key.
- Fog: linear 70→320, color `(0.78, 0.80, 0.90)`. Fog is what makes distant
  rooftops feel painted.

## 3. Post-processing (manual, 5 minutes)

Install **Post Processing** (Package Manager → Unity Registry → Post
Processing). Add a global Volume + layer on the camera:

- **Bloom**: intensity 1.4, threshold 1.05, soft knee 0.6 — windows, lamps,
  the tree star and bolt projectiles will glow.
- **Color Grading**: Temperature +8, post-exposure +0.2, saturation +12,
  slight teal-orange via Lift/Gain (lift toward teal, gain toward warm).
- **Vignette**: 0.25.
- (Optional) Depth of Field at far range for that "lens" feel in screenshots.

## 4. Composition habits that sell the style

- Keep emissive accents in every shot: windows, lamps, bulbs (the builders
  scatter them deliberately).
- Snow + warm light = instant atmosphere; raise snow `rateOverTime` to 300
  for storytelling moments.
- Camera FOV 50–58; lower FOV looks more "anime film" than wide angles.
