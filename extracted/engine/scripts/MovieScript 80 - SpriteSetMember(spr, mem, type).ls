on SpriteSetMember spr, mem, type, keepSize
  if type = VOID then
    type = #gameChar
  end if
  if keepSize = VOID then
    keepSize = 0
  end if
  case type of
    #gameChar:
      spr.member = mem
      if keepSize = 0 then
        spr.width = mem.width
        spr.height = mem.height
      end if
      if spr.member.type = #bitmap then
        if spr.member.depth = 1 then
          spr.ink = 1
        else
          spr.ink = 36
        end if
      else
        spr.ink = 36
      end if
    #field:
      spr.member = mem
      spr.ink = 0
  end case
end
