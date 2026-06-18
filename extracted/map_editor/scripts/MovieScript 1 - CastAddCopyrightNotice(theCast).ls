on CastAddCopyrightNotice theCast
  nummem = the number of castMembers of castLib theCast
  copyrightNotice = member("Copyright Notice").text
  repeat with i = 1 to nummem
    nMember = member(i, theCast)
    if nMember.fileName = EMPTY then
      next repeat
    end if
    nScriptText = nMember.scriptText
    if nScriptText.line[1] = copyrightNotice.line[1] then
      next repeat
    end if
    nScriptText = copyrightNotice & nScriptText & RETURN & RETURN
    nMember.scriptText = nScriptText
  end repeat
end
