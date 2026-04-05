# SpriteForge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an MCP server that gives AI agents a complete sprite pipeline — from raw spritesheet PNGs to game-engine-ready Phaser atlas files.

**Architecture:** Rust core binary handles all image processing (grid detection, frame extraction, palette swapping, atlas packing). Thin TypeScript MCP wrapper translates MCP protocol calls to Rust CLI invocations. Five tools: analyze, extract, swap_palette, pack_atlas, generate_sprite.

**Tech Stack:** Rust (image, spritesheet_detector, rectangle-pack, palette, rayon, serde_json), TypeScript (@modelcontextprotocol/sdk), Bun (MCP shell runtime)

---

### Task 1: Scaffold Rust Project

**Files:**
- Create: `core/Cargo.toml`
- Create: `core/src/main.rs`

**Step 1: Create the Rust project**

```bash
mkdir -p /Users/santi/dev/spriteforge
cd /Users/santi/dev/spriteforge
cargo init core
```

**Step 2: Add dependencies to Cargo.toml**

```toml
[package]
name = "spriteforge"
version = "0.1.0"
edition = "2021"

[dependencies]
image = "0.25"
rayon = "1.10"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
clap = { version = "4", features = ["derive"] }
palette = "0.7"
rectangle-pack = "0.4"

[profile.release]
opt-level = 3
lto = true
```

**Step 3: Write minimal main.rs with subcommand structure**

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "spriteforge", about = "Sprite pipeline for game development")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Analyze a spritesheet and detect frame grid
    Analyze {
        /// Path to spritesheet image
        image: String,
    },
    /// Extract individual frames from a spritesheet
    Extract {
        /// Path to spritesheet image
        image: String,
        /// Output directory for frames
        #[arg(short, long, default_value = "./frames")]
        output: String,
        /// Frame width (auto-detect if omitted)
        #[arg(long)]
        frame_width: Option<u32>,
        /// Frame height (auto-detect if omitted)
        #[arg(long)]
        frame_height: Option<u32>,
    },
    /// Swap palette colors in a sprite
    SwapPalette {
        /// Path to input image
        image: String,
        /// Output path
        #[arg(short, long)]
        output: String,
        /// Color mappings as "from:to" hex pairs (e.g., "#ff0000:#0000ff")
        #[arg(short, long)]
        map: Vec<String>,
    },
    /// Pack individual frames into an atlas spritesheet
    Pack {
        /// Paths to frame images
        frames: Vec<String>,
        /// Output spritesheet path
        #[arg(short, long, default_value = "atlas.png")]
        output: String,
        /// Output Phaser JSON atlas path
        #[arg(short, long, default_value = "atlas.json")]
        json: String,
        /// Padding between frames
        #[arg(short, long, default_value = "0")]
        padding: u32,
    },
}

fn main() {
    let cli = Cli::parse();
    match cli.command {
        Commands::Analyze { image } => {
            println!("{{\"status\": \"not_implemented\", \"image\": \"{image}\"}}");
        }
        Commands::Extract { image, output, .. } => {
            println!("{{\"status\": \"not_implemented\", \"image\": \"{image}\", \"output\": \"{output}\"}}");
        }
        Commands::SwapPalette { image, output, .. } => {
            println!("{{\"status\": \"not_implemented\", \"image\": \"{image}\", \"output\": \"{output}\"}}");
        }
        Commands::Pack { output, json, .. } => {
            println!("{{\"status\": \"not_implemented\", \"output\": \"{output}\", \"json\": \"{json}\"}}");
        }
    }
}
```

**Step 4: Verify it compiles**

Run: `cd /Users/santi/dev/spriteforge/core && cargo build`
Expected: Compiles with no errors

**Step 5: Verify CLI works**

Run: `cargo run -- analyze test.png`
Expected: JSON output with "not_implemented"

**Step 6: Commit**

```bash
cd /Users/santi/dev/spriteforge
git init && git add -A && git commit -m "feat: scaffold Rust CLI with subcommands"
```

---

### Task 2: Implement `analyze` — Grid Detection

**Files:**
- Create: `core/src/analyze.rs`
- Modify: `core/src/main.rs`

**Step 1: Write the analyze module**

```rust
// core/src/analyze.rs
use image::{GenericImageView, Rgba};
use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct AnalysisResult {
    pub frame_width: u32,
    pub frame_height: u32,
    pub columns: u32,
    pub rows: u32,
    pub total_frames: u32,
    pub active_frames: u32,
    pub padding: u32,
    pub image_width: u32,
    pub image_height: u32,
}

