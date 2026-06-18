on ListPosCoincide list1, list2, comparison
  poslist = []
  count1 = list1.count
  count2 = list2.count
  countMin = min(count1, count2)
  repeat with i = 1 to countMin
    nItem1 = list1[i]
    nItem2 = list2[i]
    match = 0
    case comparison of
      #notSolid:
        if (nItem1 <> #solid) and (nItem2 <> #solid) then
          match = 1
        end if
      otherwise:
        if (nItem1 = comparison) and (nItem2 = comparison) then
          match = 1
        end if
    end case
    if match = 1 then
      poslist.append(i)
    end if
  end repeat
  return poslist
end
