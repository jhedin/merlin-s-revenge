New in this release
-------------------
Speed improvements, though more can be found...
Also, the tileset switcher is still not completely done, so you should avoid clicking on it, unless you have a backup copy of your map.

How to edit programming and data
--------------------------------
Go into the casts folder
look for the script or data text file that you want to edit
open it in a text editor
make your changes
save
run merlin_open.exe
The changed script or data will automatically be loaded and used.

<long winded spiel>
For creating/editing data, most of the used tags can be found in the struct master. If you open it with word pad(or similar) it should come out formatted pretty nicely, and pretty good descriptions of each thing you could include are there. Another good spot to look is modCharaterAttackProperties(I think that's the name) which will probably tell you some extra stuff about the tags in #attack:[] If you still haven't found what you are looking for, you can probably check some of the relevant mods. At the top of these files they will set some properties which will have names pretty close to the tags in the data. To find the names of these properties in the data, scroll down till you see addModParams or init. It should be pretty evident from there.
</long winded spiel> -Note

How to select and play a cut scene
----------------------------------
Move a cut scenes from "cut_scenes" to "cut_scene_to_play"
open "merlin_open.exe" and start a game
your selected cut scene will play.

How to edit a cut scene
-----------------------
Open any cut scene in notepad and edit away!


How to select a map
-------------------
Move a map from "maps" into "map_to_play".

double click on merlin_open.exe to play the map
or
double click on map_editor.exe to edit the map
Don't do both at once!
In game scripts are disabled.
If you save a game on one map and load it on another, the results are er, unpredicatable. Sometimes it kind of works, sometimes not.
You can edit existing maps this way.

How to Create a new map
----------------------------------------
Copy the file "new_map.txt"
Paste in into "map_to_play"
Open it in your favourite text editor (e.g notepad or gEdit)
change "#mapSize: point(3,4)" to reflect the size of map you want
e.g. for a map that's 15 rooms across and 3 rooms down, change it to
"#mapSize: point(15,3)"
Run map_editor.exe
Your new map will be created and filled with grass. 
You can then edit, save and play as above.


Have fun!

Steve
