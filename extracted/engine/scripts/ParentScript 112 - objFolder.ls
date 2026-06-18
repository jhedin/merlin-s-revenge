property ancestor, pContents, pSymbol, pParentFolder

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#symbol] = #none
  i[#parentFolder] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pParentFolder = params.parentFolder
  pSymbol = params.symbol
  pContents = []
end

on addContents me, theVal
  pContents.append(theVal)
end

on convertContents me
  convertedContents = [:]
  listedContent = []
  ind = 1
  repeat with nContent in pContents
    if ilk(nContent, #object) then
      nSym = nContent.getSymbol()
      if convertedContents[nSym] = VOID then
        convertedContents[nSym] = nContent.convertContents()
      else
        if listedContent.getPos(nSym) = 0 then
          exisitingContent = convertedContents[nSym]
          convertedContents[nSym] = []
          convertedContents[nSym].append(exisitingContent)
          listedContent.append(nSym)
        end if
        convertedContents[nSym].append(nContent.convertContents())
      end if
      ind = ind + 1
    end if
  end repeat
  if convertedContents.count > 0 then
    return convertedContents
  end if
  if pContents.count = 1 then
    return pContents[1]
  else
    return pContents
  end if
end

on convertToPropList me, thePropList
  thePropList = me.convertContents(thePropList)
  return thePropList
end

on getParentFolder me
  return pParentFolder
end

on getFolderWithSymbol me, theSym
  repeat with nContent in pContents
    if ilk(nContent, #object) then
      nSym = nContent.getSymbol()
      if nSym = theSym then
        return nContent
      end if
    end if
  end repeat
  put "objFolder.getFolderWithSymbol: folder not found: " & theSym
  halt()
end

on getSymbol me
  return pSymbol
end

on finish me
  repeat with nContent in pContents
    if ilk(nContent, #object) then
      nContent.finish()
    end if
  end repeat
  ancestor.finish()
end

on navigateTo me, thepath
  navFolder = me.getFolderWithSymbol(thepath[1])
  if thepath.count = 1 then
    return navFolder
  else
    return navFolder.navigateTo(thepath)
  end if
end

on printContents me, numTabs
  if numTabs = VOID then
    numTabs = 0
  end if
  tabTxt = EMPTY
  repeat with i = 1 to numTabs
    tabTxt = tabTxt & TAB
  end repeat
  put tabTxt & pSymbol & ">>"
  tabTxt = tabTxt & TAB
  numTabs = numTabs + 1
  repeat with nContent in pContents
    if ilk(nContent, #object) then
      nContent.printContents(numTabs + 1)
      next repeat
    end if
    put tabTxt & string(nContent)
  end repeat
end
