/**
 * @file tracks.js
 * @brief This file contains the JavaScript code for the Tracks page.
 * @details 
 * This program is a web application that allows users to view and interact with GPS tracks stored in a GitHub repository.
 * When started, the program fetches the list of tracks from the GitHub repository and displays them in a table. Following that,
 * additionallly, the program fetches metadata for each track from the GPX files and updates the table with this metadata.
 * The user can browse the table contents, sort the table on different columns and filter the table by track names.
 * When the user wants the currently displayed tracks to be visualized on the table s/he just clicks a refresh button.
 * 
 * 
 * call FancSlider app for a specific track:
 * https://manfredatgit.github.io/FancyGpxTrackSlider/TrackAnim_singleTrack_fancySlider.html?track=
 * 'https://raw.githubusercontent.com/ManfredAtGit/LeafletGpx/refs/heads/main/GpxStore/W20160305.gpx' 
 * 
 * call GpxRace app for a pair of selected tracks
 * 
 */


// Global Scope

let fancySliderBaseUrl = 'https://manfredatgit.github.io/FancyGpxTrackSlider/TrackAnim_singleTrack_fancySlider.html'
let RaceBaseUrl = 'https://manfredatgit.github.io/LeafletGpx/GpxTrackRace/race01.html'
let table;
let map;
let trackLayers = new Map(); // Store track layers with their corresponding row IDs
const trackColors = [
    '#FF0000', '#00FF00', '#0000FF', '#FFA500', '#800080',
    '#008080', '#FFD700', '#FF1493', '#00CED1', '#FF4500'
];

let tableVisible = true;
let mapVisible = true;