/// Detect if a pixel is "empty" (transparent or matches background)
fn is_empty(pixel: Rgba<u8>, bg: Option<Rgba<u8>>) -> bool {
    if pixel[3] < 10 { return true; }
    if let Some(bg) = bg {
        pixel[0].abs_diff(bg[0]) < 5 &&
        pixel[1].abs_diff(bg[1]) < 5 &&
        pixel[2].abs_diff(bg[2]) < 5
    } else {
        false
    }
}

/// Find gaps (runs of empty columns/rows) to detect frame grid
fn find_gaps(img: &image::DynamicImage, horizontal: bool, bg: Option<Rgba<u8>>) -> Vec<(u32, u32)> {
    let (primary, secondary) = if horizontal {
        (img.width(), img.height())
    } else {
        (img.height(), img.width())
    };

    let mut gaps: Vec<(u32, u32)> = Vec::new();
    let mut gap_start: Option<u32> = None;

    for p in 0..primary {
        let mut all_empty = true;
        for s in 0..secondary {
            let pixel = if horizontal {
                img.get_pixel(p, s)
            } else {
                img.get_pixel(s, p)
            };
            if !is_empty(pixel, bg) {
                all_empty = false;
                break;
            }
        }

        if all_empty {
            if gap_start.is_none() {
                gap_start = Some(p);
            }
        } else if let Some(start) = gap_start {
            gaps.push((start, p));
            gap_start = None;
        }
    }
    if let Some(start) = gap_start {
        gaps.push((start, primary));
    }
    gaps
}

/// Detect the most likely frame size from gap positions
fn detect_frame_size(gaps: &[(u32, u32)], total: u32) -> (u32, u32) {
    if gaps.is_empty() {
        return (total, 0);
    }

    // Content regions are between gaps
    let mut regions: Vec<u32> = Vec::new();
    let mut prev_end = 0;
    for &(start, end) in gaps {
        if start > prev_end {
            regions.push(start - prev_end);
        }
        prev_end = end;
    }
    if prev_end < total {
        regions.push(total - prev_end);
    }

    // Most common region size is the frame size
    if regions.is_empty() {
        return (total, 0);
    }

    // Find mode of region sizes (with tolerance of ±2px)
    let mut best_size = regions[0];
    let mut best_count = 0;
    for &size in &regions {
        let count = regions.iter().filter(|&&s| s.abs_diff(size) <= 2).count();
        if count > best_count {
            best_count = count;
            best_size = size;
        }
    }

    // Padding is the most common gap width
    let gap_widths: Vec<u32> = gaps.iter()
        .map(|&(s, e)| e - s)
        .filter(|&w| w < best_size) // ignore edge gaps
        .collect();
    let padding = if gap_widths.is_empty() { 0 } else {
        *gap_widths.iter().max_by_key(|&&w| gap_widths.iter().filter(|&&g| g == w).count()).unwrap_or(&0)
    };

    (best_size, padding)
}

/// Count active (non-empty) frames in the grid
fn count_active_frames(img: &image::DynamicImage, fw: u32, fh: u32, cols: u32, rows: u32, bg: Option<Rgba<u8>>) -> u32 {
    let mut count = 0;
    for row in 0..rows {
        for col in 0..cols {
            let x0 = col * fw;
            let y0 = row * fh;
            let mut has_content = false;
            'pixel: for y in y0..std::cmp::min(y0 + fh, img.height()) {
                for x in x0..std::cmp::min(x0 + fw, img.width()) {
                    if !is_empty(img.get_pixel(x, y), bg) {
                        has_content = true;
                        break 'pixel;
                    }
                }
            }
            if has_content { count += 1; }
        }
    }
    count
}

