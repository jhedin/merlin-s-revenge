property pParams

on new me
  return me
end

on init me
  numImages = the number of castMembers of castLib "temp"
  repeat with i = 1 to numImages
    member(i, "temp").erase()
  end repeat
  pParams = [:]
  pParams[#requestTextMember] = [:]
  rtm = pParams.requestTextMember
  rtm[#alignment] = #center
  rtm[#color] = rgb(255, 255, 255)
  rtm[#font] = "Arial"
  rtm[#fontSize] = 10
  rtm[#fontStyle] = [#plain]
  rtm[#name] = "textMember"
  rtm[#width] = 300
end

on freeMember me, theMember
  theMember.erase()
end

on getParams me, theFunction
  return pParams[theFunction].duplicate()
end

on requestMember me, theType, thename
  imageMem = new(theType, castLib("temp"))
  if thename <> VOID then
    imageMem.name = thename
  end if
  return imageMem
end

on requestTextMember me, params
  textMember = new(#text, castLib("temp"))
  textMember.alignment = params.alignment
  textMember.name = params.name
  textMember.font = params.font
  textMember.fontSize = params.fontSize
  textMember.fontStyle = params.fontStyle
  textMember.color = params.color
  textMember.width = params.width
  return textMember
end

on stop me
end
