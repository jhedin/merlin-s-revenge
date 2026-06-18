property castsToLoad, pErrorMem, pErrorS, pErrorSpr, fxObj, fioObj, lastDisplayed, loadFolder, outputMem, outputSpr, typesToLoad
global gIntroScript, gMapLoaded

on new me
  return me
end

on checkFilePathLength me, filePath
  numChars = filePath.chars.count
  if numChars > 127 then
    me.outputError("This file path is " & numChars & " characters long. The maximum length allowed (by the fileIO xtra, not by me) is 127 chars. Please move the whole MR Open folder closer to your drive root (eg. C:/merinOpen/ ) to avoid getting these errors. Thanking!")
  end if
end

on eraseCasts me
  repeat with cName in castsToLoad
    numMembers = the number of castMembers of castLib cName
    repeat with memNum = 1 to numMembers
      nMem = member(memNum, cName)
      nType = nMem.type
      if me.isTypeToLoad(nType) then
        erase(member(nMem))
      end if
    end repeat
  end repeat
end

on escapeSpaces me, filePath
  newFilePath = EMPTY
  repeat with c = 1 to filePath.chars.count
    chr = filePath.char[c]
    if chr = SPACE then
      newFilePath = newFilePath & "\"
    end if
    newFilePath = newFilePath & chr
  end repeat
  return newFilePath
end

on extractMemInfo me, nFileText
  memInfo = nFileText.line[1]
  memInfo = value(memInfo)
  if memInfo = VOID then
    memInfo = #none
  end if
  return memInfo
end

on formatLineEndings me, fileText
  nFileText = EMPTY
  repeat with c = 1 to fileText.chars.count
    chr = fileText.char[c]
    if chr = numToChar(10) then
      chr = RETURN
    end if
    nFileText = nFileText & chr
  end repeat
  return nFileText
end

on findPosOfFirstTextFile me, folderList
  pos = 1
  txtPos = -1
  repeat with f in folderList
    strLen = f.length
    ext = f.char[strLen - 3..strLen]
    if ext = ".txt" then
      txtPos = pos
      exit repeat
    end if
    pos = pos + 1
  end repeat
  return txtPos
end

on finish me
  outputSpr.member = member("dot", "gfx")
  outputSpr.loc = point(-1, -1)
  outputMem.erase()
  pErrorSpr.member = member("dot", "gfx")
  pErrorSpr.loc = point(-1, -1)
  pErrorMem.erase()
  updateStage()
end

on hasSpace me, filePath
  repeat with c = 1 to filePath.chars.count
    chr = filePath.char[c]
    if chr = SPACE then
      return 1
    end if
  end repeat
  return 0
end

on loadCasts me
  pErrorS = 0
  me.lastDisplayed = -100
  me.setUpOutput()
  me.eraseCasts()
  me.loadMembers()
  if pErrorS = 0 then
    me.finish()
  end if
  return pErrorS
end

on loadFileOrder me, castname
  fileList = []
  fName = castname & "_order.txt"
  fileListString = me.readFile(fName)
  fileListString = me.removeLineEndings(fileListString)
  fileList = value(fileListString)
  return fileList
end

