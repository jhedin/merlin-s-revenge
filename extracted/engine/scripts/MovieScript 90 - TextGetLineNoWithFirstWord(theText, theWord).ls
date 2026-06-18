on TextGetLineNoWithFirstWord theText, theWord
  lineNo = #none
  repeat with i = 1 to theText.lines.count
    nLine = theText.line[i]
    nFirstWord = nLine.word[1]
    if nFirstWord = theWord then
      lineNo = i
      exit repeat
    end if
  end repeat
  return lineNo
end
