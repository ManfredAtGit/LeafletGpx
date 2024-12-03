/**
 * To-Dos
 * - Add more tracks
 * - correct distance statistics between tracks
 * - add sanity checks on gpx-files/tracks
 * - add sanity check on race prerequisits of tracks
 */


/**
 * Map initialization
 */ 
const initMap = () => {
    const map = L.map('map').setView([51.505, -0.09], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    return map;
};

/**
 * Global scope
 */
let animationInterval;
let isPlaying = false;
let currentPlayTime = 0;
let elevationChart;

// Track state management
const tracks = {
    track1: {
        latlngs: [],
        marker: null,
        progressLine: null,
        color: 'red',
        stats: {}
    },
    track2: {
        latlngs: [],
        marker: null,
        progressLine: null,
        color: 'green',
        stats: {}
    }
};


function loadTracks(map, gpxUrl1, gpxUrl2) {
    let tracksLoaded = 0;
    
    function loadSingleTrack(gpxUrl, trackId) {
        new L.GPX(gpxUrl, {
            async: true
        }).on('loaded', function(e) {
            const gpxLayer = e.target;
            const track = gpxLayer._layers[Object.keys(gpxLayer._layers)[0]];
            const trackLine = track._layers[Object.keys(track._layers)[0]];
            
            tracks[trackId].latlngs = enhancePositiondata(trackLine.getLatLngs());
            tracks[trackId].stats = getTrackStats(gpxLayer);
            
            tracksLoaded++;
            if (tracksLoaded === 2) {
                map.fitBounds(gpxLayer.getBounds());
                initializeTrackVis(map);
                initSlider();
                initializeControls();
                createElevationChart(); 
            }
        }).addTo(map);

    }

    loadSingleTrack(gpxUrl1, 'track1');
    loadSingleTrack(gpxUrl2, 'track2');
}

function initializeTrackVis(map) {

    // Initialize markers and lines
    Object.keys(tracks).forEach(trackId => {
        // Create distinct markers
        tracks[trackId].marker = L.marker([0, 0], {
            icon: L.divIcon({
                className: `marker-${trackId}`,
                html: `<div style="width: 20px; height: 20px; border-radius: 50%; background: ${tracks[trackId].color}"></div>`
            })
        }).addTo(map);
        
        // Create track lines
        tracks[trackId].progressLine = L.polyline([], {
            color: tracks[trackId].color,
            weight: 4,
            opacity: 0.7
        }).addTo(map);
    });

}


function initSlider() {
    // Calculate max duration from both tracks
    const maxDuration = Math.max(
        tracks.track1.stats.track_duration,
        tracks.track2.stats.track_duration
    );
    $("#slider").slider({
        range: false,
        min: 0,
        max: maxDuration,
        value: 0,
        slide: function(event, ui) {
            currentPlayTime = ui.value;
            updateTracksByTime(ui.value);
            updateElevationChart(ui.value);
            updateGap(ui.value);
        }
    });
}

function initializeControls() {
    document.getElementById('play-pause').addEventListener('click', () => {
        if (!isPlaying) {
            animationInterval = startAnimation(currentPlayTime);
            document.getElementById('play-pause').innerHTML = '<i class="fas fa-pause"></i>';
            isPlaying = true;
        } else {
            clearInterval(animationInterval);
            document.getElementById('play-pause').innerHTML = '<i class="fas fa-play"></i>';
            isPlaying = false;
        }
    });

    document.getElementById('reset').addEventListener('click', () => {
        clearInterval(animationInterval);
        isPlaying = false;
        currentPlayTime = 0;
        document.getElementById('play-pause').innerHTML = '<i class="fas fa-play"></i>';
        $("#slider").slider("value", 0);
        updateTracksByTime(0);
        updateElevationChart(0);
        updateGap(0);
    });
}

function updateTracksByTime(elapsedTime) {
    Object.keys(tracks).forEach(trackId => {
        const track = tracks[trackId];
        const trackStartTime = track.latlngs[0].meta.time;
        
        // Get all points up to current elapsed time
        const currentPoints = track.latlngs.filter(point => 
            (point.meta.time - trackStartTime) <= elapsedTime
        );
        // index in track-array of closed point to currentPos
        //const idx = currentPoints.length - 1;
        
        if (currentPoints.length > 0) {
            // Get interpolated current position
            const currentPos = findPositionAtTime(track.latlngs, elapsedTime);
            
            // Update marker and line
            track.marker.setLatLng([currentPos.lat, currentPos.lng]);
            track.progressLine.setLatLngs(currentPoints);
            // update stats div-elements
            updateStats(currentPoints);

            //updateElevationChart(currentPos);
        }
    });
}


////////////// *** enhence track info and generate track types *** //////////////////

/**
 * 
 * @param {Array} latlngs : array of latlng objects with lat, lng, meta.time, meta.ele
 * @returns {Array} latlngs : array of latlng objects enhenced with segmentDistance,
 * segmentDuration, cumDistance, cumDuration and cumElevationClimbed.
 */

function enhancePositiondata(latlngs) {
    const startTime = latlngs[0].meta.time;
    let cummulativeDistance = 0;
    let cummulativeElevationClimbed = 0;
    let cummulativeDuration = 0;
    
    for (let i = 0; i < latlngs.length; i++) {
        // Calculate distance,duration and elevation gain between points
        // and add to running totals
        const segmentDistance =  i==0 ? 0 : latlngs[i].distanceTo(latlngs[i-1]);
        const segmentDuration = i==0 ? 0 : latlngs[i].meta.time - latlngs[i-1].meta.time;
        const segmentElevationGain = i==0 ? 0 : latlngs[i].meta.ele - latlngs[i-1].meta.ele;
        const segmentSpeed = segmentDuration > 0 ? segmentDistance / segmentDuration * 3600 : 0;

        latlngs[i].meta.segmentDistance = segmentDistance;
        latlngs[i].meta.segmentDuration = segmentDuration;
        latlngs[i].meta.segmentSpeed = segmentSpeed;

 
        cummulativeDistance += segmentDistance;
        cummulativeDuration = latlngs[i].meta.time - startTime;
        cummulativeElevationClimbed += segmentElevationGain < 0 ? 0 : segmentElevationGain;

        latlngs[i].meta.cumDistance = cummulativeDistance;
        latlngs[i].meta.cumElevationClimbed = cummulativeElevationClimbed;
        latlngs[i].meta.cumDuration = cummulativeDuration;


    }
    return latlngs;
}

/**
 * Function to extract general track statistics from gpx
 * @param {*} gpxLayer : gpxLayer object after beeing loaded 
 * @returns {*} trackStatsObj  : object with overall track statistics
 */
function getTrackStats(gpxLayer) {
    const trackStatsObj = {};
    const track_dist = gpxLayer.get_distance(); //total track distance in meter
    const track_elemax = gpxLayer.get_elevation_max(); //max elevation in meter
    const track_elemin = gpxLayer.get_elevation_min(); //min elevation in meter 
    const track_startTime = gpxLayer.get_start_time(); //start time of track
    const track_endTime = gpxLayer.get_end_time(); //end time of track
    const track_duration = track_endTime - track_startTime; //total track duration in seconds
    const track_movinggTime = gpxLayer.get_moving_time(); //moving time in seconds
    const track_movingSpeed = gpxLayer.get_moving_speed(); //moving speed in km/h
    const track_movingPace = gpxLayer.get_moving_pace(); //moving pace in min/km ??? 

    return {
        track_dist : gpxLayer.get_distance(), //total track distance in meter
        track_elemax : gpxLayer.get_elevation_max(), //max elevation in meter
        track_elemin : gpxLayer.get_elevation_min(), //min elevation in meter 
        track_startTime : gpxLayer.get_start_time(), //start time of track
        track_endTime : gpxLayer.get_end_time(), //end time of track
        track_duration : gpxLayer.get_end_time() - gpxLayer.get_start_time(), //total track duration in seconds
        track_movinggTime : gpxLayer.get_moving_time(), //moving time in seconds
        track_movingSpeed : gpxLayer.get_moving_speed(), //moving speed in km/h
        track_movingPace : gpxLayer.get_moving_pace(), //moving pace in min/km ??? 

    }

}



function findPositionAtTime(trackPoints, elapsedTime) {
    // Find the points before and after the elapsed time
    const startTime = trackPoints[0].meta.time;
    
    for (let i = 0; i < trackPoints.length - 1; i++) {
        const currentTime = trackPoints[i].meta.time - startTime;
        const nextTime = trackPoints[i + 1].meta.time - startTime;
        
        if (currentTime <= elapsedTime && nextTime >= elapsedTime) {
            // Linear interpolation between points
            const ratio = (elapsedTime - currentTime) / (nextTime - currentTime);
            return {
                lat: trackPoints[i].lat + (trackPoints[i + 1].lat - trackPoints[i].lat) * ratio,
                lng: trackPoints[i].lng + (trackPoints[i + 1].lng - trackPoints[i].lng) * ratio,
                cumDistance: trackPoints[i].meta.cumDistance + (trackPoints[i + 1].meta.cumDistance - trackPoints[i].meta.cumDistance) * ratio,
                elevation: trackPoints[i].meta.ele + (trackPoints[i + 1].meta.ele - trackPoints[i].meta.ele) * ratio,
                p1: trackPoints[i],
                p2: trackPoints[i + 1]
            };
        }
    }
    
    // Return last point if elapsed time is beyond track duration
    return trackPoints[trackPoints.length - 1];
}



/**
 * Function to update div-elements with track statistics
 * @param {Array} points : array of geo-locations of the currently  displayed track segments 
 * up to the point where the slider is currently positioned
 */
const updateStats = (points) => {

    const elapsedTime = points[points.length-1].meta.cumDuration/1000/60;    // minutes
    const distance = points[points.length-1].meta.cumDistance/1000;          // km
    const elevationCurrent = points[points.length-1].meta.ele;
    const elevationGain = points[points.length-1].meta.cumElevationClimbed;
    const segmentSpeed = points[points.length-1].meta.segmentSpeed;

    $('#elapsedTime').text(`Elapsed Time: ${elapsedTime.toFixed(0)} min`);
    $('#distance').text(`Distance: ${distance.toFixed(2)} km`);
    $('#elevation').text(`Current: ${elevationCurrent}m (↑${elevationGain.toFixed(2)}m)`);
    $('#speed').text(`Speed: ${segmentSpeed.toFixed(2)} km/h`);
};

function startAnimation(startTime=0) {
    const animationDuration = parseInt(document.getElementById('animation-duration').value) * 1000; // convert to milliseconds
    const maxTrackDuration = Math.max(
        tracks.track1.stats.track_duration,
        tracks.track2.stats.track_duration
    );
    
    const intervalStep = 100; // Update every 50ms for smooth animation
    currentPlayTime = startTime;
    
    // Calculate time increment per step to match desired animation duration
    const timeIncrement = (maxTrackDuration / animationDuration) * intervalStep;
    
    const animationInterval = setInterval(() => {
        currentPlayTime += timeIncrement;
        
        if (currentPlayTime >= maxTrackDuration) {
            clearInterval(animationInterval);
            isPlaying = false;
            document.getElementById('play-pause').innerHTML = '<i class="fas fa-play"></i>';
            return;
        }
        
        // Update both slider position and track visualization
        $("#slider").slider("value", currentPlayTime);
        updateTracksByTime(currentPlayTime);
        updateElevationChart(currentPlayTime);
        updateGap(currentPlayTime);
        
    }, intervalStep);
    
    return animationInterval;
}

function sanityCheck() {
    // Check if the selected tracks are suitable for comparion
    // For now, just check if both tracks are defined.
    // In a real-world scenario, you would perform more complex checks. 
    // Like checking if the tracks are "similar", have the same start and end points, etc.
    if (!tracks[0] || !tracks[1]) {
        console.error('Invalid track selected.');
        return;
    }
}


function createElevationChart() {
    const ctx = document.getElementById('elevationChart').getContext('2d');
    
    // Get track with longest distance
    const track1Distance = tracks.track1.latlngs[tracks.track1.latlngs.length - 1].meta.cumDistance;
    const track2Distance = tracks.track2.latlngs[tracks.track2.latlngs.length - 1].meta.cumDistance;
    const longestTrack = track1Distance > track2Distance ? tracks.track1 : tracks.track2;
    
    // Prepare data points
    const chartData = longestTrack.latlngs.map(point => ({
        x: point.meta.cumDistance / 1000, // Convert to kilometers
        y: point.meta.ele
    }));

    elevationChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Elevation Profile',
                    data: chartData,
                    borderColor: 'blue',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Track 1 Position',
                    data: [{x: 0, y: 0}],
                    borderColor: 'red',
                    backgroundColor: 'red',
                    pointRadius: 6,
                    showLine: false
                },
                {
                    label: 'Track 2 Position',
                    data: [{x: 0, y: 0}],
                    borderColor: 'green',
                    backgroundColor: 'green',
                    pointRadius: 6,
                    showLine: false
                }
            ]
        },
        options: {
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Distance (km)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Elevation (m)'
                    }
                }
            },
            animation: {
                duration: 0
            }
        }
    });
}

