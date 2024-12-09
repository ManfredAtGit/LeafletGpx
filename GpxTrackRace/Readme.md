# Race Track Comparison Tool

An interactive web application for comparing two GPX tracks simultaneously, visualizing their progression, elevation profiles, and relative performance metrics in real-time.
https://manfredatgit.github.io/LeafletGpx/GpxTrackRace/race01.html (optional pars $track1=track1-url&track2=track2-url)

## Features

- Side-by-side track comparison with synchronized playback
- Interactive map visualization using Leaflet
- Real-time track statistics including:
  - Elapsed time
  - Distance covered
  - Current elevation
  - Current speed
  - Gap between tracks
- Dynamic elevation profile chart
- Playback controls:
  - Play/Pause
  - Reset
  - Adjustable animation duration
  - Interactive progress slider

## Usage

### Basic Setup

1. Open `race01.html` in a web browser
2. Tracks can be loaded in two ways:
   - Using URL parameters:
race01.html?track1=URL_TO_FIRST_GPX&track2=URL_TO_SECOND_GPX
- Using the default tracks specified in the HTML file

### Controls

- **Play/Pause Button**: Start or pause the track animation
- **Reset Button**: Return to start position
- **Duration Control**: Set animation length in seconds (10-120s)
- **Progress Slider**: Manually scrub through the tracks

## Output Display

The interface shows:
- Interactive map with both tracks
- Moving markers showing current position
- Color-coded track progression (red for track1, green for track2)
- Real-time statistics panel
- Elevation profile chart with current positions
- Gap measurements between tracks

## Technical Details

- Built with:
- Leaflet.js for mapping
- Chart.js for elevation visualization
- jQuery UI for controls
- GPX parsing capabilities
- Supports:
- GPX file loading
- Time-based interpolation
- Distance calculations
- Elevation tracking
- Speed computations

## Requirements

- Modern web browser with JavaScript enabled
- Internet connection for loading map tiles and external libraries
- Valid GPX track files with timestamp data

## Styling

Custom CSS (race01.css) provides responsive layout and styling for:
- Map container
- Control panel
- Statistics display
- Playback controls
- Elevation chart

## Notes on comparing track rides
- use cases
- - compare 2 rides on different occasions (days) for the same track
- - compare 2 rides of one occassion (event, race) for the same track
- issues
- - similarity of tracks : tracks need not be identical for comparision, but it helps
- - wit decreasing similarity, comparison and statistics become less meaningful
- - the gap statistics are approximations of the distance between riders. One type is baswd on the cumulative distance of trackpoints, the other is caculated by distanceTo method which is an absolut distance (straight line) between 2 point locations

