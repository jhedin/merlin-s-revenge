property fxObj, fioObj
global g

on new me
  return me
end

on init me
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

on getListOfTextFilePos me, folderList
  poslist = []
  pos = 1
  txtPos = -1
  repeat with f in folderList
    strLen = f.length
    ext = f.char[strLen - 3..strLen]
    if ext = ".txt" then
      txtPos = pos
      poslist.append(pos)
    end if
    pos = pos + 1
  end repeat
  return poslist
end

on loadFiles me
  me.loadFirstInDir("map_to_play\", "dd_map_to_play", "gfx")
end

on loadAllInDir me, dirPath
  fxObj = xtra("FileXtra4").new()
  fioObj = new(xtra("FileIO"))
  fullPath = the moviePath & dirPath
  folderList = fxObj.fx_FolderToList(fullPath)
  textFiles = me.getListOfTextFilePos(folderList)
  if textFiles.count() = 0 then
    put "Error: no maps found"
    halt()
  end if
  Files = []
  repeat with num in textFiles
    f = folderList[num]
    filePath = fullPath & f
    openfile(fioObj, filePath, 1)
    fileText = fioObj.readFile()
    strLen = f.length
    mapName = f.char[1..strLen - 4]
    memname = "dd_map_" & mapName
    fileMem = g.memberMaster.requestMember(#field, memname)
    fileMem.text = fileText
    Files.append(mapName)
    closeFile(fioObj)
  end repeat
  fxObj = 0
  fioObj = 0
  return Files
end

on loadFirstInDir me, dirPath, memname, castname
  fxObj = xtra("FileXtra4").new()
  fioObj = new(xtra("FileIO"))
  fullPath = the moviePath & dirPath
  folderList = fxObj.fx_FolderToList(fullPath)
  firstFile = me.findPosOfFirstTextFile(folderList)
  if firstFile = -1 then
    put "Error: map not found"
    halt()
  end if
  filePath = fullPath & folderList[firstFile]
  openfile(fioObj, filePath, 1)
  fileText = fioObj.readFile()
  member(memname, castname).text = fileText
  closeFile(fioObj)
  fxObj = 0
  fioObj = 0
  return folderList[firstFile]
end

on saveToFile me, filePath, themem, theCast
  theText = member(themem, theCast).text
  fioObj = new(xtra("FileIO"))
  fullPath = the moviePath & filePath
  openfile(fioObj, fullPath, 2)
  writeString(fioObj, theText)
  if error(fioObj, status(fioObj)) <> "OK" then
    alert("Save Attempted" & RETURN & "Status: " & error(fioObj, status(fioObj)))
  end if
  closeFile(fioObj)
  fioObj = 0
end

on stop me
end
