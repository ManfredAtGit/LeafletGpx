# Strava_PC d3 Visualization

# D3 visualization of Strava activities data with gpx-tracks recordings

Collection of statistics (speed, duration, distance, calories, ...) of more than 500 Strava activities.
Statistics are organized in dimensions for visualization with d3 parallel coordinates plot and in a datatable.
The user can interact with this parallel coordinates visualization in the following ways:

- brush a dimension to filter data
- click on a dimension to invert the axis
- drag a dimension to reorder the axes
- remove a dimension by dragging it beyond the display area 
- hover over a datatable row to highlight the corresponding track on the map
- dblclick on a datatable row to call call an interactive map animation of the track
- filter data by searching for a keyword in the datatable
- exclude/keep selected data by clicking on the buttons
- export currently selected data to a csv-file


# implementation details:
- introduced unique id for each brush to address specific brush in code
- mapping between dimension/axis and brush kept in "dimbrush_index"
- conflicting event-handling in brush-event-handler and drag-event-handler controlled via additional global "ignore_brushend"
 - single click (on brush -> clear brushSelection)
 - single click (on axis/dimension -> invert axis)
 - drag/re-order dimension/axis

- brush-extent in version-2 is brushSelection in version-6
- automatically created DOM elements by d3 has changed from v2 to v6. 
  like background -> overlay, rect.class=extent -> rect.class=selection (css-stayle definitions had to be modified)
 
- event handling has changed from v2 to v6
  - eventtype: brushstart -> start, brushend -> end, ...
  - parameter-list of event-handler-functions has changed v2: function(d); v6: function(event,d);

- in update_ticks, re-initialzing the brush with event-handler requires the "call"-technique to pass the correct this-context.
  ( .on("end", function(event) { brushEnd.call(this, event, yscale, d); }))


# useage

Most efficient use of the interactive controls needs a bit of practice. I would start by focusing on the most important dimensions and removing (dragging dimension to the very left or right) which are not needed. Then simply brush on fifferent dimension axises to filter data. BrushSelections (extents) can be cleared again by a simple click somewhere near the dimension axis (when cursor position is displayed as cross-hair pointer). Clearing a BrushSelection sometimes fails, when the click is not a short, clean mouse click. Then the user interaction is interpreted as a (short) brush event resultimng in a very narroww brush selection with now data being shown. Just try again to clear the selection.

Another way to better organize or analyse the data is by inverting the axis. This can be done by a simple click on the axis label (on-hover cursor pointer display changes). 

Dimensions can be re-ordered by dragging the axis label to a new position. Reordering dimensions is useful for aligning certain dimensions side by side or for organizing the overall visual appearance in a better way (detecting patterns).

Usage of Exlude/Keep buttons: With "Keep" only the currently selected data is shown. With "Exclude" the currently selected data is removed from the visualization. In either case all brush selections are cleared and axis are re-scaled to fit the new (reduced) dataset. This way one can zoom-in on subsets of the data by streching the dimension scale over this subset.

A sample of 25 activities of the current selection is listed by name. Moving the mouse over one element in the list will highlight the corresponding path in the parallel coordinates plot. Clicking on one element in the list will call the interactive map animation of the corresponding activity.

Finally, a horizontal bar chart visualize the currently selected/displayed activities by activity group. Clicking on one bar will remove the corresponding activities of that group from the display/selection. Clicking again will restore the activities again.

# future work
- re-work from scratch to use d3-v6/v7 and get clearer code
- add non-numeric dimensions
- add customized label ticks for non-numeric dimensions/axis


# live link at github-pages
[Strava Parallel Coordinates](https://manfredatgit.github.io/LeafletGpx/StravaViz/index.html)













# credits
Adapted from examples by Mike Bostock and Jason Davies

Based on Kai Changs Nutrition Explorer
(updated from d3-version2 to d3-version-6)


