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
        polyline_options: {
            color: 'blue',
            weight: 2,
            opacity: 0.75
        }
    }).on('loaded', function(e) {
        gpxLayer = e.target;
        const track = gpxLayer._layers[Object.keys(gpxLayer._layers)[0]];
        const trackLine = track._layers[Object.keys(track._layers)[0]];

        if (trackLine && trackLine.getLatLngs) {
            latlngs.push(...trackLine.getLatLngs());
        }
        
        map.fitBounds(gpxLayer.getBounds());
        //map.removeLayer(gpxLayer);
        
        initSlider(map, latlngs);
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
    const distance = calculateDistance(points);
    const elevation = calculateElevation(points);
    const speed = calculateSpeed(points);
    
    $('#distance').text(`Distance: ${distance} km`);
    $('#elevation').text(`Current: ${elevation.current}m (↑${elevation.gain}m)`);
    $('#speed').text(`Speed: ${speed.toFixed(2)} km/h`);
};

