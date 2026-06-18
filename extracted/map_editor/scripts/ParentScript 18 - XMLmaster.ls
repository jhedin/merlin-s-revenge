global g, r

on new me
  return me
end

on init me
end

on interpretPropList me, thePropList
  XML = string(thePropList)
  return XML
end

on interpretXML me, theTxt
  if theTxt.char[1] = "[" then
    thePropList = value(theTxt)
  else
    theTxt = me.cleanText(theTxt)
    folders = me.extractValue(theTxt)
    thePropList = [:]
    thePropList[folders.getSymbol()] = folders.convertContents()
    folders.finish()
  end if
  return thePropList
end

on cleanText me, theTxt
  cleanText = EMPTY
  numLines = theTxt.lines.count
  repeat with i = 1 to numLines
    nLine = theTxt.line[i]
    nLine = me.removeLeadingSpaces(nLine)
    cleanText = cleanText & nLine & RETURN
  end repeat
  return cleanText
end

on constructEndString me, theSym
  endString = "</" & string(theSym) & ">"
  return endString
end

on constructStartString me, theSym
  startString = "<" & theSym & ">"
  return startString
end

on extractFirstSymbol me, theTxt
  symStart = StringGetPos(theTxt, "<") + 1
  symEnd = StringGetPos(theTxt, ">") + 1
  theSym = symbol(theTxt.char[symStart..symEnd])
  return theSym
end

on extractTextBetween me, theTxt, theSym
  startString = me.constructStartString(theSym)
  endString = me.constructEndString(theSym)
  lineCopy = 0
  extractedText = EMPTY
  numLines = theTxt.lines.count
  repeat with i = 1 to numLines
    nLine = theTxt.line[i]
    nWord = nLine.word[1]
    if nWord = endString then
      lineCopy = 0
    end if
    if lineCopy then
      extractedText = extractedText & nLine & RETURN
    end if
    if nWord = startString then
      lineCopy = 1
    end if
  end repeat
  return extractedText
end

on extractValue me, theText
  rootFolder = g.objectMaster.requestObject(#objFolder)
  params = rootFolder.getParams(#init)
  params.parentFolder = #none
  params.symbol = #ROOT
  rootFolder.init(params)
  currentFolder = rootFolder
  numLines = theText.lines.count - 1
  repeat with i = 1 to numLines
    nLine = theText.line[i]
    firstChar = nLine.char[1]
    if firstChar = "<" then
      secondChar = nLine.char[2]
      if secondChar = "/" then
        currentFolder = currentFolder.getParentFolder()
        next repeat
      end if
      nSymbol = me.extractFirstSymbol(nLine)
      newFolder = g.objectMaster.requestObject(#objFolder)
      params = newFolder.getParams(#init)
      params.parentFolder = currentFolder
      params.symbol = nSymbol
      newFolder.init(params)
      currentFolder.addContents(newFolder)
      currentFolder = newFolder
      next repeat
    end if
    currentFolder.addContents(value(nLine))
  end repeat
  return rootFolder
end

on XMLFromPropList me, thePropList
  XML = EMPTY
  repeat with i = 1 to thePropList.count
    nProp = thePropList.getPropAt(i)
    nValue = thePropList[i]
    nTag = string(nProp)
    XML = XML & "<" & nTag & ">" & r
    if ilk(nValue, #propList) then
      XML = XML & me.XMLFromPropList(nValue)
    else
      XML = XML & me.XMLValue(nValue, nTag)
    end if
    XML = XML & "</" & nTag & ">" & r
  end repeat
  return XML
end

on XMLItem me, theItem
  XML = EMPTY
  case ilk(theItem) of
    #symbol:
      itmStr = "#" & string(theItem)
    otherwise:
      itmStr = string(theItem)
  end case
  XML = XML & itmStr & r
  return XML
end

on XMLValue me, theValue, theTag
  XML = EMPTY
  if ilk(theValue, #linearList) then
    i = 1
    repeat with itm in theValue
      if ilk(itm, #propList) then
        if i > 1 then
          XML = XML & "</" & theTag & ">" & r
          XML = XML & "<" & theTag & ">" & r
        end if
        XML = XML & me.XMLFromPropList(itm)
      else
        XML = XML & me.XMLItem(itm)
      end if
      i = i + 1
    end repeat
  else
    XML = XML & me.XMLItem(theValue)
  end if
  return XML
end

on removeLeadingSpaces me, theLine
  numChars = theLine.chars.count
  lastSpace = 0
  repeat with i = 1 to numChars
    nChar = theLine.char[i]
    if nChar = " " then
      lastSpace = i
      next repeat
    end if
    exit repeat
  end repeat
  if lastSpace > 0 then
    theLine = theLine.char[lastSpace + 1..99]
  end if
  return theLine
end

on stop me
end
