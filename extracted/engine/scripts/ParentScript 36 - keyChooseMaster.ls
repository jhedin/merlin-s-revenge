property pCurrentKeySet, pDescriptionsMember, pKeyBindings, pKeyCharDescriptionLength, pKeyDescriptions, pKeyFunctionDescriptionLength, pKeyMenu, pKeysByNum
global g, r, gErrorTrace

on new me
  return me
end

on init me
  pCurrentKeySet = #none
  pDescriptionsMember = member("keyDescriptions_locz150", "gfx")
  pDescriptionsMember.text = EMPTY
  pKeyCharDescriptionLength = 2
  pKeyFunctionDescriptionLength = 8
  pKeyMenu = #none
  me.initKeysByNum()
  me.retrieveKeyBindings()
  me.retrieveKeyDescriptions()
end

on initKeysByNum me
  pKeysByNum = ["s", "d", "f", "h", "g", "z", "x", "c", "v", 0, "b", "q", "w", "e", "r", "y", "t", "1", "2", "3", "4", "6", "5", "=", "9", "7", "-", "8", "0", "]", "o", "u", "[", "i", "p", 0, "l", "j", "'", "k", ";", "\", ",", "/", "n", "m", ".", 0, 0, "`"]
  pt = pKeysByNum
  pt[48] = "TaB"
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
end

on finish me
  if (ilk(pKeyMenu) <> #void) and (pKeyMenu <> #none) then
    pKeyMenu.finish()
  end if
end

on changeSelection me, newKeySet
  pCurrentKeySet = newKeySet
  me.displayCurrentKeySet()
end

on convertKeyNumToChar me, keyNum
  return pKeysByNum[keyNum]
end

on displayCurrentKeySet me
  dt = r & "The Current Keys are:" & r & r
  repeat with i = 1 to pKeyDescriptions.count
    nKeyDescription = pKeyDescriptions[i]
    nKeyFunction = pKeyDescriptions.getPropAt(i)
    nKeyNum = me.getKeyNum(pCurrentKeySet, nKeyFunction)
    nKeyChar = me.convertKeyNumToChar(nKeyNum)
    nKeyChar = StringAddChars(nKeyChar, pKeyCharDescriptionLength)
    nKeyFunction = StringAddChars(string(nKeyFunction), pKeyFunctionDescriptionLength)
    dt = dt & nKeyChar & " - " & nKeyDescription
    dt = dt & r
  end repeat
  pDescriptionsMember.text = dt
end

on getKeyNum me, keySet, keyFunction
  return pKeyBindings[keySet][keyFunction]
end

on menuOptionSelected me, theComm, theMenu
  case theComm of
    #cancel:
      me.finish()
      g.screenMaster.backAScreen()
    #Ok:
      g.keyMaster.setKeySet(pCurrentKeySet)
      me.finish()
      g.screenMaster.backAScreen()
    otherwise:
      me.changeSelection(theComm)
  end case
end

on retrieveCurrentKeySet me
  pCurrentKeySet = g.keyMaster.getCurrentKeySet()
end

on retrieveKeyBindings me
  pKeyBindings = [:]
  dataObjs = g.collectionsMaster.getCollection(#objKeyBinding)
  repeat with i = 1 to dataObjs.count
    nKeySet = dataObjs.getPropAt(i)
    nObj = dataObjs[i]
    pKeyBindings[nKeySet] = nObj.getData()
  end repeat
end

on retrieveKeyDescriptions me
  objData = g.collectionsMaster.getObject(#objKeyDescriptions, #all)
  pKeyDescriptions = objData.getData()
end

on start me, myloc
  me.startMenu(myloc)
  me.retrieveCurrentKeySet()
  me.displayCurrentKeySet()
end

on startMenu me, theloc
  defMember = member("dd_menu_keys", "gfx")
  pKeyMenu = g.controllerMaster.newObject(#menu, defMember, theloc)
  pKeyMenu.setRequester(me)
  pKeyMenu.setAutoClose(0)
end

on stop me
  me.finish()
end
