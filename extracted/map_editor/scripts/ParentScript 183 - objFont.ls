property ancestor, pLetterKey, pLetterGap, pLetterSize, pName
global g

on new me
  ancestor = new(script("objTileSet"))
  i = me.modifyParams(#init)
  i[#member] = #none
  return me
end

on init me, params
  me.initLetterProperties(params)
  me.initParams(params)
  ancestor.init(params)
end

on initLetterProperties me, params
  letterMemName = params.member.name & "_properties"
  letterMem = member(letterMemName, "gfx")
  letterMemText = letterMem.text
  letterProperties = value(letterMemText)
  pLetterKey = letterProperties.theKey
  pLetterSize = letterProperties.charSize
  pLetterGap = letterProperties.gap
end

on initParams me, params
  letterImage = params.member.image
  params.allTilesImage = letterImage
  params.tilesize = pLetterSize
  return params
end

on getLetter me, theChar
  tileNum = me.getLetterNum(theChar)
  theImage = me.getTileNo(tileNum)
  return theImage
end

on getLetterNum me, theChar
  letterNum = StringGetPos(pLetterKey, theChar)
  return letterNum
end

on getString me, theString
  stringMap = me.getStringMap(theString)
  stringImage = me.getStringImage(stringMap)
  return stringImage
end

on getStringImage me, stringMap
  return stringMap.getImage()
end

on getStringMap me, theString
  strLen = theString.chars.count
  wordMap = g.objectMaster.requestObject(#objTileMap)
  params = wordMap.getParams(#init)
  params.tileSet = me
  params.mapSize = point(strLen, 1)
  wordMap.init(params)
  repeat with i = 1 to strLen
    nChr = theString.char[i]
    nNum = me.getLetterNum(nChr)
    if nNum > 0 then
      wordMap.poke(point(i, 1), nNum)
    end if
  end repeat
  return wordMap
end
