property ancestor, pFont, pimage, pText
global g

on new me
  ancestor = new(script("objMenuTitle"))
  i = me.modifyParams(#init)
  i[#font] = #menu
  i[#text] = "some text"
  return me
end

on init me, params
  ancestor.init(params)
  pFont = params.font
  pText = params.text
  pimage = me.makeImage()
end

on displayCentered me, x1, x2, yLoc
  mywidth = pimage.width
  xWidth = x2 - x1
  spaces = xWidth - mywidth
  leftSpace = spaces / 2
  xOffset = leftSpace
  xLoc = x1 + xOffset
  me.displayAtLoc(point(xLoc, yLoc))
end

on displayAtLoc me, theloc
  me.displayImageAtLoc(pimage, theloc)
end

on getImageHeight me
  return pimage.height
end

on getImageWidth me
  return pimage.width
end

on makeImage me
  theFont = g.collectionsMaster.getObject(#objFont, pFont)
  theImage = theFont.getString(pText)
  return theImage
end
