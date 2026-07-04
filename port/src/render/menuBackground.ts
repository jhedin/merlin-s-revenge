// Helper to draw the authentic tiled parchment scroll box from the #menu tileset (tlk_menu).
// This matches objMenu.plotTileMapOutline from the original game.

import type { Renderer } from "./renderer";
import type { Assets } from "./assets";

export function drawScrollBox(
  renderer: Renderer,
  assets: Assets,
  x: number, // center X
  y: number, // center Y
  w: number, // width in pixels
  h: number, // height in pixels
  hasTitle = false,
  dividers?: number[]
): { x: number; y: number; w: number; h: number } {
  const ctx = renderer.ctx;
  const ts = assets.index?.tilesets?.["#menu"];
  if (!ts) {
    // fallback if tileset isn't loaded: draw a simple rect
    const startX = Math.round(x - w / 2);
    const startY = Math.round(y - h / 2);
    ctx.fillStyle = "#e0cfb3";
    ctx.fillRect?.(startX, startY, w, h);
    return { x: startX, y: startY, w, h };
  }

  const img = assets.img(ts.file);
  const tile = ts.tile; // 16
  const tcols = ts.cols; // 3

  const cols = Math.max(3, Math.ceil(w / tile));
  const rows = Math.max(3, Math.ceil(h / tile));

  const actualW = cols * tile;
  const actualH = rows * tile;

  const startX = Math.round(x - actualW / 2);
  const startY = Math.round(y - actualH / 2);

  const drawTile = (tileIndex: number, dx: number, dy: number) => {
    const sx = (tileIndex % tcols) * tile;
    const sy = Math.floor(tileIndex / tcols) * tile;
    ctx.drawImage(img, sx, sy, tile, tile, dx, dy, tile, tile);
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let tileIndex = 4; // #middleCenter (index 4)
      if (c === 0) {
        if (r === 0) tileIndex = 0; // #topLeft
        else if (r === rows - 1) tileIndex = 9; // #bottomLeft
        else tileIndex = 3; // #middleLeft
      } else if (c === cols - 1) {
        if (r === 0) tileIndex = 2; // #topRight
        else if (r === rows - 1) tileIndex = 11; // #bottomRight
        else tileIndex = 5; // #middleRight
      } else {
        if (r === 0) tileIndex = 1; // #topCenter
        else if (r === rows - 1) tileIndex = 10; // #bottomCenter
        else {
          if ((hasTitle && r === 2) || dividers?.includes(r)) tileIndex = 7; // #dividerCenter
          else tileIndex = 4; // #middleCenter
        }
      }

      // Draw the divider ends
      if ((hasTitle && r === 2) || dividers?.includes(r)) {
        if (c === 0) tileIndex = 6; // #dividerLeft
        else if (c === cols - 1) tileIndex = 8; // #dividerRight
      }

      drawTile(tileIndex, startX + c * tile, startY + r * tile);
    }
  }

  return { x: startX, y: startY, w: actualW, h: actualH };
}
