/*
ToDos:

- clean-up code

*/

/**
 * Global scope
 */

let animationInterval;
let isPlaying = false;
let currentPlayTime = 0; 
let durationInput;
let trackLayers = [];  // Store for all track visualization layers
let trackMode = 'trackpoints';
console.log('trackMode', trackMode);
let positionMarker;
let latlngsPoints, latlngsDist, latlngsDuration;
let currentTrack;
let progressLine;
let elevationChart;


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


// Track loading and processing
const loadTrack = (map, gpxUrl) => {
    let gpxLayer;
    const latlngs = [];
    let trackStats = {};

    new L.GPX(gpxUrl, {
        async: true,
    }).on('error', function(err) {
        console.error('Error loading GPX:', err);
        // Handle error gracefully
    }).on('loaded', function(e) {
        gpxLayer = e.target;
        //const track = gpxLayer.getLayers()[0];
        const track = gpxLayer._layers[Object.keys(gpxLayer._layers)[0]];
        // Get the first layer's track info
        trackStats = getTrackStats(gpxLayer);

        // get trackline coordinates
        // const trackLine = track.getLayers()[0];
        const trackLine = track._layers[Object.keys(track._layers)[0]];
        if (trackLine && trackLine.getLatLngs) {
            latlngs.push(...trackLine.getLatLngs());
        }

        // fit to track bounds
        map.fitBounds(gpxLayer.getBounds());
        //map.removeLayer(gpxLayer);

        // enhence track-data structure with cummulated distance, duration an more
        enhancePositiondata(latlngs);



        latlngsPoints = latlngs;
        latlngsDist = calculateEquiDistanceTrack(latlngs);
        latlngsDuration = calculateEquiTimeTrack(latlngs);

        // Set initial track based on default mode
        currentTrack = latlngsPoints;        // build trackModeScale track approximations

        // initialize controls
        initializeControls(currentTrack);

        initSlider(map, currentTrack); 

        initializeTrackProgress();

        initializeElevationChart(latlngs)

    }).addTo(map);
};

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

/**
 * Slider functionality
 * 
 */ 
const initSlider = (map, latlngs) => {
    let partialLayer;
    
    $("#slider").slider({
        
        range: false,
        min: 0,
        max: 100,
        value: 0,

        animate: "fast",
        orientation: "horizontal",
        handle: "square",
        tooltip: true,
        // Add labels
        create: function() {
            $(this).find('.ui-slider-handle').html('<div class="tooltip"></div>');
        },

        slide: function(event, ui) {

            // the slider movement controls how we move through the latlngs array of 
            // recorded geo-locations. The slider position expressed as an percentage
            // between 0 and 100 of the slider rangea is used to determine how many 
            // points of the latlngs array to display (percentage of latlngs.lenght).
            // Note! The slider position is not the same as the percentage of the 
            // total track distance or the total track duration.
            $(this).find('.tooltip').html(ui.value + '%');
            const value = ui.value;
            const numPoints = Math.ceil((value / 100) * latlngs.length);
            const points = latlngs.slice(0, numPoints);
            
            if (points.length > 0) {
                if (partialLayer) {
                    map.removeLayer(partialLayer);
                }
                partialLayer = L.polyline(points, {
                    color: 'red',
                    weight: 5,
                    opacity: 0.75
                }).addTo(map);

                updateStats(points);
                updatePositionMarker(points);
                updateElevationChart(value/100, latlngs);

            }
        },
        stop: function(event, ui) {
            const sliderPosition = ui.value;
            console.log('Slider position:', sliderPosition);
        }
    });
};

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
 * 
 * @param {Array} latlngs : original gpx-track with track-points
 * @returns {Array} equiTimeTrack : array of latlng objects with equiTimeTrack  
 */
function calculateEquiTimeTrack(latlngs) {
    const durationInput = document.getElementById('animation-duration');  // playtime in sec
    const intervalStepTime = 50; // 50 miliseconds for smooth animation
    const numTrackPoints = Math.floor(durationInput * 1000 / intervalStepTime);
    const timeIncrement = latlngs[latlngs.length-1].meta.cumDuration / numTrackPoints;

    const equiTimeTrack = [];

    for (let i = 0; i < numTrackPoints; i++) {
        const duration = i * timeIncrement;
        const point = latlngs.find(point => point.meta.cumDuration >= duration  && point.meta.cumDuration < duration + timeIncrement);
        equiTimeTrack.push(point);
    }

    return equiTimeTrack;
}