$(document).ready(function() {
    // ************************
    // Initialize Leaflet map
    // ************************
    map = L.map('map').setView([51.505, -0.09], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // ******************************
    // **** Initialize DataTable ****
    // ****************************** 
    table = $('#tracksTable').DataTable({
        columns: [
            { data: 'no' },
            { data: 'name' ,className: 'dt-left'},
            { data: 'size' ,className: 'dt-right'},
            { 
                data: 'gpxFile',
                render: function(data, type, row) {
                    return '<a href="' + data + '" target="_blank">' + data + '</a>';
                }
            },
            { data: 'rideDate', defaultContent: '' ,className: 'dt-right'},    // Add defaultContent
            { data: 'rideDistance', defaultContent: '' ,className: 'dt-right'},
            { data: 'rideDuration', defaultContent: '' , className: 'dt-right'},
    
        ],
        data: [] // Empty initially, you can add data later
    });

    // add eventlistener to the table
    $('#tracksTable tbody').on('dblclick', 'tr', function() {
        var row = table.row(this);
        var data = row.data(); 
        if (data) {
            // Open the FancySlider app with the track URL
            var urlPar = data.gpxFile; // Assuming the URL is in the gpxFile
            var url = fancySliderBaseUrl + '?track=' + urlPar;
            window.open(url, '_blank');
        } else {
            console.log('row data is undefined');
        }

    });

    // Click event to toggle the highlight on the row 
    $('#tracksTable tbody').on('click', 'tr', function() { 
        $(this).toggleClass('selected'); 
        updateRaceButtonVisibility();
    });




    // Hide the gpxFile column
    table.column('3').visible(false)


    // *************************************************** 
    // ********** Event Handlers for control buttons ******
    // ***************************************************

    // Click event for the manual filter button 
    /*
    $('#manualFilter').on('click', function() { 
        table.rows().every(function() {
            if (!$(this.node()).hasClass('selected')) { 
                $(this.node()).hide(); 
            } else { $(this.node()).show(); } 
        }); 
        table.draw
    });
    */

    /*
    // Custom search function to filter selected rows 
    $.fn.dataTable.ext.search.push( 
        function(settings, data, dataIndex) { 
            var row = table.row(dataIndex).node(); 
            return $(row).hasClass('selected'); 
        } 
    ); 
    */

    // Click event for the manual filter button 
    $('#manualFilter').on('click', function() { 
        if ($(this).data('filtered')) { 
            // Remove the custom filter 
            $.fn.dataTable.ext.search.pop(); 
            $(this).data('filtered', false); 
        } else { 
            // Apply the custom filter 
            $.fn.dataTable.ext.search.push( 
                function(settings, data, dataIndex) { 
                    var row = table.row(dataIndex).node(); 
                    return $(row).hasClass('selected'); 
                } 
            ); 
            $(this).data('filtered', true); 
        } 
        table.draw(); 
        updateRaceButtonVisibility();
    });

    $('#toggleTable').click(function() {
        if (mapVisible || tableVisible) {
            tableVisible = !tableVisible;
            updateLayout();
        }
    });


    // Click event for the race button 
    $('#race').on('click', function() { 
        var selectedRows = table.rows('.selected').data(); 
        var params = []; 
        selectedRows.each(function(row) { 
            var attribute = row.gpxFile; // Assuming the attribute is in the first column (index 0) 
            params.push(attribute); 
        }); 
        //var baseUrl='file:///D:/Transfer/work/leafletMaps/LeafletGpx/GpxTrackRace/race01.html';
        var url = RaceBaseUrl + '?track1=' + params[0] + '&track2=' + params[1];
        //var url = 'https://example.com/race?tracks=' + params.join(','); 
        window.open(url, '_blank'); 
    });



    // Function to update the visibility of the race button 
    function updateRaceButtonVisibility() { 
        var visibleRows = table.rows({ search: 'applied' }).nodes().to$().filter('.selected').length; 
        if (visibleRows === 2) { 
            $('#race').show(); 
        } else { 
            $('#race').hide(); 
        } 
    }
    

    $('#toggleMap').click(function() {
        if (tableVisible || mapVisible) {
            mapVisible = !mapVisible;
            updateLayout();
        }
    });

    $('#refreshTracks').click(function() {
        // refresh map with currently visible tablerow entries
       updateMap();
    });

    // *******************************
    // load and populate datatable
    // Load data using promise
    // *******************************
    loadGithubGpxFiles()                        // returns a promise
        .then(gpxFiles => {                     // handles successful resolution
            table.rows.add(gpxFiles).draw();    // adds data to the table
            updateTableWithGpxData();           // updates table with metadata from gpx-file
        })
        .catch(error => {
            console.error('Error:', error);
        });  

    // Initial layout update
    updateLayout();

});


/**
 * Update the layout /table-pane, map-pane) based on the current state
 */
function updateLayout() {
    if (tableVisible && mapVisible) {
        $('#table-pane').removeClass('hidden full-width');
        $('#map-pane').removeClass('hidden full-width');
        $('#status').text('Both panes visible');
    } else if (tableVisible) {
        $('#table-pane').removeClass('hidden').addClass('full-width');
        $('#map-pane').addClass('hidden').removeClass('full-width');
        $('#status').text('Table pane visible');
    } else if (mapVisible) {
        $('#map-pane').removeClass('hidden').addClass('full-width');
        $('#table-pane').addClass('hidden').removeClass('full-width');
        $('#status').text('Map pane visible');
    }

    // Update button states
    $('#toggleTable').toggleClass('disabled', tableVisible && !mapVisible);
    $('#toggleMap').toggleClass('disabled', !tableVisible && mapVisible);

    // Give the DOM time to update before resizing the map
    // This ensures the map container has fully expanded before telling Leaflet to redraw the map at its new size. 
    // The 300ms delay matches the CSS transition time defined in your styles.
    setTimeout(() => map.invalidateSize(), 300);
}

/**
 * asyn function that automatically returns a promise
 * loadGithubGpxFiles makes Github Api call and waits for responses and converts to json.
 * Finally returns processed data which resolves the promise.
 * @returns {Promise<Array>} - An array of objects containing track information.
 */
async function loadGithubGpxFiles() {
    // Replace with your GitHub details
    const owner = 'ManfredAtGit';
    const repo = 'LeafLetGpx';
    const path = 'GpxStore';

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
        const files = await response.json();
        
        const gpxFiles = files
            .filter(file => file.name.endsWith('.gpx'))
            .map((file, index) => ({
                no: index + 1,
                name: file.name,
                size: (file.size / 1024).toFixed(2) + ' KB',
                gpxFile: file.download_url
            }));

        return gpxFiles;
    } catch (error) {
        console.error('Error loading GPX files from Github:', error);
        return [];
    }
}

/**
 * Updates the table with metadata from the GPX files.
 * Gpx-files are loaded via L.GPX. Tracks are not displayed at this time
 */
