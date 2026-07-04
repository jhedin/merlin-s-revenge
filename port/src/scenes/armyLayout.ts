// showArmyMaster.setupDisplay + objUnitDisplayer.calcBoundingRect: the reserve-army screen's DYNAMIC
// reflow. Each unit's cell is sized from its REAL stand-sprite + level-stars dimensions (stars stacked
// above the unit sprite, `objUnitDisplayer.pYGap=4` between them) — not a uniform grid. Units flow
// left-to-right; a unit that doesn't fit the display rect's width wraps to a new row (the new row's y =
// the previous row's accumulated floor + `showArmyMaster.pXGap`... `.pYGap=8`); a row whose accumulated
// floor exceeds the display rect's bottom starts a new PAGE (can happen mid-row, if a tall unit's bounding
// rect alone pushes the floor over — the original allows this, so this does too).
//
// Pure and asset-free: callers supply real sprite/star sizes via `sizeOf`, so this is unit-testable with
// synthetic sizes and reusable at render time with the real bundled art.

export interface ArmyUnit { typ: string; team: string; level: number }
export interface UnitSize { unitW: number; unitH: number; starsW: number; starsH: number }
export interface PlacedUnit { unit: ArmyUnit; x: number; y: number; w: number; h: number; starsH: number }
export interface LayoutRect { left: number; top: number; right: number; bottom: number }

const X_GAP = 4;     // showArmyMaster.pXGap (between units, horizontally)
const ROW_GAP = 8;    // showArmyMaster.pYGap (between rows, vertically)
const UNIT_GAP = 4;   // objUnitDisplayer.pYGap (internal: stars-image to unit-sprite)
const STARS_GAP = 4;  // objMoveableLevelBar.pGapY, read via levelBar.getYGap() inside calcBoundingRect

/** paginate the reserve army into the display rect, faithfully reproducing showArmyMaster's reflow. */
export function layoutArmy(units: ArmyUnit[], rect: LayoutRect, sizeOf: (u: ArmyUnit) => UnitSize): PlacedUnit[][] {
  const pages: PlacedUnit[][] = [[]];
  let page = pages[0]!;
  let xLoc = rect.left, yLoc = rect.top, rowFloor = rect.top;

  for (const unit of units) {
    const { unitW, unitH, starsW, starsH } = sizeOf(unit);
    const boundW = Math.max(starsW, unitW);
    const boundH = (starsH + STARS_GAP) + (unitH + UNIT_GAP);

    // row wrap: this unit doesn't fit the remaining width on the current row. Faithful to the original's
    // unconditional check (no "unless first in row" guard) — a single unit wider than the whole display
    // rect would push down one wasted row in the original too; never happens with real bundled sprites.
    if (xLoc + boundW > rect.right) {
      yLoc = rowFloor + ROW_GAP;
      xLoc = rect.left;
      rowFloor = yLoc;
    }

    let boundBottom = yLoc + boundH;
    if (boundBottom > rowFloor) rowFloor = boundBottom;

    // page wrap: the row's accumulated floor now overflows the display rect's bottom (can trigger
    // mid-row, matching the original — a very tall unit's OWN bounding rect can push the floor over).
    if (rowFloor > rect.bottom) {
      const floorDistance = rowFloor - yLoc;
      yLoc = rect.top;
      // xLoc is deliberately left as-is (mid-row continuation onto the new page).
      page = []; pages.push(page);
      boundBottom = yLoc + boundH;
      rowFloor = yLoc + floorDistance;
    }

    page.push({ unit, x: xLoc, y: yLoc, w: boundW, h: boundH, starsH });
    xLoc += boundW + X_GAP;
  }
  return pages;
}
