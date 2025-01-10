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

# future work
- re-work from scratch to use d3-v6/v7 and get clearer code
- add non-numeric dimensions
- add customized label ticks for non-numeric dimensions/axis















# credits
Adapted from examples by Mike Bostock and Jason Davies

Based on Kai Changs Nutrition Explorer
(updated from d3-version2 to d3-version-6)



Improvements:
-------------

* Scale to window size and resizes
* Click label to invert axis
* Drag label to reorder axes
* Rendering progress bar
* Keep selected button removes unselected data
* Exclude selected button removes selected data
* Alphabetized random sample
* Brushed axes only show tick numbers within extent
* Rendering speed optimization targets 30 fps
* Dynamic legend with group counts
* Filtering by group
* Hovering over food highlights polyline
* Destination-over rendering feels less "spidery"
* Export CSV
* Detect numerical columns from first row
* Delete column by dragging left
* Text Search


Bugfixes:
---------

* Inverting doesn't destroy brushes, instead moves them
* Keeping preserves inverted axes