function calculateEquiDistanceTrack(latlngs) {
    const durationInput = document.getElementById('animation-duration');  // playtime in sec
    const intervalStepTime = 50; // 50 miliseconds for smooth animation
    const numTrackPoints = Math.floor(durationInput * 1000 / intervalStepTime);
    const distIncrement = latlngs[latlngs.length-1].meta.cumDistance / numTrackPoints;

    const equiDistanceTrack = [];

    for (let i = 0; i < numTrackPoints; i++) {
        const distance = i * distIncrement;
        const point = latlngs.find(point => point.meta.cumDistance >= distance  && point.meta.cumDistance < distance + distIncrement);
        equiDistanceTrack.push(point);
    }

    return equiDistanceTrack;
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
    const segmentDuration = points[points.length-1].meta.segmentDuration;
    const segmentDistance = points[points.length-1].meta.segmentDistance;
    const segmentSpeed = points[points.length-1].meta.segmentSpeed;
    //const speed = calculateSpeed(points);
    /*
    let speed =0;

    if ( segmentDuration >0 ) {
        speed = (segmentDistance / segmentDuration) * 3600;
    }
    */
    $('#elapsedTime').text(`Elapsed Time: ${elapsedTime.toFixed(0)} min`);
    $('#distance').text(`Distance: ${distance.toFixed(2)} km`);
    $('#elevation').text(`Current: ${elevationCurrent}m (↑${elevationGain.toFixed(2)}m)`);
    $('#speed').text(`Speed: ${segmentSpeed.toFixed(2)} km/h`);
};

//////////////// *** code for track play animation ***

/**
 * 
 * @param {Array} latlngs : array of latlng objects
 */
function initializeControls(latlngs) {
    const playPauseButton = document.getElementById('play-pause');
    durationInput = document.getElementById('animation-duration');
    
    playPauseButton.addEventListener('click', () => {
        if (!isPlaying) {
            // Start, Continue animation from current position
            const duration = parseInt(durationInput.value) * 1000; // Convert to milliseconds
            startTrackAnimation(latlngs, duration, currentPlayTime);
            playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
            isPlaying = true;
        } else {
            // Pause animation
            clearInterval(animationInterval);
            playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
            isPlaying = false;
        }
    });

    const resetButton = document.getElementById('reset');
    resetButton.addEventListener('click', () => {
        clearInterval(animationInterval);
        isPlaying = false;
        currentPlayTime = 0;
        document.getElementById('play-pause').innerHTML = '<i class="fas fa-play"></i>';
        updateSliderPosition(0);
        updatePositionMarker(latlngs.slice(0, 1));
        updateTrackProgress(0, latlngs);
        $("#slider").find('.tooltip').html(Math.round(0 * 100) + '%');
        resetTrackDisplay();
        updateStats(latlngs.slice(0, 1));
    });

    // Track mode selection handler
    const trackModeSelect = document.getElementById('track-mode-select');
    trackModeSelect.addEventListener('change', function() {
        const selectedMode = this.value;
        console.log('Selected track mode:', selectedMode);
        // You can now use the selectedMode value to update your animation logic
        // Values will be: 'trackpoints', 'distance', or 'time'
        trackMode = selectedMode;
        updateCurrentTrack(trackMode);
    });
}


//
/**
 * @param {Array} latlngs - An array of objects representing trackpoints with
 * latitude, longitude, meta.ele, and meta.time properties. It also includes properties 
 * like meta.cumDistance, meta.cumElevationClimbed, meta.cumDuration and meta.segmentDistance and meta.segmentDuration.
 * Note: there are ifferent types of latlngs-arrays: one for trackpoints, one for equiTimeTrack and one for equiDistanceTrack.

 * @playTime - the total playtime of the track in ms
 * @startTime - the time in ms when the animation starts or continues
 * @returns {void}
 */
