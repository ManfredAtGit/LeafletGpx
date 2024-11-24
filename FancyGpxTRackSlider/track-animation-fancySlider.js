// Map initialization
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
    let partialLayer;
    const latlngs = [];

    new L.GPX(gpxUrl, {
        async: true,
    }).on('error', function(err) {
        console.error('Error loading GPX:', err);
        // Handle error gracefully
    }).on('loaded', function(e) {
        gpxLayer = e.target;
        console.log('gpxLayer: ', gpxLayer);
        // Get the first layer's coordinates
        const track = gpxLayer._layers[Object.keys(gpxLayer._layers)[0]];

       const trackLine = track._layers[Object.keys(track._layers)[0]];
        const trackDist = gpxLayer.get_distance(); //total track distance in meter
        const trackInfo = gpxLayer._info.duration; //total track duration in seconds
        //console.log('trackInfo: ', trackInfo);
        const starttime =   new Date(trackInfo.start);
        const endtime = new Date(trackInfo.end);
        const duration = (endtime - starttime) / 1000;

        
        if (trackLine && trackLine.getLatLngs) {
            latlngs.push(...trackLine.getLatLngs());
        }
        
        map.fitBounds(gpxLayer.getBounds());
        //map.removeLayer(gpxLayer);

        const speedData = calculateSpeedData(latlngs);
        
        initSlider(map, latlngs);

        initializeControls(latlngs, speedData);

        initializeTrackProgress();


    }).addTo(map);
};

// Slider functionality
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

            }
        }
    });
};

//////////////7

const calculateDistance = (points) => {
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
        distance += points[i].distanceTo(points[i-1]);
    }
    return (distance / 1000).toFixed(2); // Convert to km and format
};

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

const updateStats = (points) => {
    //console.log('points time: ',new Date(points[points.length-1]).getTime())
    const elapsedTime = (points[points.length-1].meta.time - points[0].meta.time)/1000/60;
    const distance = calculateDistance(points);
    const elevation = calculateElevation(points);
    const speed = calculateSpeed(points);
 
    $('#elapsedTime').text(`Elapsed Time: ${elapsedTime.toFixed(0)} min`);
    $('#distance').text(`Distance: ${distance} km`);
    $('#elevation').text(`Current: ${elevation.current}m (↑${elevation.gain}m)`);
    $('#speed').text(`Speed: ${speed.toFixed(2)} km/h`);
};

const updateStatsAnim = (dist, speed, ele) => {
    const distance = dist/1000;
    const elevation = ele;
    const cur_speed = speed;
    
    $('#distance').text(`Distance: ${distance.toFixed(2)} km`);
    $('#elevation').text(`Elevation: ${elevation.toFixed(0)}m `);
    $('#speed').text(`Speed: ${cur_speed.toFixed(2)} km/h`);
};

//////////////// *** code for track play animation ***

let animationInterval;
let isPlaying = false;
let currentTime = 0; // global scope
let trackLayers = [];  // Store all track visualization layers

function initializeControls(latlngs,speedData) {
    const playPauseButton = document.getElementById('play-pause');
    const durationInput = document.getElementById('animation-duration');
    
    playPauseButton.addEventListener('click', () => {
        if (!isPlaying) {
            // Start, Continue animation from current position
            const duration = parseInt(durationInput.value) * 1000; // Convert to milliseconds
            startTrackAnimation(speedData, latlngs, duration, currentTime);
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
        currentTime = 0;
        document.getElementById('play-pause').innerHTML = '<i class="fas fa-play"></i>';
        updateSliderPosition(0);
        //updateTrackProgress(0, latlngs);
        resetTrackDisplay()
    });
}


// calculate a array of speed data points for an track
// a speed point is a object with a startpoint of a segment,
// an average speed value of a segment and cumulated distance up
// to and including this segment.
// the parameter track is a gpx-track represented as a latlgns
// array of objects {lat,lng,meta:{tim,ele}}
function calculateSpeedData(latlngs) {
    const points = latlngs;
    const speedPoints = [];
    let totalDistance = 0;
    
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        // Calculate distance between points
        const segmentDistance = L.latLng(p1.lat, p1.lng).distanceTo(L.latLng(p2.lat, p2.lng));
        
        // Calculate time difference in seconds
        const timeDiff = (p2.meta.time - p1.meta.time) / 1000;
        
        // Calculate speed in km/h
        const speed = (segmentDistance / timeDiff) * 3.6;
        
        totalDistance += segmentDistance;
        
        speedPoints.push({
            distance: totalDistance,
            speed: speed,
            point: p1,
            ele: p1.meta.ele
        });
    }
    
    return speedPoints;
}