function updateTableWithGpxData() {
    const rows = table.rows().data();
    
    for (let i = 0; i < rows.length; i++) {
        const gpxUrl = rows[i].gpxFile;


        new L.GPX(gpxUrl, {
            async: true
        }).on('loaded', function(e) {
            const gpxLayer = e.target; // Access metadata
            const startTime = gpxLayer.get_start_time();
            const totalDistance = gpxLayer.get_distance();
            const totalTime = gpxLayer.get_total_time();
            const track_movinggTime = gpxLayer.get_moving_time(); //moving time in milsec
            const track_movingSpeed = gpxLayer.get_moving_speed(); //moving speed in km/h
            const metadata = {
                rideDate: startTime.toISOString().slice(0, 10),
                rideDistance: (totalDistance/1000).toFixed(0),
                rideDuration: (totalTime/1000/60).toFixed(0) // in minutes
            };

            if (metadata) {
                table.row(i).data({
                    ...rows[i],
                    ...metadata
                }).draw(false);
            }

        });

    }
}

/**
 * Updates the map when user ccliccks refresh button.
 * The map is cleared from all previously displayed tracks and only visible tracks are displayed. 
 * Visible tracks are those selected by user and currently displayed in the datatable
 * After loading all visible tracks, the map is zoomed to the bounds of all visible tracks.
 * A marker is added to each track. When marker or trackline is clicked, additional info is displayed in a popup
 */
function updateMap() {
    //console.log("inside updateMap");
    let loadedTracks = 0;
    let trackBounds = [];
    const visibleRows = table.rows({ search: 'applied' }).data();

    // Clear all existing tracks
    trackLayers.forEach(layer => map.removeLayer(layer));
    trackLayers.clear();

    // Add tracks for visible rows only
    $('#status').text('updating map .. please wait');

    visibleRows.each(function(value,index) {
        //console.log('name:', value.name);
        const colorIndex = index % trackColors.length;

        new L.GPX(value.gpxFile, {
            async: true,
            polyline_options: {
                color: trackColors[colorIndex],
                weight: 3,
                opacity: 0.8
            }
        }).on('loaded', function(e) {

            //if (isUpdatingTable) return;
            const gpxLayer = e.target;
            //const trackStats = getTrackStats(gpxLayer);
          
            loadedTracks++;
            trackLayers.set(value.no, e.target);
            trackBounds.push(e.target.getBounds());
            
            if (loadedTracks === visibleRows.count()) {
                const bounds = L.latLngBounds(trackBounds);
                map.fitBounds(bounds);
            }
        }).on('click', function(e) { 
            const popupContent = 
                ` <b>Track Information</b><br> 
                Start Time: ${e.target.get_start_time().toISOString().slice(0, 16)}<br> 
                Total Distance: ${(e.target.get_distance()/1000).toFixed(0)} km<br> 
                Total Time: ${(e.target.get_total_time()/1000/60).toFixed(0)} min <br>
                Moving Time: ${(e.target.get_moving_time()/1000/60).toFixed(0)} min <br>
                Moving Speed: ${(e.target.get_moving_speed()).toFixed(2)} km/h <br>
            `; 
            L.popup() 
                .setLatLng(e.latlng) 
                .setContent(popupContent) 
                .openOn(map); 
        }).addTo(map);
        
        $('#status').text('map updated: Ready');
    });

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

/*
////// DEPRECATED
*/

async function processGpxMetadata(url) {
    try {
        const response = await fetch(url);
        const gpxData = await response.text();
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxData, "text/xml");
        
        // Extract metadata
        const startTime = gpxDoc.querySelector('time').textContent;
        const trackPoints = gpxDoc.querySelectorAll('trkpt');
        
        // Calculate distance and duration
        // ... (implement your distance calculation)
        const duration = '00:00:00'; // ... (implement your duration calculation)
        const distance = '0.000 km'; // ... (implement your distance calculation)
        
        return {
            rideDate: new Date(startTime),
            rideDistance: distance,
            rideDuration: duration
        };
    } catch (error) {
        console.error('Error processing GPX:', error);
        return null;
    }
}


//document.addEventListener("DOMContentLoaded", function() 
async function processGpxMeta(url) { 
    const gpxUrl = url; // URL to your GPX file 
    const gpx = L.GPX(gpxUrl, {
        async: true 
    }).on('loaded', function(e) {
         const gpxLayer = e.target; // Access metadata 
         const startTime = gpxLayer.get_start_time(); 
         const totalDistance = gpxLayer.get_distance(); 
         const totalTime = gpxLayer.get_total_time(); 
         console.log("Start Time:", startTime); 
         console.log("Total Distance (meters):", totalDistance);
         console.log("Total Time (milliseconds):", totalTime); 
    }); 
};