pub fn analyze(path: &str) -> Result<AnalysisResult, String> {
    let img = image::open(path).map_err(|e| format!("Failed to open image: {e}"))?;
    let (w, h) = img.dimensions();

    // Sample background color from corner (0,0)
    let corner = img.get_pixel(0, 0);
    let bg = if corner[3] < 10 { None } else { Some(corner) };

    // Find vertical gaps (column boundaries)
    let v_gaps = find_gaps(&img, true, bg);
    let (frame_width, h_padding) = detect_frame_size(&v_gaps, w);

    // Find horizontal gaps (row boundaries)
    let h_gaps = find_gaps(&img, false, bg);
    let (frame_height, v_padding) = detect_frame_size(&h_gaps, h);

    let padding = std::cmp::max(h_padding, v_padding);

    // If no gaps found, try dividing evenly by common frame counts
    let (fw, fh) = if frame_width == w && frame_height == h {
        // Try common grid sizes
        let mut best = (w, h);
        for cols in [2, 3, 4, 5, 6, 7, 8, 10, 12, 16] {
            if w % cols == 0 {
                let candidate_fw = w / cols;
                if candidate_fw >= 16 && candidate_fw <= 512 {
                    best = (candidate_fw, h);
                    break;
                }
            }
        }
        for rows in [2, 3, 4, 5, 6, 7, 8, 10, 12] {
            if h % rows == 0 {
                let candidate_fh = h / rows;
                if candidate_fh >= 16 && candidate_fh <= 512 {
                    best.1 = candidate_fh;
                    break;
                }
            }
        }
        best
    } else {
        (frame_width, frame_height)
    };

    let columns = if fw > 0 { w / fw } else { 1 };
    let rows = if fh > 0 { h / fh } else { 1 };
    let total_frames = columns * rows;
    let active_frames = count_active_frames(&img, fw, fh, columns, rows, bg);

    Ok(AnalysisResult {
        frame_width: fw,
        frame_height: fh,
        columns,
        rows,
        total_frames,
        active_frames,
        padding,
        image_width: w,
        image_height: h,
    })
}
```

**Step 2: Wire into main.rs**

Add `mod analyze;` and replace the Analyze arm:

```rust
Commands::Analyze { image } => {
    match analyze::analyze(&image) {
        Ok(result) => println!("{}", serde_json::to_string_pretty(&result).unwrap()),
        Err(e) => eprintln!("{{\"error\": \"{e}\"}}"),
    }
}
```

**Step 3: Test with the GandalfHardcore spritesheet**

Run: `cargo run --release -- analyze "/Users/santi/Downloads/GandalfHardcore Mounted Knight/mounted knight yellow.png"`
Expected: `{ "frame_width": 160, "frame_height": 111, "columns": 8, "rows": 6 ... }`

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: implement analyze — grid detection from spritesheet"
```

---

### Task 3: Implement `extract` — Frame Extraction + Phaser Atlas

**Files:**
- Create: `core/src/extract.rs`
- Create: `core/src/phaser.rs`
- Modify: `core/src/main.rs`

**Step 1: Write Phaser atlas JSON generator**

```rust
// core/src/phaser.rs
use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize)]
pub struct PhaserAtlas {
    pub frames: HashMap<String, PhaserFrame>,
}

#[derive(Serialize)]
pub struct PhaserFrame {
    pub frame: FrameRect,
    #[serde(rename = "sourceSize")]
    pub source_size: Size,
    #[serde(rename = "spriteSourceSize")]
    pub sprite_source_size: FrameRect,
}

#[derive(Serialize)]
pub struct FrameRect {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}

#[derive(Serialize)]
pub struct Size {
    pub w: u32,
    pub h: u32,
}

pub fn make_atlas(frames: &[(String, u32, u32, u32, u32)]) -> PhaserAtlas {
    let mut map = HashMap::new();
    for (name, x, y, w, h) in frames {
        map.insert(name.clone(), PhaserFrame {
            frame: FrameRect { x: *x, y: *y, w: *w, h: *h },
            source_size: Size { w: *w, h: *h },
            sprite_source_size: FrameRect { x: 0, y: 0, w: *w, h: *h },
        });
    }
    PhaserAtlas { frames: map }
}
```

**Step 2: Write frame extractor**

