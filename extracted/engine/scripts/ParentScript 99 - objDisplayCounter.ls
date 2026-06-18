property ancestor, pColour, pDisplayLoc, pFont, pLastValue, pNumDigits
global g, gGlobalDisplayLayer

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i.layer = gGlobalDisplayLayer
  i[#colour] = rgb(255, 255, 255)
  i[#displayLoc] = point(0, 0)
  return me
end

on init me, params
  ancestor.init(params)
  pColour = params.colour
  pDisplayLoc = params.displayLoc
  pFont = #numbers
  pLastValue = #none
  pNumDigits = 2
end

on displayValue me, newValue
  if newValue <> pLastValue then
    newString = string(newValue)
    addtostart = 1
    newString = StringAddChars(newString, pNumDigits, addtostart, "0")
    theFont = me.getFontObj()
    newImage = theFont.getString(newString)
    me.displayImageAtLoc(newImage, pDisplayLoc)
    me.setSpriteColor(pColour)
    pLastValue = newValue
  end if
end

on getDisplayWidth me
  theFont = me.getFontObj()
  charWidth = theFont.getCharWidth()
  mywidth = charWidth * pNumDigits
  return mywidth
end

on getFontObj me
  return g.collectionsMaster.getObject(#objFont, pFont)
end

on setDisplayLoc me, newLoc
  pDisplayLoc = newLoc
  me.setSpriteLoc(newLoc)
end

on updateValue me, newValue
  me.displayValue(newValue)
end