function updateElevationChart(currentTime) {
    if (!elevationChart) return;
    
    // Get current positions for both tracks
    const pos1 = findPositionAtTime(tracks.track1.latlngs, currentTime);
    const pos2 = findPositionAtTime(tracks.track2.latlngs, currentTime);
    
    // Update chart positions
    elevationChart.data.datasets[1].data = [{
        x: pos1.cumDistance / 1000,
        y: pos1.elevation
    }];
    
    elevationChart.data.datasets[2].data = [{
        x: pos2.cumDistance / 1000,
        y: pos2.elevation
    }];
    
    elevationChart.update('none');
}

function updateGap(currentTime) {
    // Get current positions for both tracks
    const pos1 = findPositionAtTime(tracks.track1.latlngs, currentTime);
    const pos2 = findPositionAtTime(tracks.track2.latlngs, currentTime);

    // Calculate and display gap
    const gap = pos1.cumDistance - pos2.cumDistance;
    const gap2 = pos1.p1.distanceTo(pos2.p1);
    $('#gap').text(`Gap t1-t2: ${gap.toFixed(0)} m`);
    $('#gap2').text(`Gap distanceTo: ${gap2.toFixed(0)} m`);

 }

///////////// Not used yet !!!!!



function startAnimation_old(duration) {
    const intervalStep = 50;
    currentPlayTime = 0;
    
    animationInterval = setInterval(() => {
        //currentPlayTime += intervalStep / 1000; // Convert to seconds
        currentPlayTime += intervalStep;
        
        if (currentPlayTime >= duration) {
            clearInterval(animationInterval);
            isPlaying = false;
            document.getElementById('play-pause').innerHTML = '<i class="fas fa-play"></i>';
            return;
        }
        
        $("#slider").slider("value", currentPlayTime);
        updateTracksByTime(currentPlayTime);
        
    }, intervalStep);
}

function initializeControls_old() {
    document.getElementById('play-pause').addEventListener('click', () => {
        if (!isPlaying) {
            startAnimation(document.getElementById('animation-duration').value);
            document.getElementById('play-pause').innerHTML = '<i class="fas fa-pause"></i>';
            isPlaying = true;
        } else {
            clearInterval(animationInterval);
            document.getElementById('play-pause').innerHTML = '<i class="fas fa-play"></i>';
            isPlaying = false;
        }
    });

    document.getElementById('reset').addEventListener('click', () => {
        clearInterval(animationInterval);
        isPlaying = false;
        currentPlayTime = 0;
        document.getElementById('play-pause').innerHTML = '<i class="fas fa-play"></i>';
        $("#slider").slider("value", 0);
        updateTracksByTime(0);
    });
}



function updateElevationChart_old(currentPos) {
    if (!elevationChart) return;
    
    // Create the data point with exact numeric values, not strings
    const currentData = {
        x: currentPos.cumDistance / 1000,  // Keep as number, don't use toFixed here
        y: currentPos.elevation
    };
 
    elevationChart.data.datasets[1].data = [currentData];
    elevationChart.update('none');
}


