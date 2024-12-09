
# Track Animation Visualization
A web-based GPX track visualization tool with interactive playback controls and real-time statistics.
  https://manfredatgit.github.io/FancyGpxTrackSlider/TrackAnim_singleTrack_fancySlider.html (optional par. $track=track-url)

## Features
- gpx-track can be passed via parameter "track"; otherwise default track is used
- Interactive map display using Leaflet
- Track playback animation with play/pause controls
- Customizable animation duration
- Real-time track statistics:
    - Elapsed time
    - Distance covered
    - Current elevation
    - Current speed
- Multiple track visualization modes:
    - Trackpoints
    - Distance-based
    - Time-based
- Fancy slider with percentage indicator
- Position marker tracking

## Dependencies
- Leaflet.js 1.9.4
- jQuery 3.7.1
- jQuery UI 1.13.2
- Font Awesome 5.15.4
- Leaflet-GPX 1.4.0
- chart.js

## Usage
1.  Include the required files:

<link rel="stylesheet" href="track-animation-fancySlider.css">
<script src="track-animation-fancySlider.js"></script>

2. Initialize the map and load a track:

const map = initMap();
loadTrack(map, 'path/to/your/track.gpx');

3. The interface provides:
- Play/Pause button
- Reset button
- Animation duration control
- Track mode selector
- Interactive progress slider

## Track Modes
- Trackpoints: Follows original GPX trackpoints
- Distance: Equalizes points based on distance
- Time: Equalizes points based on time intervals

## Statistics Display
Real-time updates showing:

- Current elapsed time
- Distance covered
- Current elevation and elevation gain
- Current speed

## chart display
- display elevation against track distance position
- animate current position with red point symbol

## Layout
The interface uses a flexible layout with:

- Main map display (75% width)
- Control panel (25% width)
- Responsive design for different screen sizes

## File Structure
- TrackAnim_singleTrack_fancySlider.html: Main HTML structure
- track-animation-fancySlider.css: Styling and layout
- track-animation-fancySlider.js: Core functionality and animstion
