# Skybound Realm Visual Style Guide
### Unity 2022.3 LTS · Built-in Render Pipeline · Post-Processing Stack v2

This is the recipe for the "looks like the anime" target: flat banded light,
clean ink lines, saturated warm/cool color play, and a soft ethereal glow on
anything that emits light.

---

## 1. Render pipeline choice: **Built-in RP** (and why)

| Consideration | Built-in | URP |
|---|---|---|
| Post-Processing Stack v2 (requested) | ✅ native | ❌ replaced by URP Volumes |
| Hand-written multi-pass ShaderLab (outline pass + ForwardAdd lantern pass in one file) | ✅ trivial | ⚠️ needs Renderer Features / custom passes |
| Per-pixel point lights for the lantern look | ✅ Forward Add | ✅ |
| Long-term future | ⚠️ legacy | ✅ |

**Decision: Built-in.** Everything you asked for — PPv2, a single self-contained
toon shader with an inverted-hull outline pass, per-light banded lantern pools —
is first-class in Built-in and requires extra plumbing in URP. For a solo,
stylized, non-photoreal project on 2022.3 LTS, Built-in is the lowest-friction
path. Nothing in the C# layer is pipeline-specific, so a later URP port only
means re-authoring the shader (Shader Graph + a Renderer Feature for outlines)
and converting the PP profile to a URP Volume.

### Project settings (do these first)
1. **Edit → Project Settings → Player → Other Settings → Color Space = Linear.**
   Gamma space wrecks the band thresholds and bloom response.
2. **Window → Package Manager → Unity Registry → "Post Processing" (v3.x) → Install.**
   This is Post-Processing Stack v2 (free, standard).
3. **Edit → Project Settings → Quality** (your default tier):
   - Pixel Light Count: **6** (lanterns + fireplace are per-pixel ForwardAdd lights)
   - Shadows: **Soft Shadows**, Shadow Resolution: **High**, Shadow Distance: **40**, Cascades: **2**
   - Anti Aliasing (MSAA): **Disabled** — we use SMAA from the post stack instead.

---

## 2. The cel shader (`SAO/Toon`)

Full source: `Assets/Shaders/SAOToon.shader`. Three passes:

1. **Outline** — inverted hull, extruded in *clip space* and scaled by `w`, so the
   line is a constant pixel width at any distance (uniform ink weight, like the show).
2. **ForwardBase** — directional light. `N·L × shadow attenuation` is quantized
   by `BandedLight()` into flat tones with a ~1px anti-aliased edge (`fwidth`).
   Because shadow attenuation goes *into* the band function, cast shadows get
   the same crisp painted edge as the terminator. Ambient is read from the flat
   ambient color. Sharp Blinn-Phong dot is thresholded into a hard specular ping.
   Rim light only appears on the lit side (classic anime back-glow).
3. **ForwardAdd** — point/spot lights, additive, banded the same way, so lanterns
   throw **flat posterized pools** of warm light instead of smooth CG falloff.

### Parameter cheat-sheet

| Property | What it does | Typical value |
|---|---|---|
| `Base Color` | The flat "paint" color | per material |
| `Shadow Tint` | Multiplies albedo in the shade band. **Never gray** — anime shadows shift hue. Cool violet against warm light. | `(0.62, 0.58, 0.75)` |
| `Light Bands` | Number of flat tones. 2 = classic anime. 3 adds a midtone for big curved props. | **2** |
| `Band Edge Softness` | Width of the band transition. Keep tiny; raise slightly on big curved surfaces if the edge crawls. | 0.004–0.02 |
| `Terminator Shift` | Slides the light/shadow boundary. Negative = more shadow (moodier). | 0 |
| `Specular Tint` | Black disables. Use only on brass, glass, varnished wood, sword steel. | matte: black |
| `Specular Sharpness` | Higher = smaller hot dot. | 96–256 |
| `Rim Color (alpha=strength)` | Sun-colored edge light. Subtle on props, stronger on characters later. | alpha 0.2–0.35 |
| `Emission (HDR)` | Push past 1.0 and the bloom pass picks it up (lantern glass, embers, windows). | 2–3× |
| `Outline Width (px)` | **0 on big architecture** (hard cube corners gap), 1.2–2 on props/furniture, ~2 on characters. | see below |

> **Outline caveat:** inverted-hull outlines need smooth(ish) normals. They look
> great on spheres/capsules/characters and acceptable on furniture, but on big
> flat-shaded cubes the hull splits at corners. That's why the generated wall,
> floor and ceiling materials ship with outlines off — the contrast between wall
> color and the warm key light does the separating instead, which is also how
> the show treats large interior planes.

---

## 3. Lighting & rendering settings (First Haven inn)

The builder (`Tools → SAO → 2`) applies all of this automatically; values below
are the reference if you set it up by hand. The scheme is the anime's
**warm key / cool fill** complement: late-afternoon orange sun against a flat
violet ambient.

**Window → Rendering → Lighting:**

| Setting | Value | Why |
|---|---|---|
| Skybox Material | `Sky_Floor1` (SAO/SkyGradient) | painted gradient, no photo HDRI |
| Sun Source | the directional light | |
| Realtime Global Illumination | **Off** | GI softens everything into mush; cel shading wants authored contrast |
| Baked Global Illumination | **Off** (for now) | greybox stage; the toon shader ignores lightmaps anyway |
| **Ambient Source** | **Color** = `#5C6185` (0.36, 0.38, 0.52) | the shader reads this as one flat fill tone — this is the entire "soft shadow" look |
| Fog | Off indoors | |

**Directional light ("Sun_LateAfternoon"):**