on loadFiles me
  cutscene = me.loadFirstInDir("cut_scene_to_play\", "scr_cut_scene_to_play", "data")
  cutSceneToPlayAtEnd = me.loadFirstInDir("cut_scene_to_play_at_end\", "scr_cut_scene_to_play_at_end")
  cutSceneToPlayWhenWasted = me.loadFirstInDir("cut_scene_to_play_when_wasted\", "scr_cut_scene_to_play_when_wasted")
  mapToPlay = me.loadFirstInDir("map_to_play\", "dd_map_to_play", "gfx")
  if (cutscene = #none) and (mapToPlay = #none) then
    alert("Error: map nor cut-scene found" & RETURN & "Please move a map from " & QUOTE & "maps/works/ " & QUOTE & " to " & QUOTE & "map_to_play\" & QUOTE & "." & RETURN & "Or move a cut-scene from " & QUOTE & "cut_scenes\" & " to " & QUOTE & "cut_scene_to_play" & QUOTE & ".")
    halt()
  end if
  if mapToPlay = #none then
    gMapLoaded = 0
  else
    gMapLoaded = 1
  end if
  if cutscene = #none then
    gIntroScript = #none
  else
    gIntroScript = #cut_scene_to_play
  end if
end

on loadFirstInDir me, dirPath, memname, castname
  fxObj = xtra("FileXtra4").new()
  fioObj = new(xtra("FileIO"))
  fullPath = the moviePath & dirPath
  folderList = fxObj.fx_FolderToList(fullPath)
  firstFile = me.findPosOfFirstTextFile(folderList)
  if firstFile = -1 then
    return #none
  end if
  filePath = fullPath & folderList[firstFile]
  openfile(fioObj, filePath, 1)
  fileText = fioObj.readFile()
  if voidp(fileText) then
    alert("Map failed to load. Map path = " & filePath)
  else
    member(memname, castname).text = fileText
  end if
  fxObj = 0
  fioObj = 0
  return firstFile
end

on loadMembers me
  fxObj = xtra("FileXtra4").new()
  fioObj = new(xtra("FileIO"))
  repeat with nCast in me.castsToLoad
    pathToCast = me.loadFolder & "\" & nCast
    fileList = fxObj.fx_FolderToList(pathToCast)
    if nCast = "master_objects" then
      fileList = me.loadFileOrder("master_objects")
    end if
    numFilesInCast = fileList.count
    filesLoaded = 0
    repeat with nFile in fileList
      the itemDelimiter = "."
      numWords = nFile.items.count
      ext = nFile.item[numWords]
      if ext <> "txt" then
        next repeat
      end if
      filePath = pathToCast & "\" & nFile
      openfile(fioObj, filePath, 1)
      fileText = fioObj.readFile()
      if voidp(fileText) then
        me.outputError("Failed to load contents of file " & filePath)
        me.checkFilePathLength(filePath)
        next repeat
      else
      end if
      closeFile(fioObj)
      nFileText = me.formatLineEndings(fileText)
      memInfo = me.extractMemInfo(nFileText)
      if memInfo = #none then
        me.outputError("Info line not found in " & filePath & RETURN & "Please put something like this at the top of your file:" & RETURN & "[#name: " & QUOTE & "FunctionOrClassName" & QUOTE & ", #type:#script or #field, #scriptType: #parent or #movie or #none]")
        next repeat
      end if
      nFileText = me.removeMemInfo(nFileText)
      nCastLib = castLib(nCast)
      nMem = new(memInfo.type, nCastLib)
      nMem.name = memInfo.name
      if memInfo.type = #script then
        nMem.scriptType = memInfo.scriptType
      end if
      case memInfo.type of
        #field:
          nMem.text = nFileText
        #script:
          nMem.scriptText = nFileText
      end case
      me.updateFilesLoadedMessage(nCast, numFilesInCast, filesLoaded)
      filesLoaded = filesLoaded + 1
    end repeat
  end repeat
end

on isTypeToLoad me, nType
  isTypeToLoad = 0
  repeat with nTypeToLoad in me.typesToLoad
    if nType = nTypeToLoad then
      isTypeToLoad = 1
      exit repeat
    end if
  end repeat
  return isTypeToLoad
end

on output me, theMessage
  outputMem.text = theMessage
  updateStage()
end

on outputError me, theError
  pErrorS = 1
  pErrorMem.text = pErrorMem.text & RETURN & theError
  pErrorMem.height = 300
  pErrorSpr.height = 300
  updateStage()
end

on readFile me, fName
  filePath = loadFolder & "\" & fName
  openfile(fioObj, filePath, 1)
  fileText = fioObj.readFile()
  if voidp(fileText) then
    me.outputError("Failed to load contents of file " & filePath)
    me.checkFilePathLength(filePath)
  else
  end if
  closeFile(fioObj)
  return fileText
end

on removeLineEndings me, fileText
  nFileText = EMPTY
  repeat with c = 1 to fileText.chars.count
    chr = fileText.char[c]
    if (chr = numToChar(10)) or (chr = RETURN) then
      chr = EMPTY
    end if
    nFileText = nFileText & chr
  end repeat
  return nFileText
end

on removeMemInfo me, fileText
  newFileText = EMPTY
  lastLine = fileText.lines.count
  repeat with nLine = 2 to lastLine
    newFileText = newFileText & fileText.line[nLine] & RETURN
  end repeat
  return newFileText
end

on setCasts me, theCasts
  me.castsToLoad = theCasts
end

on setLoadFolder me, theFolder
  me.loadFolder = theFolder
end

on setUpOutput me
  me.outputMem = new(#field, castLib("temp"))
  me.outputSpr = sprite(1)
  me.outputSpr.member = outputMem
  me.outputSpr.loc = point(2, 0)
  me.outputMem.text = "output"
  me.outputMem.color = rgb(200, 200, 200)
  me.outputMem.font = "Verdana"
  me.outputMem.fontStyle = "bold"
  me.outputMem.fontSize = 10
  pErrorMem = new(#text, castLib("temp"))
  pErrorSpr = sprite(2)
  pErrorSpr.member = pErrorMem
  pErrorMem.text = "Errors:" & RETURN
  pErrorMem.color = rgb(255, 50, 50)
  pErrorSpr.loc = point(2, 20)
  pErrorMem.width = 620
  pErrorMem.height = 300
  pErrorSpr.width = 620
  pErrorSpr.height = 300
  pErrorMem.boxType = #scroll
  pErrorMem.font = "Verdana"
  pErrorMem.fontStyle = [#bold]
  pErrorMem.fontSize = 10
  updateStage()
end

on setTypesToLoad me, theTypes
  me.typesToLoad = theTypes
end

on trimChars me, theString, numChars
  endOfString = theString.chars.count
  lastWantedChar = endOfString - numChars
  newString = chars(theString, 1, lastWantedChar)
  return newString
end

on updateFilesLoadedMessage me, theCast, numFiles, filesLoaded
  percentLoaded = me.varPercent(filesLoaded, [1, numFiles])
  if me.VarDiff(percentLoaded, me.lastDisplayed) < 1 then
  else
    percentLoadedString = string(percentLoaded)
    percentLoadedString = me.trimChars(percentLoadedString, 5)
    me.output("loading " & theCast && percentLoadedString & "%")
    me.lastDisplayed = percentLoaded
  end if
end

on VarDiff me, var1, var2
  diff = max(var1, var2) - min(var1, var2)
  return diff
end

on VarMoreLess me, firV, secV
  if firV > secV then
    res = -1
  end if
  if firV < secV then
    res = 1
  end if
  if firV = secV then
    res = 0
  end if
  return res
end

on varPercent me, val, lRange
  if val < min(lRange[1], lRange[2]) then
    return 0
  else
    if val > max(lRange[1], lRange[2]) then
      return 100
    end if
  end if
  rangelength = me.VarDiff(lRange[1], lRange[2])
  strange = lRange[1] * 1.0
  rangedir = me.VarMoreLess(lRange[1], lRange[2])
  valpos = (val - strange) * 1.0
  valpercent = valpos / rangelength * 100 * rangedir
  return valpercent
end
