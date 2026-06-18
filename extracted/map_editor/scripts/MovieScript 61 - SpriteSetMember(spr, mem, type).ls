on SpriteSetMember spr, mem, type
  if type = VOID then
    type = #gameChar
  end if
  case type of
    #gameChar:
      spr.member = mem
      spr.width = mem.width
      spr.height = mem.height
      spr.ink = 36
    #field:
      spr.member = mem
      spr.ink = 0
  end case
end
