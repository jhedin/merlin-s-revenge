property ancestor, pFX, pDialogFilter, pLoadDialogTitle, pSaveDialogTitle, pSaveFolder, pSaveOverwritePrompt, pSaveType
global g

on new me
  me.ancestor = new(script("objBasic"))
  return me
end

on init me
  pFX = new(xtra("fileXtra3"))
  pDialogFilter = "Text Files/*.txt"
  pLoadDialogTitle = "Load a recipe"
  pSaveDialogTitle = "Save your recipe"
  pSaveFolder = "recipes\"
  pSaveOverwritePrompt = 1
  pSaveType = ".txt"
end

on finish me
  pFObj = 0
  me.ancestor.finish()
end

on folderConfirm me, thepath
  if not pFX.fx_FolderExists(thepath) then
    pFX.fx_FolderCreate(thepath)
  end if
end

on savefile me, content, filenam
  folderPath = the moviePath & pSaveFolder
  me.folderConfirm(folderPath)
  savename = filenam & pSaveType
  savePath = pFX.fx_FileSaveAsDialog(folderPath, savename, pSaveDialogTitle, pSaveOverwritePrompt)
  FileSave(savePath, content)
end

on loadFil me
  folderPath = the moviePath & pSaveFolder
  me.folderConfirm(folderPath)
  loadPath = pFX.fx_FileOpenDialog(folderPath, pDialogFilter, pLoadDialogTitle, 0, 1)
  content = fileload(loadPath)
  return content
end