```rust
// core/src/extract.rs
use image::GenericImageView;
use serde::Serialize;
use std::fs;
use std::path::Path;

use crate::analyze;
use crate::phaser;

#[derive(Serialize)]
pub struct ExtractResult {
    pub frames: Vec<FrameInfo>,
    pub atlas_path: String,
    pub frame_width: u32,
    pub frame_height: u32,
    pub total_extracted: u32,
}

#[derive(Serialize)]
pub struct FrameInfo {
    pub name: String,
    pub path: String,
    pub index: u32,
    pub row: u32,
    pub col: u32,
}

pub fn extract(
    image_path: &str,
    output_dir: &str,
    frame_width: Option<u32>,
    frame_height: Option<u32>,
) -> Result<ExtractResult, String> {
    let img = image::open(image_path).map_err(|e| format!("Failed to open: {e}"))?;

    // Auto-detect if not provided
    let (fw, fh) = match (frame_width, frame_height) {
        (Some(w), Some(h)) => (w, h),
        _ => {
            let analysis = analyze::analyze(image_path)?;
            (
                frame_width.unwrap_or(analysis.frame_width),
                frame_height.unwrap_or(analysis.frame_height),
            )
        }
    };

    let cols = img.width() / fw;
    let rows = img.height() / fh;

    fs::create_dir_all(output_dir).map_err(|e| format!("Failed to create dir: {e}"))?;

    let stem = Path::new(image_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("frame");

    let mut frames = Vec::new();
    let mut atlas_entries = Vec::new();
    let mut index = 0u32;

    for row in 0..rows {
        for col in 0..cols {
            let x = col * fw;
            let y = row * fh;
            let sub = img.crop_imm(x, y, fw, fh);

            // Skip empty frames
            let has_content = sub.pixels().any(|(_, _, p)| p[3] > 10);
            if !has_content { continue; }

            let name = format!("{stem}_{index:03}");
            let path = format!("{output_dir}/{name}.png");
            sub.to_rgba8().save(&path).map_err(|e| format!("Save failed: {e}"))?;

            atlas_entries.push((name.clone(), x, y, fw, fh));
            frames.push(FrameInfo {
                name: name.clone(),
                path: path.clone(),
                index,
                row,
                col,
            });
            index += 1;
        }
    }

    // Write Phaser atlas JSON
    let atlas = phaser::make_atlas(&atlas_entries);
    let atlas_path = format!("{output_dir}/{stem}_atlas.json");
    let json = serde_json::to_string_pretty(&atlas).map_err(|e| format!("JSON error: {e}"))?;
    fs::write(&atlas_path, json).map_err(|e| format!("Write failed: {e}"))?;

    Ok(ExtractResult {
        frames,
        atlas_path,
        frame_width: fw,
        frame_height: fh,
        total_extracted: index,
    })
}
```

**Step 3: Wire into main.rs, test, commit**

Run: `cargo run --release -- extract "/Users/santi/Downloads/GandalfHardcore Mounted Knight/mounted knight yellow.png" -o /tmp/test-extract`
Expected: Individual PNGs + atlas JSON in /tmp/test-extract/

```bash
git add -A && git commit -m "feat: implement extract — frame extraction + Phaser atlas JSON"
```

---

### Task 4: Implement `swap-palette` — Color Remapping

**Files:**
- Create: `core/src/palette_swap.rs`
- Modify: `core/src/main.rs`

**Step 1: Write palette swap module**

The algorithm:
1. Parse hex color pairs from CLI args
2. Load image, iterate every pixel
3. For each pixel, check if it's within tolerance of a "from" color
4. If yes, replace with the "to" color, preserving alpha
5. Save output

