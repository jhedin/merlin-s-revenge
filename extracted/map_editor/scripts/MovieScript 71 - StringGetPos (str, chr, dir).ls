on StringGetPos str, chr, Dir
  strLenth = str.chars.count
  pos = 0
  if Dir = -1 then
    c = strLenth
  else
    c = 1
    Dir = 1
  end if
  chr = chr.char[1]
  repeat with ch = 1 to strLenth
    nextChar = str.char[c]
    if nextChar = chr then
      pos = c
      exit repeat
    end if
    c = c + Dir
  end repeat
  return pos
end
