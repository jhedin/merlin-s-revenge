property pMouseArea, pMouseLoc, pMouseState

on new me
  return me
end

on init me
  me.initMouseArea()
  pMouseLoc = the mouseLoc
  pMouseState = #notPressed
end

on initMouseArea me
  mouseBorder = 20
  mouseArea = rect(0, 0, 0, 0)
  mouseArea.bottom = (the stage).rect.height
  mouseArea.right = (the stage).rect.width
  mouseArea = mouseArea.inflate(mouseBorder, mouseBorder)
  pMouseArea = mouseArea
end

on finish me
end

on checkMouse me
  pMouseLoc = the mouseLoc
  mousePressed = the mouseDown
  if me.checkMouseInScreen() = 0 then
    mousePressed = 0
    return 
  end if
  if mousePressed then
    pMouseState = #pressed
  else
    if pMouseState = #pressed then
      pMouseState = #released
    else
      pMouseState = #notPressed
    end if
  end if
end

on checkMouseInScreen me
  if pMouseLoc.inside(pMouseArea) then
    return 1
  end if
  return 0
end

on getMouseLoc me
  return pMouseLoc
end

on getMouseState me
  return pMouseState
end

on start me
end

on stop me
  me.finish()
end
