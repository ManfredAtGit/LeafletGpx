/*
ToDos:

- clean-up code

- graphic for track-elevation along track distance and display of actual position
  (km-travelled, elevation) on that curve

- pass track to be visualized via url-parameter

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
        updateStatsAnim(0, 0, 0, 0);
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


//////////// D E P R E C A T E D ////////////////

/**
 * Function takes (part of) gpx-track and calculates an running total of distance as km
 * @param {Array} points : gpx-track 
 * @returns cumulative distance in km
 */
const calculateDistance = (points) => {
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
        distance += points[i].distanceTo(points[i-1]);
    }
    return (distance / 1000).toFixed(2); // Convert to km and format
};

/**
 * Function takes (part of) gpx-track and calculates an elevation object with properties:
 * current elevation (elevation of last segment) and running total of elevation climbed
 * @param {Array} points : gpx-track 
 * @returns object with properties : currentElevation and gain (= cummulated elevationClimbed)
 */
const calculateElevation = (points) => {
    if (points.length === 0) return { current: 0, gain: 0 };
    
    let gain = 0;
    let current = points[points.length - 1].meta.ele;
    
    for (let i = 1; i < points.length; i++) {
        const elevation_diff = points[i].meta.ele - points[i-1].meta.ele;
        if (elevation_diff > 0) {
            gain += elevation_diff;
        }
    }
    
    return {
        current: Math.round(current),
        gain: Math.round(gain)
    };
};

// calculate a array of speed data points for an track
// a speed point is a object with a startpoint of a segment,
// an average speed value of a segment and cumulated distance up
// to and including this segment.
// the parameter track is a gpx-track represented as a latlgns
// array of objects {lat,lng,meta:{tim,ele}}
function calculateSpeedData(latlngs) {
    const points = latlngs;
    const speedPoints = [];
    let acumDistance = 0;
    
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        // Calculate distance between points
        const segmentDistance = L.latLng(p1.lat, p1.lng).distanceTo(L.latLng(p2.lat, p2.lng));
        
        // Calculate time difference in seconds
        const segmentTime = (p2.meta.time - p1.meta.time) / 1000;
        
        // Calculate speed in km/h
        const speed = (segmentDistance / segmentTime) * 3.6;
        
        acumDistance += segmentDistance;
        
        speedPoints.push({
            distance: acumDistance,
            speed: speed,
            point: p1,
            ele: p1.meta.ele
        });
    }
    
    return speedPoints;
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
 * Function takes (part of) gpx-track and calculates (average) speed of last segment of an gpx-track as segDistance/segDuration
 * @param {Array} points : gpx-track 
 * @returns speed in km/h
 */
const calculateSpeed = (points) => {
    if (points.length < 2) return 0;

    let distance = 0;

    const prevPoint = points[points.length - 2];
    const currentPoint = points[points.length - 1];
    distance = currentPoint.distanceTo(prevPoint);
    const time = new Date(currentPoint.meta.time);
    const prevtime = new Date(prevPoint.meta.time);
    const timeDiff = (time - prevtime) / 1000; // Time difference in seconds
    const speedMps = distance / timeDiff; // Speed in meters per second
    const speedKph = speedMps * 3.6; // Speed in kilometers per hour
    return speedKph;

};


/**
 * Function to update div-elements with track statistics according to the current playhead-position
 * @param {*} elapsedTime : total elapsed time in minutes
 * @param {*} dist : total distance in meter
 * @param {*} speed : km/h of current track-egment/point
 * @param {*} ele : current elevation in meter
 */
const updateStatsAnim = (elapsedTime, dist, speed, ele) => {
    const distance = dist/1000;
    const elevation = ele;
    const cur_speed = speed;

    $('#elapsedTime').text(`Elapsed Time: ${elapsedTime.toFixed(0)} min`);
    $('#distance').text(`Distance: ${distance.toFixed(2)} km`);
    $('#elevation').text(`Elevation: ${elevation.toFixed(0)}m `);
    $('#speed').text(`Speed: ${cur_speed.toFixed(2)} km/h`);
};

/**
 * 
 * @param {*} distance : accumulated distance of a trakpoint/segment
 * @param {*} latlngs 
 * @param {*} speedPoints 
 * @returns 
 */
function interpolateSpeed(distance, latlngs) {
    // Find closest speed point based on distance and return speed approx for segment
    for (let i = 0; i < latlngs.length - 2; i++) {
        if (distance >= latlngs[i].meta.cumDistance && distance <= latlngs[i + 1].meta.cumDistance) {
            const ratio = (distance - latlngs[i].meta.cumDistance) / 
                         (latlngs[i + 1].meta.cumDistance - latlngs[i].meta.cumDistance);
            //const interpolatedSpeed = speedPoints[i].speed + ratio * (speedPoints[i + 1].speed - speedPoints[i].speed);

            const speed1 = latlngs[i].meta.segmentDistance / latlngs[i].meta.segmentDuration * 1000 * 3.6;
            const speed2 = latlngs[i+1].meta.segmentDistance / latlngs[i+1].meta.segmentDuration * 1000 * 3.6;
            return speed1 + ratio * (speed2 - speed1);
        }
    }

        // Calculate distance between points
        const segmentDistance = L.latLng(p1.lat, p1.lng).distanceTo(L.latLng(p2.lat, p2.lng));
        
        // Calculate time difference in seconds
        const segmentTime = (p2.meta.time - p1.meta.time) / 1000;
        
        // Calculate speed in km/h
        const speed = (segmentDistance / segmentTime) * 3.6;

    return latlngs[latlngs.length - 1].meta.segmentDistance / latlngs[latlngs.length - 1].meta.segmentDuration * 3.6;
}

function interpolateEle(distance, latlngs) {
    // Find closest speed point based on distance and return elevation approx for segment
    for (let i = 0; i < latlngs.length - 2; i++) {
        if (distance >= latlngs[i].meta.cumDistance && distance <= latlngs[i + 1].meta.cumDistance) {
            const ratio = (distance - latlngs[i].meta.cumDistance) / 
                         (latlngs[i + 1].meta.cumDistance - latlngs[i].meta.cumDistance);
            //const interpolatedSpeed = speedPoints[i].speed + ratio * (speedPoints[i + 1].speed - speedPoints[i].speed);
            //console.log('interpolated speed: ',interpolatedSpeed);
            return latlngs[i].meta.ele + ratio * (latlngs[i+1].meta.ele - latlngs[i].meta.ele);
        }
    }
    return latlngs[latlngs.length - 1].ele;
}