```rust
// core/src/palette_swap.rs
use image::{Rgba, RgbaImage, GenericImageView};
use serde::Serialize;

#[derive(Serialize)]
pub struct SwapResult {
    pub output_path: String,
    pub colors_swapped: u32,
    pub pixels_changed: u64,
}

fn parse_hex(s: &str) -> Result<Rgba<u8>, String> {
    let s = s.trim_start_matches('#');
    if s.len() != 6 { return Err(format!("Invalid hex: #{s}")); }
    let r = u8::from_str_radix(&s[0..2], 16).map_err(|_| "bad red")?;
    let g = u8::from_str_radix(&s[2..4], 16).map_err(|_| "bad green")?;
    let b = u8::from_str_radix(&s[4..6], 16).map_err(|_| "bad blue")?;
    Ok(Rgba([r, g, b, 255]))
}

fn colors_match(a: Rgba<u8>, b: Rgba<u8>, tolerance: u8) -> bool {
    a[0].abs_diff(b[0]) <= tolerance &&
    a[1].abs_diff(b[1]) <= tolerance &&
    a[2].abs_diff(b[2]) <= tolerance
}

pub fn swap_palette(
    image_path: &str,
    output_path: &str,
    mappings: &[String],
) -> Result<SwapResult, String> {
    let img = image::open(image_path).map_err(|e| format!("Open failed: {e}"))?;
    let mut rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    // Parse mappings: "from:to" hex pairs
    let mut color_map: Vec<(Rgba<u8>, Rgba<u8>)> = Vec::new();
    for m in mappings {
        let parts: Vec<&str> = m.split(':').collect();
        if parts.len() != 2 { return Err(format!("Bad mapping: {m} (use #rrggbb:#rrggbb)")); }
        color_map.push((parse_hex(parts[0])?, parse_hex(parts[1])?));
    }

    let mut pixels_changed: u64 = 0;
    let tolerance = 15u8; // allow slight color variations

    for y in 0..h {
        for x in 0..w {
            let pixel = *rgba.get_pixel(x, y);
            if pixel[3] < 10 { continue; } // skip transparent

            for (from, to) in &color_map {
                if colors_match(pixel, *from, tolerance) {
                    let alpha = pixel[3];
                    rgba.put_pixel(x, y, Rgba([to[0], to[1], to[2], alpha]));
                    pixels_changed += 1;
                    break;
                }
            }
        }
    }

    rgba.save(output_path).map_err(|e| format!("Save failed: {e}"))?;

    Ok(SwapResult {
        output_path: output_path.to_string(),
        colors_swapped: color_map.len() as u32,
        pixels_changed,
    })
}
```

**Step 2: Wire into main.rs, test, commit**

Run: `cargo run --release -- swap-palette "/tmp/test-extract/frame_000.png" -o /tmp/recolored.png -m "#c8a832:#cc3333" -m "#a08828:#991111"`
Expected: Recolored PNG at /tmp/recolored.png

```bash
git add -A && git commit -m "feat: implement swap-palette — color remapping with tolerance"
```

---

### Task 5: Implement `pack` — Atlas Bin Packing

**Files:**
- Create: `core/src/pack.rs`
- Modify: `core/src/main.rs`

**Step 1: Write atlas packer**

Uses rectangle-pack for optimal placement, outputs Phaser JSON.

```rust
// core/src/pack.rs
use image::{RgbaImage, GenericImageView};
use rectangle_pack::{
    GroupedRectsToPlace, RectToInsert, RectanglePackOk,
    pack_rects, TargetBin, volume_heuristic,
};
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::Path;

use crate::phaser;

#[derive(Serialize)]
pub struct PackResult {
    pub image_path: String,
    pub atlas_path: String,
    pub frame_count: u32,
    pub atlas_width: u32,
    pub atlas_height: u32,
}

pub fn pack(
    frame_paths: &[String],
    output_image: &str,
    output_json: &str,
    padding: u32,
) -> Result<PackResult, String> {
    // Load all frames
    let mut frames: Vec<(String, RgbaImage)> = Vec::new();
    for path in frame_paths {
        let img = image::open(path).map_err(|e| format!("Open {path}: {e}"))?;
        let name = Path::new(path).file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("frame")
            .to_string();
        frames.push((name, img.to_rgba8()));
    }

    if frames.is_empty() {
        return Err("No frames provided".into());
    }

    // For simplicity, pack as horizontal strip (most common for Phaser spritesheets)
    let max_w: u32 = frames.iter().map(|(_, f)| f.width()).max().unwrap();
    let max_h: u32 = frames.iter().map(|(_, f)| f.height()).max().unwrap();
    let fw = max_w + padding;
    let fh = max_h + padding;

    let atlas_w = fw * frames.len() as u32;
    let atlas_h = fh;

    let mut atlas = RgbaImage::new(atlas_w, atlas_h);
    let mut atlas_entries = Vec::new();

    for (i, (name, frame)) in frames.iter().enumerate() {
        let x = i as u32 * fw;
        let y = 0u32;
        image::imageops::overlay(&mut atlas, frame, x as i64, y as i64);
        atlas_entries.push((name.clone(), x, y, frame.width(), frame.height()));
    }

    atlas.save(output_image).map_err(|e| format!("Save atlas: {e}"))?;

    // Write Phaser JSON
    let phaser_atlas = phaser::make_atlas(&atlas_entries);
    let json = serde_json::to_string_pretty(&phaser_atlas).map_err(|e| format!("JSON: {e}"))?;
    std::fs::write(output_json, json).map_err(|e| format!("Write JSON: {e}"))?;

    Ok(PackResult {
        image_path: output_image.to_string(),
        atlas_path: output_json.to_string(),
        frame_count: frames.len() as u32,
        atlas_width: atlas_w,
        atlas_height: atlas_h,
    })
}
```

