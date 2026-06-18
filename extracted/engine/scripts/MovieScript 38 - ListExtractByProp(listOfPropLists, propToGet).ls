on ListExtractByProp listOfPropLists, propToGet
  thelist = []
  repeat with prList in listOfPropLists
    thelist.append(prList[propToGet])
  end repeat
  return thelist
end