| Setting | Value |
|---|---|
| Rotation | (26°, 96°, 0°) — raking in through the west windows |
| Color | `#FFD49E` (1.0, 0.83, 0.62) |
| Intensity | 1.15 |
| Shadow Type | **Soft Shadows**, Strength **0.85** |

**Point lights (lanterns ×3, fireplace ×1):**

| | Lanterns | Fireplace |
|---|---|---|
| Color | `#FFB86B` (1, 0.72, 0.42) | `#FF8C40` (1, 0.55, 0.25) |
| Intensity | 1.25 | 1.6 |
| Range | 5.5 | 7 |
| Shadows | None (the banded falloff hides the absence) | None |

**Camera:** HDR **on** (bloom needs it), MSAA off, near plane 0.08, FOV 62.

---

## 4. Post-processing profile (PPv2) — exact settings

### Setup (one-time, ~2 minutes)
1. Create layer **`PostFX`** (Edit → Project Settings → Tags and Layers).
2. On **PlayerCamera**: Add Component → **Post-process Layer**.
   - Volume blending → Layer: **PostFX**
   - Anti-aliasing: **Subpixel Morphological Anti-aliasing (SMAA) — High**.
     SMAA keeps the ink outlines crisp; FXAA smears them, TAA ghosts them.
3. Empty GameObject `PostFX_Global` on layer **PostFX** → Add Component →
   **Post-process Volume** → check **Is Global**, Weight 1 → New profile,
   name it **`SAO_Floor1`**.
4. Add the effects below.

### Bloom — the "ethereal glow"
| Setting | Value |
|---|---|
| Intensity | **2.6** |
| Threshold | **1.05** — only HDR emitters (lantern glass, embers, window panes, specular pings) bloom; ordinary bright plaster does not |
| Soft Knee | **0.6** |
| Diffusion | **8.5** — wide, misty halo rather than a tight neon glow |
| Anamorphic Ratio | 0 |
| Color | `#FFF1DC` (warm white) |
| Fast Mode | Off |

### Color Grading — warm Floor-1 sunset
| Setting | Value |
|---|---|
| Mode | **High Definition Range** |
| Tonemapping | **Neutral** (ACES crushes saturation and adds a filmic shoulder — wrong for anime) |
| Temperature / Tint | **+12 / +4** |
| Post-exposure | **+0.25** |
| Contrast | **+8** |
| Saturation | **+14** |
| **Lift** (shadows) | RGB trackball toward blue-violet: **(0.98, 0.98, 1.04)**, offset **−0.004** |
| **Gamma** (midtones) | slightly warm: **(1.02, 1.00, 0.97)**, offset **0** |
| **Gain** (highlights) | golden: **(1.07, 1.00, 0.93)**, offset **+0.015** |

(Type the numbers into the trackball's numeric fields. The pattern is the whole
trick: cool the shadows, warm the highlights — complementary grading is 80% of
the "anime sunset" read.)

### Vignette — gentle frame
| Setting | Value |
|---|---|
| Mode | Classic |
| Color | `#1A1426` |
| Intensity | **0.26** |
| Smoothness | **0.42** |
| Roundness | 1, Rounded: off |

### Leave these OFF (and why)
- **Ambient Occlusion** — contact smudges fight the flat bands; the painted look has no AO.
- **Chromatic Aberration / Grain / Motion Blur** — the show's image is *clean*. Resist.
- **Depth of Field** — anime interiors are deep-focus; reconsider only for cutscenes.

---

## 5. Environment art direction — the inn interior

The builder greyboxes all of this (`Tools → SAO → 2`); this section is the *why*,
so replacement models inherit the style.

### Proportions & layout
- One readable room: **12 × 9 m, 3.4 m ceiling**. Door 2.3 m, beams 0.25–0.3 m thick.
- Everything is ~15–30% chunkier than realistic — storybook timber framing reads
  at a glance and survives cel shading; thin realistic trim just aliases away.
- Composition: door (south) → bar counter (north) is the entry sightline; the
  fireplace (east) and sunlit windows (west) cross-light it. Posts and ceiling
  beams divide the ceiling plane so the biggest flat surface still has rhythm.

### Palette (albedo hex)
| Surface | Color | Material |
|---|---|---|
| Stone floor | `#8F8782` warm gray | `Stone_Floor` |
| Plaster walls | `#EDE0C7` cream | `Plaster` |
| Timber frame / beams | `#664A30` dark walnut | `Wood_Dark` |
| Furniture wood | `#8C6642` honey oak | `Wood_Mid` |
| Fireplace stone | `#706B68` | `Stone_Dark` |
| Rug / fabric accents | `#9E2E29` deep crimson | `Fabric_Red` |
| Lantern brass | `#B58C4F` | `Brass` (sharp specular) |
| Lantern glass | emissive ~2.6× HDR orange | `Lantern_Glass` |

Discipline rules: **three value groups** (dark timber / mid floor / light walls),
saturation lives in the mids, and every shadow tint is a violet hue-shift of its
base — never gray, never black.

### Light recipe
Warm sun shafts from the west windows + three lantern pools + ember glow, over a
flat cool ambient. The emissive window panes fake a low sun and feed bloom, so
the room reads "golden hour" even before you add real exterior light shafts.

### When you replace the primitives with real models
- **Hand-painted, low-frequency textures only.** Flat fills + soft painted
  gradients + baked-in big-shape AO. No photo textures, no noise detail.
- **Skip normal maps.** The band function quantizes lighting, so normal detail
  shows up as band-edge crawl. Model bevels instead — a 2–3 cm chamfer on every
  beam edge is what catches the toon specular and sells "clean anime wood".
- Texel density ~512 px per 2 m is plenty; the style lives in silhouette and
  palette, not resolution.
- Keep smoothing groups soft on props so the outline hull stays gap-free.