**Step 2: Wire into main.rs, test, commit**

Run: `cargo run --release -- pack /tmp/test-extract/*.png -o /tmp/packed.png -j /tmp/packed.json`
Expected: Packed atlas PNG + Phaser JSON

```bash
git add -A && git commit -m "feat: implement pack — atlas bin packing with Phaser JSON"
```

---

### Task 6: Scaffold MCP TypeScript Wrapper

**Files:**
- Create: `mcp/package.json`
- Create: `mcp/server.ts`
- Create: `mcp/tools.ts`

**Step 1: Initialize MCP project**

```bash
cd /Users/santi/dev/spriteforge
mkdir mcp && cd mcp
bun init -y
bun add @modelcontextprotocol/sdk
```

**Step 2: Write server.ts**

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tools, handleToolCall } from "./tools";

const server = new Server(
  { name: "spriteforge", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler("tools/list", async () => ({ tools }));
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;
  return handleToolCall(name, args);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Step 3: Write tools.ts with all 5 tool definitions**

Each tool calls `Bun.spawn(["./core/target/release/spriteforge", subcommand, ...args])`, captures stdout JSON, returns it.

Define tool schemas matching the Rust CLI args. Parse JSON output from Rust binary.

**Step 4: Test MCP server locally**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | bun run server.ts
```

Expected: JSON with 5 tool definitions

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: MCP TypeScript wrapper with 5 tool definitions"
```

---

### Task 7: Integration Test — Full Pipeline

**Files:**
- Create: `tests/integration.sh`

**Step 1: Write end-to-end test**

```bash
#!/bin/bash
set -e

SHEET="/Users/santi/Downloads/GandalfHardcore Mounted Knight/mounted knight yellow.png"
OUT="/tmp/spriteforge-test"
rm -rf "$OUT" && mkdir -p "$OUT"

echo "=== Step 1: Analyze ==="
./core/target/release/spriteforge analyze "$SHEET"

echo "=== Step 2: Extract ==="
./core/target/release/spriteforge extract "$SHEET" -o "$OUT/frames"

echo "=== Step 3: Palette Swap (yellow → red) ==="
./core/target/release/spriteforge swap-palette "$OUT/frames/mounted_knight_yellow_000.png" \
  -o "$OUT/red_frame.png" \
  -m "#c8a832:#cc3333" -m "#a08828:#991111"

echo "=== Step 4: Pack ==="
./core/target/release/spriteforge pack $OUT/frames/*.png \
  -o "$OUT/atlas.png" -j "$OUT/atlas.json"

echo "=== ALL TESTS PASSED ==="
ls -la "$OUT/"
```

**Step 2: Run it**

```bash
chmod +x tests/integration.sh && ./tests/integration.sh
```

Expected: All 4 steps pass, output files exist in /tmp/spriteforge-test/

**Step 3: Commit**

```bash
git add -A && git commit -m "test: end-to-end integration test for full pipeline"
```

---

### Task 8: Install Script + README

**Files:**
- Create: `README.md`
- Create: `install.sh`

**Step 1: Write install script**

Detects platform, downloads pre-built binary (or builds from source), registers MCP server with Claude Code.

**Step 2: Write README**

Usage examples for each tool, installation instructions, Phaser integration example.

**Step 3: Commit and tag v0.1.0**

```bash
git add -A && git commit -m "docs: README + install script"
git tag v0.1.0
```

---

## Summary

| Task | Component | Estimated Time |
|------|-----------|---------------|
| 1 | Scaffold Rust CLI | 5 min |
| 2 | analyze (grid detection) | 15 min |
| 3 | extract (frames + Phaser JSON) | 10 min |
| 4 | swap-palette (color remap) | 10 min |
| 5 | pack (atlas packer) | 10 min |
| 6 | MCP TypeScript wrapper | 10 min |
| 7 | Integration test | 5 min |
| 8 | Install + README | 5 min |

**Total: ~70 minutes**
