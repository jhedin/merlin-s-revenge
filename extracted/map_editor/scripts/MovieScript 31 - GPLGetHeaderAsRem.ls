on GPLGetHeaderAsRem
  licenceMem = member("Licence")
  newText = EMPTY
  repeat with i = 1 to licenceMem.lines.count
    nLine = licenceMem.line[i]
    nLine = "-- " & nLine & RETURN
    newText = newText & nLine
  end repeat
  newText = newText && RETURN && RETURN
  return newText
end
