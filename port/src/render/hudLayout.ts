// HUD layout math, factored out so on-screen PLACEMENT is testable against the cast's numbers (placement
// parity — see AUDIT-CHARTER §6). Positions here mirror the original displayers' setLoc/rect arithmetic.

export interface MedikitLayout {
  icon: { x: number; y: number };           // on/off medikit member (top-left)
  bar: { x: number; y: number; w: number; h: number }; // active kit's vertical energy bar
  counter: { x: number; y: number };         // numeric banked-count (objDisplayCounter)
}

// objMedikitDisplayer (objMedikitDisplayer.txt:41-113): a HORIZONTAL composite, NOT a row of icons —
//   [ icon ][ pSpacer ][ energy bar (pEnergyBarWidth, height = icon height) ][ pSpacer ][ counter ].
//   ebRect.left = displayLoc.h + onMember.width + pSpacer;  ebRect.right = left + pEnergyBarWidth
//   counter.h   = ebRect.right + pSpacer;  counter.v = displayLoc.v + pVerticalSpacerForDisplayCounter
// Cast constants: pSpacer=1 (:46), pEnergyBarWidth=6 (:42), pVerticalSpacerForDisplayCounter=3 (:47).
export function medikitLayout(
  x: number, y: number,
  iconW = 16, iconH = 16, spacer = 1, barW = 6, vSpacer = 3,
): MedikitLayout {
  const barX = x + iconW + spacer;
  return {
    icon: { x, y },
    bar: { x: barX, y, w: barW, h: iconH },
    counter: { x: barX + barW + spacer, y: y + vSpacer },
  };
}