//
/**
 * @param {Array} latlngs - An array of objects representing trackpoints with
 * latitude, longitude, meta.ele, and meta.time properties.
 * @param {Array} points - An array of objects representing the set of segments
 * of the track. A segment represents an track element between 2 consecutive points.
 * Properties of a segment is the segment starting point, the average speed within 
 * that segment, a (interpolated) approximation of the elevation of that segment
 * and the acummulated total distance of the track up to and including that segment.
 * @totalDuration - the total duration of the track in ms
 * @startTime - the time in ms when the animation starts or continues
 * @returns {void}
 */
function startTrackAnimation(points, latlngs, totalDuration, startTime=0) {
    clearInterval(animationInterval); //built-in; stops any running animation
    currentTime = startTime;
    
    const speedPoints = points;
    //console.log('speedpoints: ',speedPoints);
    //console.log('length: ',speedPoints.length);
   
    const totalDistance = speedPoints[speedPoints.length-1].distance;

    
    // Reset to start
    //updateSliderPosition(0);
    //updateTrackProgress(0,latlngs)
    
    const intervalStep = 50; // Update every 50ms for smooth animation
    
    // starts a timer with setInterval (built-in)
    animationInterval = setInterval(() => {
        currentTime += intervalStep;
        
        if (currentTime >= totalDuration) {
            clearInterval(animationInterval); // stops animation
            isPlaying = false;
            document.getElementById('play-pause').innerHTML = '<i class="fas fa-play"></i>';
            updateTrackProgress(1,latlngs);
            return;
        }
        
        const progress = currentTime / totalDuration;
        const currentDistance = totalDistance * progress;
        
        // Find current speed based on distance
        const speedAtPoint = interpolateSpeed(currentDistance, speedPoints);
        //console.log('speed at point: ',speedAtPoint);
        const eleAtPoint = interpolateEle(currentDistance, speedPoints);

        updateSliderPosition(progress * 100);

        updateTrackProgress(progress, latlngs);
        updateStatsAnim(currentDistance, speedAtPoint, eleAtPoint);
    }, intervalStep);
}

//
function interpolateSpeed(distance, speedPoints) {
    // Find closest speed point based on distance and return speed approx for segment
    for (let i = 0; i < speedPoints.length - 1; i++) {
        if (distance >= speedPoints[i].distance && distance <= speedPoints[i + 1].distance) {
            const ratio = (distance - speedPoints[i].distance) / 
                         (speedPoints[i + 1].distance - speedPoints[i].distance);
            //const interpolatedSpeed = speedPoints[i].speed + ratio * (speedPoints[i + 1].speed - speedPoints[i].speed);
            //console.log('interpolated speed: ',interpolatedSpeed);
            return speedPoints[i].speed + ratio * (speedPoints[i + 1].speed - speedPoints[i].speed);
        }
    }
    return speedPoints[speedPoints.length - 1].speed;
}

function interpolateEle(distance, speedPoints) {
    // Find closest speed point based on distance and return elevation approx for segment
    for (let i = 0; i < speedPoints.length - 1; i++) {
        if (distance >= speedPoints[i].distance && distance <= speedPoints[i + 1].distance) {
            const ratio = (distance - speedPoints[i].distance) / 
                         (speedPoints[i + 1].distance - speedPoints[i].distance);
            //const interpolatedSpeed = speedPoints[i].speed + ratio * (speedPoints[i + 1].speed - speedPoints[i].speed);
            //console.log('interpolated speed: ',interpolatedSpeed);
            return speedPoints[i].ele + ratio * (speedPoints[i + 1].ele - speedPoints[i].ele);
        }
    }
    return speedPoints[speedPoints.length - 1].ele;
}

//
function updateSliderPosition(percentage) {
    $("#slider").slider("value", percentage);
}

// track progress by play-animation


let progressLine;

function initializeTrackProgress() {
    // Create progress line with style
    progressLine = L.polyline([], {
        color: 'red',
        weight: 5,
        opacity: 0.8
    }).addTo(map);
}

function updateTrackProgress(progress,latlngs) {
    // Clear any existing layers from manual slider movement
    trackLayers.forEach(layer => map.removeLayer(layer));
    trackLayers = [];

    const points = latlngs;
    const pointCount = Math.floor(points.length * progress);
    const progressPoints = points.slice(0, pointCount).map(p => [p.lat, p.lng]);
    progressLine.setLatLngs(progressPoints);
}

//
function resetTrackDisplay() {
    // Clear polyline
    if (progressLine) {
        progressLine.setLatLngs([]);
    }
    
    // Clear any manual slider layers
    trackLayers.forEach(layer => map.removeLayer(layer));
    trackLayers = [];
}
