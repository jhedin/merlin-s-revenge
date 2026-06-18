on StringEliminateChars str, strChars
  strLenth = str.chars.count
  deleteList = []
  repeat with ch = 1 to strLenth
    nextChar = str.char[ch]
    if strChars contains nextChar then
      deleteList.append(ch)
    end if
  end repeat
  deleteLenth = deleteList.count
  repeat with de = deleteLenth down to 1
    nextCh = deleteList[de]
    delete str.char[nextCh]
  end repeat
  return str
end
