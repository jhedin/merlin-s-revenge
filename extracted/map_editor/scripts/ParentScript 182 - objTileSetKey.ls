property ancestor, pDefinition, pMember
global g

on new me
  ancestor = new(script("objTileSet"))
  i = me.modifyParams(#init)
  i[#member] = #none
  return me
end

on init me, params
  pDefinition = g.structMaster.getStruct(#tileSetDefinition)
  pMember = params.member
  me.interpretDefinition()
  me.initParams(params)
  ancestor.init(params)
end

on initParams me, params
  params.allTilesImage = params.member.image
  params.tilesize = pDefinition.tilesize
  params.displayScale = pDefinition.displayScale
end

on extractDefinitionValue me, theLine
  pipePos = StringGetPos(theLine, "|")
  theValue = value(theLine.char[pipePos + 2..99])
  return theValue
end

on getTileNum me, theSymbol
  return pDefinition.theKey[theSymbol]
end

on getTileSymbol me, theloc
  tileNum = 0
  tileNum = tileNum + (me.pSizeInTiles[2] * (theloc[2] - 1))
  tileNum = tileNum + theloc[1]
  tileSymbol = pDefinition.theKey.getPropAt(tileNum)
  return tileSymbol
end

on interpretDefinition me
  defTxt = member(pMember.name & "_key", "gfx").text
  numLines = defTxt.lines.count
  tileNo = 1
  repeat with i = 1 to numLines
    nLine = defTxt.line[i]
    firstWord = nLine.word[1]
    case firstWord of
      "--":
        continue()
      "tileSize":
        pDefinition.tilesize = me.extractDefinitionValue(nLine)
      "displayScale":
        pDefinition.displayScale = me.extractDefinitionValue(nLine)
      otherwise:
        pDefinition.theKey[value(nLine)] = tileNo
        tileNo = tileNo + 1
    end case
  end repeat
end
