property p, pc, pd, pk, pr, prb, prm, pm, pt, pf
global g

on new me
  return me
end

on init me
  p = [:]
  p[#currentPressed] = #none
  p[#defaultLayout] = #arrow
  p[#currentLayout] = #none
  p[#originalLayout] = #none
  p[#formatting] = [:]
  pf = p.formatting
  pf[#columns] = [14, 7, 35]
  p[#configs] = [:]
  pc = p.configs
  pc[#Blank] = [:]
  pcb = pc.Blank
  pcb = [#up: -1, #dwn: -1, #lft: -1, #rght: -1, #cutHair: -1, #growHair: -1, #newBat: -1, #newGoblin: -1, #newGoblinSoldier: -1, #newSpider: -1]
  pc[#arrow] = pcb.duplicate()
  pcw = pc.arrow
  pcw.up = 126
  pcw.dwn = 125
  pcw.lft = 123
  pcw.rght = 124
  pcw.cutHair = 8
  pcw.growHair = 7
  pcw.newGoblin = 9
  pcw.newGoblinSoldier = 11
  pcw.newSpider = 45
  pcw.newBat = 46
  p[#Keys] = [:]
  pk = p.Keys
  p[#results] = [:]
  pr = p.results
  pr[#moveVector] = [0, 0]
  pr[#cutHair] = 0
  pr[#growHair] = 0
  pr[#newGoblin] = 0
  prb = pr.duplicate()
  pr[#moveVectors] = [:]
  prm = pr.moveVectors
  prm[#up] = [0, -1]
  prm[#dwn] = [0, 1]
  prm[#lft] = [-1, 0]
  prm[#rght] = [1, 0]
  p[#descriptions] = pcb.duplicate()
  kd = [#nam: "keyName", #desc: EMPTY]
  pd = p.descriptions
  pd.up = [#nam: "up", #desc: EMPTY]
  pd.dwn = [#nam: "down", #desc: EMPTY]
  pd.rght = [#nam: "right", #desc: EMPTY]
  pd.lft = [#nam: "left", #desc: EMPTY]
  pd.cutHair = [#nam: "cut hair", #desc: "cut rapunzel's hair by one bit"]
  pd.growHair = [#nam: "grow hair", #desc: "grows rapunzel's hair by one bit"]
  pd.newGoblin = [#nam: "new goblin", #desc: "makes a new goblin"]
  pd.newGoblinSoldier = [#nam: "new gobsol", #desc: "makes a new goblin soldier"]
  pd.newSpider = [#nam: "new spider", #desc: "makes a new spider"]
  pd.newBat = [#nam: "new bat", #desc: "makes a new bat"]
  p[#textConversion] = ["s", "d", "f", "h", "g", "z", "x", "c", "v", 0, "b", "q", "w", "e", "r", "y", "t", "1", "2", "3", "4", "6", "5", "=", "9", "7", "-", "8", "0", "]", "o", "u", "[", "i", "p", 0, "l", "j", "'", "k", ";", "\", ",", "/", "n", "m", ".", 0, "Space", "`"]
  pt = p.textConversion
  pt[60] = "Shift"
  pt[61] = "Alt"
  pt[62] = "Ctrl"
  pt[65] = "Num."
  pt[67] = "Num*"
  pt[69] = "Num+"
  pt[71] = "NumLock"
  pt[75] = "Num/"
  pt[78] = "Num-"
  pt[82] = "Num0"
  pt[83] = "Num1"
  pt[84] = "Num2"
  pt[85] = "Num3"
  pt[86] = "Num4"
  pt[87] = "Num5"
  pt[88] = "Num6"
  pt[89] = "Num7"
  pt[91] = "Num8"
  pt[92] = "Num9"
  pt[123] = "L.Arr"
  pt[124] = "R.Arr"
  pt[125] = "D.Arr"
  pt[126] = "U.Arr"
  pt[256] = "a"
  me.initKeys()
end

on initKeys me
  layout = getPref("rapunzelKeys.txt")
  if (layout = VOID) or (layout = "none") then
    layout = p.defaultLayout
  else
    layout = symbol(layout)
  end if
  me.changeLayout(layout)
end

on setKeys me, Keys
  pk = Keys
end

on checkKeys me
  pr = prb.duplicate()
  numkeys = pk.count
  repeat with ke = 1 to numkeys
    knum = pk[ke]
    if keyPressed(knum) then
      kNam = pk.getPropAt(ke)
      case kNam of
        #up, #dwn, #lft, #rght:
          pr.moveVector = pr.moveVector + prm[kNam]
        otherwise:
          if me.checkOnce(knum) then
            pr[kNam] = 1
          end if
      end case
    end if
  end repeat
  me.clearCurrentPressed()
end

on checkOnce me, knum
  keyOnce = 0
  if knum <> p.currentPressed then
    keyOnce = 1
  end if
  p.currentPressed = knum
  return keyOnce
end

on clearCurrentPressed me
  if p.currentPressed <> #none then
    if not keyPressed(p.currentPressed) then
      p.currentPressed = #none
    end if
  end if
end

on executeKeys me
  numResult = pr.count
  repeat with re = 1 to numResult
    resOn = pr[re]
    if resOn = 1 then
      rNam = pr.getPropAt(re)
      case rNam of
        #cycle, #spell1, #spell2, #spell3, #spell4:
          g.weaponGov.manualActivate(rNam)
        #gmg, #callBerlin:
          g.powerUpGov.manualActivate(rNam)
        #paws, #escape, #help:
          g.merlinMain.goHelpMenuMode()
        #sndToggle:
          g.soundmaster.toggle()
        #killall, #medikit, #invince:
          g.gamemaster.cheat(rNam)
      end case
    end if
  end repeat
end

on editKeysMode me
  p.originalLayout = p.currentLayout
  me.printKeys()
  me.printLayouts()
end

on getMoveVector me
  return pr.moveVector.duplicate()
end

on getKeyResult me, keySym
  return pr[keySym]
end

on printHelpKeys me
  originalMem = pm.keyPrint
  pm.keyPrint = pm.helpKeys
  me.printKeys()
  pm.keyPrint = originalMem
end

on printKeys me
  t = TAB
  r = RETURN
  memType = pm.keyPrint.type
  txt = EMPTY
  case memType of
    #field:
      txt = "Action:       Key:   Description:" & r
    #text:
      txt = txt & "The current keyboard controls are:" & r
      txt = txt & r & t & "Action:" & t & "Key:" & t & "Description:" & r
  end case
  numkeys = pd.count
  repeat with ke = 1 to numkeys
    propname = pd.getPropAt(ke)
    case propname of
      #killall, #goMapEd, #escape, #invince, #medikit:
        nothing()
      otherwise:
        nextKey = pd[ke]
        kCode = pk[propname]
        kTxt = pt[kCode]
        case memType of
          #field:
            textToFormat = [nextKey.nam, kTxt, nextKey.desc]
            numFormat = textToFormat.count
            repeat with te = 1 to numFormat
              nexttxt = StringAddChars(textToFormat[te], pf.columns[te], 0, " ")
              txt = txt & nexttxt
            end repeat
          #text:
            txt = txt & t & nextKey.nam & t & kTxt & t & nextKey.desc
        end case
        if propname <> #paws then
          txt = txt & r
        end if
    end case
  end repeat
  case memType of
    #text:
      txt = txt & r & r & "Hold down left mouse button to charge a spell, release to fire."
      txt = txt & r & "To choose a new keyboard layout, quit to the title screen and select 'Options'." & r & r
  end case
  pm.keyPrint.text = txt
end

on printLayouts me
  t = TAB
  r = RETURN
  txt = "Select Layout:"
  numLayouts = pc.count
  repeat with la = 1 to numLayouts
    lNam = pc.getPropAt(la)
    case lNam of
      #Blank:
      otherwise:
        lNam = string(lNam)
        lNam = StringAddChars(lNam, 14, 0, " ")
        txt = txt & r & lNam
    end case
  end repeat
  pm.layouts.text = txt
end

on update me
  mouMem = the mouseMember
  memToCheck = [#layouts]
  numMems = memToCheck.count
  repeat with m = 1 to numMems
    nextMemSym = memToCheck[m]
    nextMem = pm[nextMemSym]
    if nextMem = mouMem then
      mouline = the mouseLine
      if mouline > 1 then
        hilite nextMem.line[mouline]
        if g.mouse.mouse.click then
          selWord = nextMem.line[mouline].word[1]
          me.selectionMade(selWord)
        end if
      else
        hilite nextMem.line[99]
      end if
      next repeat
    end if
    hilite nextMem.line[99]
  end repeat
end

on selectionMade me, theWord
  theSym = symbol(theWord)
  isLayout = me.changeLayout(theSym)
end

on changeLayout me, sym
  found = 0
  numLayouts = pc.count
  repeat with co = 1 to pc.count
    nextName = pc.getPropAt(co)
    if nextName = sym then
      Keys = pc[co].duplicate()
      me.setKeys(Keys)
      p.currentLayout = sym
      found = 1
      exit repeat
    end if
  end repeat
  return found
end

on saveLayout me
  lay = string(p.currentLayout)
  setPref("rapunzelKeys.txt", lay)
end

on revertLayout me
  me.changeLayout(p.originalLayout)
end

on reportLayouts me
  layList = []
  numLay = pc.count
  repeat with l = 1 to numLay
    nName = pc.getPropAt(l)
    if nName <> #Blank then
      layList.append(nName)
    end if
  end repeat
  return layList
end

on reportCurrentLayout
  currSel = p.currentLayout
  return currSel
end

on stop me
  me.saveLayout()
end
