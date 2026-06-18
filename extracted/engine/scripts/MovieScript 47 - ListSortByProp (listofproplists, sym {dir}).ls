on ListSortByProp thelist, sym, Dir
  thelenth = thelist.count
  vallist = []
  repeat with en = 1 to thelenth
    vallist.append(thelist[en][sym])
  end repeat
  sort(vallist)
  if Dir = -1 then
    vallist = ListReverseList(vallist)
  end if
  newlist = []
  repeat with en = 1 to thelenth
    nextprop = thelist[en]
    propval = nextprop[sym]
    posinindex = vallist.getPos(propval)
    available = 0
    repeat while available = 0
      available = checkAvailable(posinindex, newlist)
      if available then
        exit repeat
      end if
      posinindex = posinindex + 1
    end repeat
    newlist[posinindex] = nextprop
  end repeat
  return newlist
end

on checkAvailable pos, thelist
  thelenth = thelist.count
  av = 0
  if pos > thelenth then
    av = 1
  else
    if thelist[pos] = 0 then
      av = 1
    end if
  end if
  return av
end
