on CastAddGPLHeaderToLinkedScripts theCast
  nummem = the number of castMembers of castLib theCast
  GPLHeader = GPLGetHeaderAsRem()
  repeat with i = 1 to nummem
    nMem = member(i, theCast)
    if nMem.fileName = EMPTY then
      next repeat
    end if
    nScriptText = nMem.scriptText
    if nScriptText = EMPTY then
      next repeat
    end if
    if GPLHeader.line[1] = nScriptText.line[1] then
      next repeat
    end if
    nScriptText = GPLHeader & nScriptText
    nMem.scriptText = nScriptText
  end repeat
end
