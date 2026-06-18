on SoundEmptyChan
  if not soundBusy(2) then
    return 2
  else
    if not soundBusy(3) then
      return 3
    else
      if not soundBusy(4) then
        return 4
      else
        if not soundBusy(5) then
          return 5
        else
          if not soundBusy(6) then
            return 6
          else
            if not soundBusy(7) then
              return 7
            else
              if not soundBusy(8) then
                return 8
              end if
            end if
          end if
        end if
      end if
    end if
  end if
  return 0
end
