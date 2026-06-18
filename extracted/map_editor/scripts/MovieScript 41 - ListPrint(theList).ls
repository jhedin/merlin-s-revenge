on ListPrint thelist, tabs
  if tabs = VOID then
    tabs = 1
  end if
  propname = EMPTY
  bProp = 0
  if ilk(thelist, #propList) then
    bProp = 1
  end if
  thelenth = thelist.count
  repeat with li = 1 to thelenth
    nextItem = thelist[li]
    if bProp then
      propname = thelist.getPropAt(li)
    end if
    tabText = EMPTY
    repeat with ta = 1 to tabs
      tabText = tabText & TAB
    end repeat
    itemType = #nList
    if ilk(nextItem, #list) then
      if ilk(nextItem, #point) = 0 then
        itemType = #alist
      end if
    end if
    if itemType = #alist then
      itemText = "["
    else
      itemText = string(nextItem)
    end if
    nextLine = tabText & propname & ": " & itemText
    put nextLine
    if itemType = #alist then
      ListPrint(nextItem, tabs + 1)
    end if
  end repeat
end
