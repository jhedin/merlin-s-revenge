on TextAddRem theScriptMember
  theText = theScriptMember.scriptText
  newText = EMPTY
  repeat with i = 1 to theText.lines.count
    nLine = theText.line[i]
    if nLine.char[1..2] = "--" then
      nothing()
    else
      nLine = "-- " & nLine
    end if
    newText = newText & nLine & RETURN
  end repeat
  theScriptMember.scriptText = newText
end
