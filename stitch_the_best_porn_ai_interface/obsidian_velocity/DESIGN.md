---
name: Obsidian Velocity
colors:
  surface: '#200e0b'
  surface-dim: '#200e0b'
  surface-bright: '#4b332f'
  surface-container-lowest: '#1a0906'
  surface-container-low: '#2a1613'
  surface-container: '#2e1a16'
  surface-container-high: '#3a2520'
  surface-container-highest: '#462f2b'
  on-surface: '#ffdad3'
  on-surface-variant: '#e9bcb3'
  inverse-surface: '#ffdad3'
  inverse-on-surface: '#412b26'
  outline: '#b0877f'
  outline-variant: '#5f3f38'
  surface-tint: '#ffb4a5'
  primary: '#ffb4a5'
  on-primary: '#650a00'
  primary-container: '#ff5638'
  on-primary-container: '#590700'
  inverse-primary: '#ba1b00'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#abc7ff'
  on-tertiary: '#002f66'
  tertiary-container: '#448fff'
  on-tertiary-container: '#002859'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad3'
  primary-fixed-dim: '#ffb4a5'
  on-primary-fixed: '#3f0400'
  on-primary-fixed-variant: '#8f1200'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#d7e2ff'
  tertiary-fixed-dim: '#abc7ff'
  on-tertiary-fixed: '#001b3f'
  on-tertiary-fixed-variant: '#00458f'
  background: '#200e0b'
  on-background: '#ffdad3'
  surface-variant: '#462f2b'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.2em
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  xxl: 80px
---

## Brand & Style

The design system is engineered to evoke the "Matte-Black Ferrari" aesthetic: sharp, cinematic, and unapologetically high-performance. It targets a discerning audience that values technical precision and raw, artistic seduction. The UI must feel like a luxury cockpit—functional yet intimidatingly premium.

The style is a fusion of **Minimalism** and **High-Contrast Bold**. It relies on deep blacks to create infinite depth, allowing high-resolution cinematic imagery and Ferrari Red accents to pierce through the darkness. The emotional response is one of exclusive access, power, and high-speed gratification.

## Colors

The palette is rooted in the absence of light. Use **Pure Black (#000000)** for the primary canvas to ensure OLED-perfect depth. **Near-black (#0A0A0A)** is reserved for subtle section definition, while **#111111** defines floating surfaces and cards.

**Ferrari Red (#FF2800)** is the sole driver of action. Use it sparingly but decisively for primary calls-to-action, active indicators, and critical focus states. All secondary text must use **Muted White (#A0A0A0)** to maintain visual hierarchy and prevent "vibration" against the black background.

## Typography

This design system utilizes **Inter** for its technical precision and modern clarity. 

- **Headings:** Must be bold and authoritative. Use generous letter spacing (tracking) for sub-headlines and labels to evoke a high-fashion, cinematic feel.
- **Body:** Keep line lengths tight (max 75 characters) to ensure readability within the single-column layout.
- **Copy:** Use provocative, arrogant microcopy. Labels should be uppercase with wide tracking to look like engraved serial numbers on a high-end machine.

## Layout & Spacing

The layout is a disciplined **Single-Column Fluid Grid** with a strict maximum width of **780px**. This ensures an intimate, focused reading and viewing experience akin to a premium editorial or lookbook.

- **Margins:** Use 24px side margins on mobile, increasing to 48px or auto-centering on desktop.
- **Rhythm:** Vertical rhythm should be aggressive. Use `xxl` (80px) spacing between major sections to let the content breathe.
- **Alignment:** Center-align hero elements for maximum impact; left-align long-form body text for legibility.

## Elevation & Depth

In a pure black environment, traditional shadows are invisible. Depth is instead achieved through **Tonal Layering** and **Luminescence**:

- **Surfaces:** Use `#111111` for cards and containers to create a "raised" effect against the `#000000` background.
- **Outer Glows:** Apply a subtle, 20% opacity Ferrari Red drop shadow (blur: 15px) to primary buttons and active indicators to simulate the glow of an Italian supercar's taillights.
- **Dividers:** Use 1px solid lines in `#1A1A1A` for razor-sharp structural definition.

## Shapes

The shape language is **Sharp (0)**. There are no rounded corners in this design system. Every card, button, and input field must have 90-degree angles to maintain a hard-edged, aggressive, and technical aesthetic. This reinforces the "Matte-Black Ferrari" narrative of precision engineering.

## Components

- **Primary Buttons:** Pure Ferrari Red (#FF2800) background, white text, bold all-caps. No border. On hover, increase the intensity of the red outer glow.
- **Cinematic Cards:** 16:9 aspect ratio thumbnails. No border, sharp corners. Title overlays should use a subtle bottom-to-top black gradient (0% to 80% opacity) for text legibility.
- **Input Fields:** Bottom-border only (1px, #A0A0A0). When active, the border turns Ferrari Red with a faint glow.
- **Chips/Tags:** Small, all-caps text with a 1px white or red border. No background fill.
- **Progress Bars:** Ultra-thin (2px) Ferrari Red lines.
- **Microcopy:** Use buttons with text like "INDULGE," "ACCELERATE," or "WANT IT."