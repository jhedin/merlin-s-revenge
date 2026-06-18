property castsToExtract, clipStart, exFolder, fxObj, fioObj, maxFilePathLength, typesToExtract

on new me
  me.setDefaults()
  return me
end

on addNewLines me, scrText
  outText = EMPTY
  repeat with l = 1 to scrText.lines.count
    outText = outText & scrText.line[l] & numToChar(10)
  end repeat
  return outText
end

on clipFilePath me, filePath
  filePathLength = filePath.chars.count
  if filePathLength > me.maxFilePathLength then
    overrun = filePathLength - me.maxFilePathLength
    firstPart = chars(filePath, 1, clipStart)
    clipContinue = clipStart + overrun + 2
    lastPart = chars(filePath, clipContinue, filePathLength)
    filePath = firstPart & "_" & lastPart
    newFilePathLength = filePath.length
  end if
  return filePath
end

on createFile me, fName
  filePath = me.exFolder & fName
  openfile(fioObj, filePath, 0)
  delete(fioObj)
  createFile(fioObj, filePath)
end

on createInfoLine me, mem
  infoLine = [:]
  infoLine[#name] = mem.name
  if mem.type = #script then
    infoLine[#scriptType] = mem.scriptType
  end if
  infoLine[#type] = mem.type
  infoLine = string(infoLine)
  return infoLine
end

on createOrderFile me, castname
  orderFileName = castname & "_order.txt"
  fileList = []
  numMembers = the number of castMembers of castLib castname
  repeat with mem = 1 to numMembers
    nMem = member(mem, castname)
    nName = nMem.name
    nFileName = nName & ".txt"
    fileList.append(nFileName)
  end repeat
  fileList = me.formatListForHumans(fileList)
  filePath = me.exFolder & orderFileName
  me.createFile(orderFileName)
  me.writeToFile(orderFileName, fileList)
end

on extractAllCasts me
  numCasts = the number of castLibs
  repeat with c = 1 to numCasts
    castname = castLib(c).name
    me.extractCast(castname)
  end repeat
end

on extractCast me, castname
  fxObj.fx_FolderCreate(me.exFolder & castname)
  if castname = "master_objects" then
    me.createOrderFile(castname)
  end if
  nummem = the number of castMembers of castLib castname
  repeat with mem = 1 to nummem
    nextMem = member(mem, castname)
    if nextMem.type = #empty then
      next repeat
    end if
    if nextMem.name = "Palette 329" then
      nothing()
    end if
    if me.typeIsSkip(nextMem.type) then
      next repeat
    end if
    ext = EMPTY
    if (nextMem.type = #script) or (nextMem.type = #field) then
      ext = ext & ".txt"
    end if
    longFilePath = me.exFolder & castname & "\" & nextMem.name & ext
    longFilePath = me.omitFunctionParams(longFilePath)
    filePath = me.clipFilePath(longFilePath)
    openfile(fioObj, filePath, 0)
    delete(fioObj)
    createFile(fioObj, filePath)
    if (nextMem.type = #field) or (nextMem.type = #script) then
      openfile(fioObj, filePath, 0)
      mySaveString = "error"
      case nextMem.type of
        #field:
          mySaveString = nextMem.text
        #script:
          mySaveString = nextMem.scriptText
      end case
      if mySaveString = EMPTY then
        put "empty save string for member " & nextMem.name
        next repeat
      end if
      infoLine = me.createInfoLine(nextMem)
      mySaveString = infoLine & RETURN & mySaveString
      mySaveString = me.addNewLines(mySaveString)
      writeString(fioObj, mySaveString)
      closeFile(fioObj)
    end if
  end repeat
end

on extractSelectedCasts me
  repeat with castname in me.castsToExtract
    me.extractCast(castname)
  end repeat
end

on formatListForHumans me, thelist
  thelist = string(thelist)
  newlist = EMPTY
  numChars = thelist.chars.count
  repeat with chr = 1 to numChars
    nChar = thelist.char[chr]
    case nChar of
      ",", "[":
        nChar = nChar & RETURN
      "]":
        nChar = RETURN & nChar
    end case
    newlist = newlist & nChar
  end repeat
  return newlist
end

on omitFunctionParams me, filePath
  firstBracketPos = me.strPos("(", filePath)
  if firstBracketPos = #none then
    return filePath
  end if
  filePath = chars(filePath, 1, firstBracketPos)
  filePath = filePath & ").txt"
  return filePath
end

on strPos me, needle, haystack
  numChars = haystack.chars.count
  repeat with chr = 1 to numChars
    nChar = haystack.char[chr]
    if nChar = needle then
      return chr
    end if
  end repeat
  return #none
end

on typeIsSkip me, memberType
  typeIsSkip = 1
  if me.typesToExtract = #none then
    typeIsSkip = 0
  else
    repeat with typ in me.typesToExtract
      if typ = memberType then
        typeIsSkip = 0
      end if
    end repeat
  end if
  return typeIsSkip
end

on setCasts me, newVal
  me.castsToExtract = newVal
end

on setDefaults me
  me.castsToExtract = #none
  me.clipStart = 100
  me.exFolder = VOID
  me.maxFilePathLength = 127
  me.typesToExtract = #none
end

on setExFolder me, newVal
  me.exFolder = newVal
end

on setTypesToExtract me, newVal
  me.typesToExtract = newVal
end

on start me
  fxObj = xtra("FileXtra4").new()
  fioObj = new(xtra("FileIO"))
  put "Extracting movie"
  if ilk(me.exFolder, #void) then
    me.exFolder = fxObj.fx_FolderSelectDialog("Please select a folder to Extract into")
  else
    fxObj.fx_FolderCreate(me.exFolder)
  end if
  put "Chosen folder is " & exFolder
  if me.exFolder = EMPTY then
    put "No folder chosen, extractor will quit now."
    return 
  end if
  if me.castsToExtract = #none then
    me.extractAllCasts()
  else
    me.extractSelectedCasts()
  end if
  fxObj = 0
  fioObj = 0
end

on writeToFile me, fName, contents
  filePath = me.exFolder & fName
  openfile(fioObj, filePath, 0)
  writeString(fioObj, contents)
  closeFile(fioObj)
end
