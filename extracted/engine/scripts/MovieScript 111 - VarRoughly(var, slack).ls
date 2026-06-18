on VarRoughly var, slack
  if slack > 0 then
    var = var - slack
    slack = slack * 2
    actualSlack = random(slack)
    var = var + actualSlack
  end if
  return var
end
