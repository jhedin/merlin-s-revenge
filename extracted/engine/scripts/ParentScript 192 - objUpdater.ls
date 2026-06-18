property ancestor, pUpdateCats, pUpdateLists
global q

on new me
  ancestor = new(script("objBasic"))
  return me
end

on init me, uCats
  if not ilk(uCats, #list) then
    uCats = [#norm]
  end if
  pUpdateCats = uCats.duplicate()
  pUpdateLists = []
  me.initCats()
end

on initCats me
  numCats = pUpdateCats.count
  repeat with c = 1 to numCats
    pUpdateLists[c] = []
  end repeat
end

on updatePrgs me, mou
  repeat with ul = 1 to pUpdateLists.count
    nUl = pUpdateLists[ul]
    repeat with prg = 1 to nUl.count
      nPrg = nUl[prg]
      update(nPrg, mou)
    end repeat
  end repeat
end

on addPrg me, prg, cat
  catPos = pUpdateCats.getPos(cat)
  if catPos = 0 then
    alert("updater: unknown cat(" & q & "#" & cat & q & " from prg: " & prg & ")")
    halt()
  end if
  ul = pUpdateLists[catPos]
  if ul.getPos(prg) = 0 then
    ul.append(prg)
  end if
end

on removePrg me, prg
  repeat with ul in pUpdateLists
    pos = ul.getPos(prg)
    if pos > 0 then
      ul.deleteAt(pos)
    end if
  end repeat
end
