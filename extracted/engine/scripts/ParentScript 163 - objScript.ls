property ancestor, pLineCounter, pTheScript
global g

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#member] = #none
  return me
end

on init me, params
  me.interpretScript(params.member.text)
  pLineCounter = CounterNew()
  pLineCounter.tim[2] = pTheScript.theLines.count
  ancestor.init(params)
end

on calcFirstLine me, theText, firstWord
  firstLine = TextGetLineNoWithFirstWord(theText, firstWord)
  if firstLine <> #none then
    firstLine = firstLine + 1
  end if
  return firstLine
end

on correctLineEndings me, theText
  originalDelimiter = the itemDelimiter
  the itemDelimiter = numToChar(10)
  numItems = theText.items.count
  numLines = theText.lines.count
  if numItems > 0 then
    newText = EMPTY
    repeat with i = 1 to theText.items.count
      nItem = theText.item[i]
      nItem = nItem & RETURN
      newText = newText & nItem
    end repeat
    theText = newText
  end if
  numLines = theText.lines.count
  the itemDelimiter = originalDelimiter
  return theText
end

on getNextLine me
  if pLineCounter.looped then
    return #finished
  end if
  nextLine = pTheScript.theLines[pLineCounter.theCount]
  counter(pLineCounter)
  return nextLine
end

on getPlayers me
  return pTheScript.players.duplicate()
end

on interpretScript me, theText
  theText = me.correctLineEndings(theText)
  pTheScript = g.structMaster.getStruct(#plotScript)
  me.interpretPlayers(theText)
  me.interpretLines(theText)
end

on interpretPlayers me, theText
  firstLine = me.calcFirstLine(theText, "characters")
  repeat with i = firstLine to theText.lines.count
    nLine = theText.line[i]
    if nLine.word[1] = EMPTY then
      next repeat
    end if
    if nLine.word[1] = "lines" then
      exit repeat
    end if
    nScriptPlayer = g.structMaster.getStruct(#scriptPlayer)
    nScriptPlayer.objCharacter = value(nLine.word[1])
    nScriptPlayer.scriptname = nLine.word[3]
    pTheScript.players.append(nScriptPlayer.duplicate())
  end repeat
end

on interpretLines me, theText
  firstLine = me.calcFirstLine(theText, "lines")
  repeat with i = firstLine to theText.lines.count
    nLine = theText.line[i]
    if nLine.word[1] = EMPTY then
      next repeat
    end if
    nScriptLine = g.structMaster.getStruct(#scriptLine)
    nScriptLine.objCharacter = me.translateScriptNameToObjCharacter(nLine.word[1])
    nScriptLine.theCommand = me.interpretLineCommand(nLine.word[1], nLine.word[2])
    nScriptLine.args = me.interpretLineArgs(nScriptLine.theCommand, nLine)
    pTheScript.theLines.append(nScriptLine)
  end repeat
end

on interpretLineArgs me, theCommand, theLine
  case theCommand of
    #at:
      return value(theLine.word[3..theLine.words.count])
    #atPlayer:
      return me.translateScriptNameToObjCharacter(theLine.word[3])
    #backgroundColour, #backgroundColourTo:
      return value(theLine.word[2..theLine.words.count])
    #backgroundColourRandomFlash:
      return value(theLine.word[2])
    #fadeDown:
      return value(theLine.word[3])
    #goMode:
      return value(theLine.word[3])
    #playMusic:
      return me.interpretLineArgsPlayMusic(theLine)
    #PlaySound:
      return me.interpretLineArgsPlaySound(theLine)
    #produceProp:
      return me.translateScriptNameToObjCharacter(theLine.word[3])
    #propAt:
      return value(theLine.word[3..theLine.words.count])
    #showTitle:
      return theLine.word[2..theLine.words.count]
    #teleportInAt:
      return value(theLine.word[3..theLine.words.count])
    #turnToFace:
      return me.translateScriptNameToObjCharacter(theLine.word[3])
    #speakLine:
      return theLine.word[2..theLine.words.count]
    #walkTo:
      return value(theLine.word[3..theLine.words.count])
    #walkToPlayer:
      return me.translateScriptNameToObjCharacter(theLine.word[3])
    #walkScroll:
      return me.interpretLineArgsWalkScroll(theLine)
    #wait:
      return value(theLine.word[2..theLine.words.count])
  end case
end

on interpretLineArgsPlayMusic me, theLine
  return me.interpretLineArgsPlaySound(theLine)
end

on interpretLineArgsPlaySound me, theLine
  memberToPlay = theLine.word[2]
  volumeLevel = value(theLine.word[3])
  if volumeLevel = VOID then
    volumeLevel = 255
  end if
  args = g.structMaster.getStruct(#playSoundArgs)
  args.memberToPlay = memberToPlay
  args.volumeLevel = volumeLevel
  return args
end

on interpretLineArgsWalkScroll me, theLine
  Dir = symbol(theLine.word[2])
  speed = value(theLine.word[3])
  characters = me.translateScriptNamesToCharacterList(theLine.word[4..theLine.words.count])
  args = g.structMaster.getStruct(#walkScrollArgs)
  args.Dir = Dir
  args.speed = speed
  args.characters = characters
  return args
end

on interpretLineCommand me, lineWord1, lineWord2
  if lineWord1.char[lineWord1.chars.count] = ":" then
    return #speakLine
  end if
  if me.translateScriptNameToObjCharacter(lineWord1) <> #none then
    return symbol(lineWord2)
  end if
  return symbol(lineWord1)
end

on reset me
  pLineCounter = CounterReset(pLineCounter)
end

on translateScriptNamesToCharacterList me, nameString
  numOfWords = nameString.words.count
  characterList = []
  repeat with i = 1 to numOfWords
    nScriptName = nameString.word[i]
    nCharacterName = me.translateScriptNameToObjCharacter(nScriptName)
    characterList.append(nCharacterName)
  end repeat
  return characterList
end

on translateScriptNameToObjCharacter me, scriptname
  thePlayers = pTheScript.players
  if scriptname.char[scriptname.chars.count] = ":" then
    scriptname = scriptname.char[1..scriptname.chars.count - 1]
  end if
  pos = ListGetPosByProp(thePlayers, #scriptname, scriptname)
  if pos = 0 then
    return #none
  else
    return thePlayers[pos].objCharacter
  end if
end