function startTrackAnimation(latlngs, playTime, startTime=0) {
    clearInterval(animationInterval); //built-in; stops any running animation
    
    currentPlayTime = startTime;
    const totalDistance = latlngs[latlngs.length-1].meta.cumDistance;
    const totalDuration = latlngs[latlngs.length-1].meta.cumDuration;
     
    const intervalStep = 50; // Update every 50ms for smooth animation
    
    // starts a timer with setInterval (built-in)
    animationInterval = setInterval(() => {
        currentPlayTime += intervalStep;
        
        if (currentPlayTime >= playTime) {
            clearInterval(animationInterval); // stops animation
            isPlaying = false;
            document.getElementById('play-pause').innerHTML = '<i class="fas fa-play"></i>';
            updateTrackProgress(1,latlngs);
            //updatePositionMarker([]);
            return;
        }
        
        const progress = currentPlayTime / playTime;
        const latlngsLastPoint = Math.ceil(progress * latlngs.length) - 1;

        const currentDistance = totalDistance * progress;
        const currentDuration = totalDuration * progress;
        const speedAtPoint = latlngs[latlngsLastPoint].meta.segmentSpeed;
        const eleAtPoint = latlngs[latlngsLastPoint].meta.ele;
        const eleClimbedAtPoint = latlngs[latlngsLastPoint].meta.cumElevationClimbed;

        const points = latlngs.slice(0, latlngsLastPoint + 1);

        $("#slider").find('.tooltip').html(Math.round(progress * 100) + '%');
        updateSliderPosition(progress * 100);
        updateTrackProgress(progress, latlngs);
        updatePositionMarker(points);
        updateStats(points);
        updateElevationChart(progress, latlngs);

    }, intervalStep);
}



/**
 * Update slider position ui-element based on percentage
 * @param {*} percentage 
 */
function updateSliderPosition(percentage) {
    $("#slider").slider("value", percentage);
}

/**
 * initiate ployline for track progress visualisation for animation 
 * and add to map
 */
function initializeTrackProgress() {
    // Create progress line with style
    progressLine = L.polyline([], {
        color: 'red',
        weight: 5,
        opacity: 0.8
    }).addTo(map);
}

/**
 * function to update track progress display from animation
 * @param {*} progress 
 * @param {*} latlngs 
 */
function updateTrackProgress(progress,latlngs) {
    // Clear any existing layers from manual slider movement
    trackLayers.forEach(layer => map.removeLayer(layer));
    trackLayers = [];

    const points = latlngs;
    const pointCount = Math.floor(points.length * progress);
    const progressPoints = points.slice(0, pointCount).map(p => [p.lat, p.lng]);
    progressLine.setLatLngs(progressPoints);
}

function updateCurrentTrack(mode) {
    switch(mode) {
        case 'trackpoints':
            currentTrack = latlngsPoints;
            break;
        case 'distance':
            currentTrack = latlngsDist;
            break;
        case 'time':
            currentTrack = latlngsDuration;
            break;
        default:
            currentTrack = latlngsPoints;
    }
}

/**
 * Reset track display for animation to initial state
 */
function resetTrackDisplay() {
    // Clear polyline
    if (progressLine) {
        progressLine.setLatLngs([]);
    }
    
    // Clear any manual slider layers
    trackLayers.forEach(layer => map.removeLayer(layer));
    trackLayers = [];
}

/**
 * function to update marker position at head of displayed track (progress)
 * @param {*} points 
 * @returns 
 */
function updatePositionMarker(points) {
    if (points.length === 0) return;
    
    const currentPosition = points[points.length-1];
    
    if (!positionMarker) {
        positionMarker = L.marker([currentPosition.lat, currentPosition.lng]).addTo(map);
    } else {
        positionMarker.setLatLng([currentPosition.lat, currentPosition.lng]);
    }
}


function initializeElevationChart(latlngs) {
    const distances = latlngs.map(point => (point.meta.cumDistance / 1000)); // Convert to km
    const elevations = latlngs.map(point => point.meta.ele);
    const totalDistance = latlngs[latlngs.length-1].meta.cumDistance / 1000;

    const ctx = document.getElementById('elevationChart').getContext('2d');
    
    elevationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: distances,
            datasets: [{
                label: 'Elevation Profile',
                data: elevations,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(75, 192, 192, 0.2)'
            },
            {
                label: 'Current Position',
                data: [{x: 0, y: elevations[0]}],
                pointBackgroundColor: 'red',
                pointRadius: 6,
                showLine: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: totalDistance,
                    ticks: {
                        stepSize: totalDistance / 10,  // Create 10 evenly spaced ticks
                        callback: function(value) {
                            return value.toFixed(2);
                        }
                    },
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
            animation: false
        }
    });
}

function updateElevationChart(progress, latlngs) {
    if (!elevationChart) return;
    
    const pointIndex = Math.floor(progress * (latlngs.length - 1));
    const currentPoint = latlngs[pointIndex];

    // Create the data point with exact numeric values, not strings
    const currentData = {
        x: currentPoint.meta.cumDistance / 1000,  // Keep as number, don't use toFixed here
        y: currentPoint.meta.ele
    };
    /*
    elevationChart.data.datasets[1].data = [{
        x: (currentPoint.meta.cumDistance / 1000),
        y: currentPoint.meta.ele
    }];
    */
    elevationChart.data.datasets[1].data = [currentData];
    elevationChart.update('none');
}


