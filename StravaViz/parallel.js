// Parallel Coordinates
// Copyright (c) 2012, Kai Chang
// Released under the BSD License: http://opensource.org/licenses/BSD-3-Clause

/*
invert: o.k.
brush: o.k.
drag: o.k

brush, un-brush: o.k.
brush-invert: o-k

dblclick on datatable row: o.k.

deactivated hack to re-draw ticks within current brush-extent/selection
  update-ticks after brush : not.o.k.

exclude/include/export: not tested yet


implementation details:
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
*/
const fancySliderBaseUrl = 'https://manfredatgit.github.io/FancyGpxTrackSlider/TrackAnim_singleTrack_fancySlider.html'
const gitHub_StravaGpxDirUrl ='https://raw.githubusercontent.com/ManfredAtGit/LeafletGpx/refs/heads/main/StravaViz/StravaGpxDir/'

let width = document.body.clientWidth;
let height = Math.max(document.body.clientHeight - 540, 240);

const margins = { top: 60, right: 0, bottom: 10, left: 0 };
const w = width - margins.left - margins.right;
const h = height - margins.top - margins.bottom;

const xscale = d3.scalePoint().range([0, w]).padding(1);
let yscale = {};
const dragging = {};

const line = d3.line();
const axis = d3.axisLeft();

let data,
    foreground,
    background,
    highlighted,
    dimensions,
    dimbrush_index = [],
    legend;

let render_speed = 50;
let brush_count = 0;
//let initialBrushPosition = null;
//let finalBrushPosition = null;
let excluded_groups = [];

// context object
const ctx = {};


const colors = {
    "Dortmund-Umgebung": [185,56,73],
    "Niere-Phoenix-rides": [37,50,75],
    "tour": [325,50,39],
    "RTF": [10,28,67],
    "Brevet": [271,39,57],
    "virtuell": [56,58,73],
    "special": [28,100,52],
    "loadable": [41,75,61],
    "xxx": [60,86,61]
  };

/*
const colors = {
    "Baby Foods": [185,56,73],
    "Baked Products": [37,50,75],
    "Beef Products": [325,50,39],
    "Beverages": [10,28,67],
    "Breakfast Cereals": [271,39,57],
    "Cereal Grains and Pasta": [56,58,73],
    "Dairy and Egg Products": [28,100,52],
    "Ethnic Foods": [41,75,61],
    "Fast Foods": [60,86,61],
    "Fats and Oils": [30,100,73],
    "Finfish and Shellfish Products": [318,65,67],
    "Fruits and Fruit Juices": [274,30,76],
    "Lamb, Veal, and Game Products": [20,49,49],
    "Legumes and Legume Products": [334,80,84],
    "Meals, Entrees, and Sidedishes": [185,80,45],
    "Nut and Seed Products": [10,30,42],
    "Pork Products": [339,60,49],
    "Poultry Products": [359,69,49],
    "Restaurant Foods": [204,70,41],
    "Sausages and Luncheon Meats": [1,100,79],
    "Snacks": [189,57,75],
    "Soups, Sauces, and Gravies": [110,57,70],
    "Spices and Herbs": [214,55,79],
    "Sweets": [339,60,75],
    "Vegetables and Vegetable Products": [120,56,40]
  };
*/

// Scale chart and canvas height
d3.select("#chart")
    .style("height", (h + margins.top + margins.bottom) + "px")

d3.selectAll("canvas")
    .attr("width", w)
    .attr("height", h)    
    //.style("padding", margins.join("px ") + "px");
    .style("padding", `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`);


// Foreground canvas for primary view
foreground = document.getElementById('foreground').getContext('2d');
foreground.globalCompositeOperation = "destination-over";
foreground.strokeStyle = "rgba(0,100,160,0.1)";
foreground.lineWidth = 1.7;
foreground.fillText("Loading...",w/2,h/2);

// Highlight canvas for temporary interactions
highlighted = document.getElementById('highlight').getContext('2d');
highlighted.strokeStyle = "rgba(0,100,160,1)";
highlighted.lineWidth = 4;

// Background canvas
background = document.getElementById('background').getContext('2d');
background.strokeStyle = "rgba(0,100,160,0.1)";
background.lineWidth = 1.7;

// SVG for ticks, labels, and interactions
var svg = d3.select("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", w + margins.right + margins.left)
    .attr("height", h + margins.top + margins.bottom)
  .append("g")
    .attr("transform", "translate(" + margins.left + "," + margins.top + ")");


// Updated Initialization Code

// ???
/*
function createScales(dimensions) {
  dimensions.forEach(dim => {
    yscale[dim] = d3.scaleLinear()
      .domain(d3.extent(data, d => d[dim]))
      .range([h, 0]);
  });
}
*/

// This function renderAxes takes an SVG element and an array of dimensions. For each dimension, 
// it appends a new group (<g>) element to the SVG, sets its class to axis, translates it horizontally 
// based on the xscale function, and calls the axis function with the corresponding y-scale to add the axis to the group element.
function renderAxes(svg, dimensions) {
  dimensions.forEach(dim => {
    const g = svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${xscale(dim)}, 0)`);

    g.call(axis.scale(yscale[dim]));
  });
}


// get data
//d3.csv("https://gist.githubusercontent.com/syntagmatic/3150059/raw/5b3783a9ab58fb216a10a81c2b03b576b21d8c7a/nutrients.csv")
//d3.csv("https://raw.githubusercontent.com/ManfredAtGit/LeafletGpx/9a2a272ec8a0e815e7c926550ffc431b4820f996/StravaViz/strava2_pc_statistics.csv")
d3.csv("https://raw.githubusercontent.com/ManfredAtGit/LeafletGpx/refs/heads/main/StravaViz/strava2_pc_statistics.csv")
    .then(raw_data => {
        // Convert quantitative scales to floats
        data = raw_data.map(d => {
            for (var k in d) {
            if (!_.isNaN(raw_data[0][k] - 0) && k != 'id') {
                d[k] = parseFloat(d[k]) || 0;
            }
            };
            return d;
        });

        // Initialize yscale for each dimension (from first row of csv-file )
        dimensions = Object.keys(data[0]).filter(function(k) { 
          if (typeof data[0][k] === 'number') { 
            yscale[k] = d3.scaleLinear()
              .domain(d3.extent(data, function(d) { return +d[k]; }))
              .range([h, 0]); 
            return true; 
          } 
          return false; 
        }).sort(); 

        // init mapping between dimensions and brush-index 
        dimensions.forEach(function(d,i) {
          dimbrush_index[d] = i;
        });
        
        // Set the domain of xscale
        xscale.domain(dimensions);

        // Add a group element for each dimension.
        // This code snippet selects all elements with the class dimension within the svg element, binds the dimensions array to the selection, 
        // and creates a new group (<g>) element for each data element. 
        // It sets the class of each group to dimension and translates each group horizontally based on the xscale function.

        var g = svg.selectAll(".dimension")
            .data(dimensions)
            .enter().append("g")
            .attr("class", "dimension")
            .attr("transform", function(d) { 
              //console.log("inside g d:  ",d)
              return "translate(" + xscale(d) + ")"; 
            })
            .call(d3.drag()

                .on("start", function(event,d) {
                  console.log("%cinside on-drag-start d:  ","color: blue; font-size: 10px;",d);
                  event.sourceEvent.stopPropagation();
                  dragging[d] = this.__origin__ = xscale(d);
                  this.__dragged__ = false;
                  d3.select("#foreground").style("opacity", "0.35");
                })
                .on("drag", function(event,d) {
                  event.sourceEvent.stopPropagation();
                  dragging[d] = Math.min(w, Math.max(0, this.__origin__ += event.dx));
                  dimensions.sort(function(a, b) { return position(a) - position(b); });
                  xscale.domain(dimensions);

                  // mapping between dimensions and brush-index must be re-established after re-ordering dimensions 
                  // (otherwise, brush operations dependant on indexing will fail)
                  //dimensions.forEach(function(d,i) {
                  //   dimbrush_index[d] = i;
                  //});


                  g.attr("transform", function(d) { return "translate(" + position(d) + ")"; });
                  brush_count++;
                  this.__dragged__ = true;
      
                  // Feedback for axis deletion if dropped
                  if (dragging[d] < 12 || dragging[d] > w-12) {
                    console.log("dragging-d: ",dragging[d]);
                    d3.select(this).select(".overlay").style("fill", "#b00");
                  } else {
                    d3.select(this).select(".overlay").style("fill", null);
                  }
                })
                // handles the end of a drag event. It checks if the element was dragged, reorders the axes, updates the brush extents, 
                // and provides visual feedback for axis deletion if the axis is dropped near the edges. It also ensures that the scales 
                // and ticks are updated correctly and cleans up custom properties

                .on("end", function(event,d) {
                  console.log("%cinside on-drag-end", "color: blue; font-size: 10px;");
                  //event.sourceEvent.stopPropagation();
                  if (!this.__dragged__) {
                    console.log('inside on-end-not dragged');
                    // no movement, invert axis
                    var extent = invert_axis(d);
                    console.log("extent: ",extent);
                  } else {
                    // reorder axes
                    d3.select(this).transition().attr("transform", "translate(" + xscale(d) + ")");
                    //var extent = yscale[d].brush.extent();
                    //var extent = d3.brushSelection(yscale[d].brush.node());
                    var extent = d3.brushSelection(d3.select(this).select(".brush").node());
                  }

                  // set context to let the directly subsequent brush event know, that the event is not a brush event
                  setContext('ignore_brushend',true);
                
                  // remove axis if dragged all the way left
                  if (dragging[d] < 12 || dragging[d] > w - 12) {
                    remove_axis(d, g);
                  }
                
                  // TODO required to avoid a bug
                  // ???????????????????????
                  xscale.domain(dimensions);
                  update_ticks(d, extent);
                
                  // rerender
                  d3.select("#foreground").style("opacity", null);
                  brushed();
                  delete this.__dragged__;
                  delete this.__origin__;
                  delete dragging[d];
                })
                
            );
          
          
        
        // This code snippet appends a new group (<g>) element to the selection g, sets its class to axis, and translates it to the origin. 
        // It then calls the axis function with the scale for the current dimension d to add the axis to the group element. 
        // Next, it appends a new text (<text>) element to the group, sets its attributes for positioning and styling, 
        // and adds a title (<title>) element with a tooltip text.
        g.append("g")
          .attr("class", "axis")
          .attr("transform", "translate(0,0)")
          .each(function(d) { d3.select(this).call(axis.scale(yscale[d])); })
          .append("text")
          .attr("text-anchor", "middle")
          .attr("y", function(d,i) { return i % 2 === 0 ? -14 : -30; })
          .attr("x", 0)
          .attr("class", "label")
          .text(String)
          .append("title")
            .text("Click to invert. Drag to reorder");
        
        // Add and store a brush for each axis.
        // This code snippet appends a new group (<g>) element to the selection g, sets its class to brush, and adds a brush for each axis 
        // (calls the brush function with the y-scale for the current dimension d).
        // It then selects all <rect> elements within the group, sets their visibility, position, and width, and appends a title (<title>) 
        // element with a tooltip text.

        g.append("g")
          .attr("class", "brush")
          .attr("id", function(d, i) { return "brush-" + i; }) // Add unique ID to each brush
          .each(function(d) { 
            var initialBrushPosition = null
            d3.select(this)
            .call(yscale[d].brush = d3.brushY().extent([[0, 0], [36, h]])

            .on("start", function(event) { brushStart.call(this, event, yscale, d); }) 
            .on("brush", function(event) { brushed.call(this, event); }) 
            .on("end", function(event) { brushEnd.call(this, event, yscale, d); })

            );
          })
          .selectAll("rect")
          .style("visibility", null)
          .attr("x", -23)
          .attr("width", 36)
          .append("title")
            .text("Drag up or down to brush along this axis");

        g.selectAll(".selection")
        .append("title")
          .text("Drag or resize this filter");


        legend = create_legend(colors,brushed);
        
        // Render full foreground
        brushed();

    })
    .catch(error => {
        console.log(error);
    });


// This code defines a brush function that handles brushing interactions in a D3.jsvisualization. It filters active dimensions, 
// updates the styles of text elements based on the brush extents, performs a free text search, enables or disables buttons, 
// groups the selected data points by their group, updates the legend, and renders the selected lines.
function brushed() {

    brush_count++;
    console.log("inside brushed, brush_count: " + brush_count);
    //var actives = dimensions.filter(function(p) { return !yscale[p].brush.empty(); }),
    // v6-version
    var actives = dimensions.filter(function(p,i) {
      //var brushSelection = d3.brushSelection(d3.select(".brush").node());
      var brush_ind = dimbrush_index[p];
      var brushSelection = d3.brushSelection(d3.select("#brush-" + brush_ind).node());
      return brushSelection !== null;
    });

    /*
    // Get extents for active dimensions 
    var extents = actives.map(function(p,i) { 
      var brushSelection = d3.brushSelection(d3.select("#brush-" + i).node()); 
      return brushSelection !== null; 
    });
    */

    // Get extents for active dimensions 
    var extents = [];
    actives.map(function(p,i) { 
      // get index of actives element in dimension array; we need this for the brush id
      var ind = dimensions.indexOf[p];
      var brush_ind = dimbrush_index[p];
      var brushSelection = d3.brushSelection(d3.select("#brush-" + brush_ind).node()); 
      if (brushSelection) {extents.push(brushSelection) }
    });


    //var extents = actives.map(function(p) { return yscale[p].brush.extent(); });
    //console.log('extents:  ',extents)
    
    // hack to hide ticks beyond extent
    /*
    var b = d3.selectAll('.dimension').nodes()
      .forEach(function(element, i) {
        var dimension = d3.select(element).data()[0];
        if (_.include(actives, dimension)) {
          var extent = extents[actives.indexOf(dimension)];
          d3.select(element)
            .selectAll('text')
            .style('font-weight', 'bold')
            .style('font-size', '13px')
            .style('display', function() { 
              var value = d3.select(this).data();
              return extent && extent[0] <= value && value <= extent[1] ? null : "none"
            });
        } else {
          d3.select(element)
            .selectAll('text')
            .style('font-size', null)
            .style('font-weight', null)
            .style('display', null);
        }
        d3.select(element)
          .selectAll('.label')
          .style('display', null);
      });
      ;
      */


    // bold dimensions with label
    d3.selectAll('.label')
      .style("font-weight", function(dimension) {
        if (_.include(actives, dimension)) return "bold";
        return null;
      });
  

    // Get lines within extents

    var selected = [];
    data
      .filter(function(d) {
        //return d.group == "Spices and Herbs";
        return !_.contains(excluded_groups, d.group);
      })
      .map(function(d) {
        return actives.every(function(p, dimension) {
          //console.log("d, p, dimension: ",  d, p, dimension);
          //console.log("d-p-dimension, extents: ",d[p], extents);
          //if (extents) console.log(d[p], extents[dimension][0], extents[dimension][1]);
          var extent =  extents[dimension].map(yscale[p].invert);
          //return extents[dimension][0] <= d[p] && d[p] <= extents[dimension][1];
          //console.log(d[p], extent[0], extent[1]);
          // imortant: extents is in screen coordinates where top-left = (0,0); so extent[0] is upper bound and extent[1] is lower bound
          //return  (extent[1] <= d[p] && d[p] <= extent[0]);
          return yscale[p].inverted ? (extent[0] <= d[p] && d[p] <= extent[1]) : (extent[1] <= d[p] && d[p] <= extent[0]);
        
        }) ? selected.push(d) : null;
      });
  
    // free text search
    //var query = d3.select("#search")[0][0].value;
    var query = d3.select("#search").node().value;
    if (query.length > 0) {
      selected = search(selected, query);
    }
  
    if (selected.length < data.length && selected.length > 0) {
      d3.select("#keep-data").attr("disabled", null);
      d3.select("#exclude-data").attr("disabled", null);
    } else {
      d3.select("#keep-data").attr("disabled", "disabled");
      d3.select("#exclude-data").attr("disabled", "disabled");
    };
  
    // total by food group
    var tallies = _(selected)
      .groupBy(function(d) { return d.group; })
  
    // include empty groups
    _(colors).each(function(v,k) { tallies[k] = tallies[k] || []; });
  
    legend
      .style("text-decoration", function(d) { return _.contains(excluded_groups,d) ? "line-through" : null; })
      .attr("class", function(d) {
        return (tallies[d].length > 0)
             ? "row"
             : "row off";
      });
  
    legend.selectAll(".color-bar")
      .style("width", function(d) {
        return Math.ceil(600*tallies[d].length/data.length) + "px"
      });
  
    legend.selectAll(".tally")
      .text(function(d,i) { return tallies[d].length });  
  
    // Render selected lines
    console.log("selegted.lenght: ", selected.length);
    paths(selected, foreground, brush_count, true);
  


}

function create_legend(colors,brush) {
  // create legend
  var legend_data = d3.select("#legend")
    .html("")
    .selectAll(".row")
    .data( _.keys(colors).sort() )

  // filter by group
  var legend = legend_data
    .enter().append("div")
      .attr("title", "Hide group")
      .on("click", function(event,d) { 
        // toggle food group
        if (_.contains(excluded_groups, d)) {
          d3.select(this).attr("title", "Hide group")
          excluded_groups = _.difference(excluded_groups,[d]);
          brushed();
        } else {
          d3.select(this).attr("title", "Show group")
          excluded_groups.push(d);
          brushed();
        }
      });

  legend
    .append("span")
    .style("background", function(d,i) { return color(d,0.85)})
    .attr("class", "color-bar");

  legend
    .append("span")
    .attr("class", "tally")
    .text(function(d,i) { return 0});  

  legend
    .append("span")
    .text(function(d,i) { return " " + d});  

  return legend;
}

// render a set of polylines on a canvas
function paths(selected, ctx, count) {
  var n = selected.length,
      i = 0,
      opacity = d3.min([2/Math.pow(n,0.3),1]),
      timer = (new Date()).getTime();

  selection_stats(opacity, n, data.length)

  shuffled_data = _.shuffle(selected);

  data_table(shuffled_data.slice(0,25));

  ctx.clearRect(0,0,w+1,h+1);

  // render all lines until finished or a new brush event
  function animloop(){
    if (i >= n || count < brush_count) return true;
    var max = d3.min([i+render_speed, n]);
    render_range(shuffled_data, i, max, opacity);
    render_stats(max,n,render_speed);
    i = max;
    timer = optimize(timer);  // adjusts render_speed
  };

  d3.timer(animloop);
}

function path(d, ctx, color) {
  if (color) ctx.strokeStyle = color;
  ctx.beginPath();
  var x0 = xscale(0)-15,
      y0 = yscale[dimensions[0]](d[dimensions[0]]);   // left edge
  ctx.moveTo(x0,y0);
  dimensions.map(function(p,i) {
    var x = xscale(p),
        y = yscale[p](d[p]);
    var cp1x = x - 0.88*(x-x0);
    var cp1y = y0;
    var cp2x = x - 0.12*(x-x0);
    var cp2y = y;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    x0 = x;
    y0 = y;
  });
  ctx.lineTo(x0+15, y0);                               // right edge
  ctx.stroke();
};


function color(d,a) {
  var c = colors[d];
  return ["hsla(",c[0],",",c[1],"%,",c[2],"%,",a,")"].join("");
}

function position(d) {
  var v = dragging[d];
  return v == null ? xscale(d) : v;
}

function invert_axis(d) {
  var ind = dimensions.indexOf(d)
  console.log('inside invert axis:  d, inverted on enter:',d, yscale[d].inverted);
  console.log('yscale[d]-range on enter:', yscale[d].range());
  // save extent before inverting
  //var extent = d3.brushSelection(yscale[d].brush.node());
  var brush_ind = dimbrush_index[d];
  var extent = d3.brushSelection(d3.select("#brush-" + brush_ind).node());
  console.log('extent on enter:', extent);
  //var extent = d3.brushSelection(d3.select(this).select(".brush").node());
 


  // note: in d3-v6, inverted is no longer a standard property of the scale
  // however, it can be added to the object like any other property
  if (yscale[d].inverted == true) {
    yscale[d].range([h, 0]);
    d3.selectAll('.label')
      .filter(function(p) { return p == d; })
      .style("text-decoration", null);
    // distance between extent and OLD max-range (h)
    if (extent) {extent=[h-extent[1], h-extent[0]];}
    //var extDist = [h-extent[1], h-extent[0]];
    //extent = extDist;
    yscale[d].inverted = false;
  } else {
    yscale[d].range([0, h]);
    d3.selectAll('.label')
      .filter(function(p) { return p == d; })
      .style("text-decoration", "underline");
     // distance between extent and OLD min-range (0)
     if (extent) {extent=[h-extent[1], h-extent[0]];}
    //var extDist = [h-extent[1], h-extent[0]];
    //extent = extDist;
    yscale[d].inverted = true;
  }

  console.log('yscale[d]-range on exit:', yscale[d].range());
  console.log('extent on exit:', extent);
  //console.log('inverted on exit:', yscale[d].inverted);
  if (extent) console.log('extent on exit yscaled in domain: ',[yscale[d].invert(extent[0]), yscale[d].invert(extent[1])]);
  return extent;
}

function remove_axis(d, g) {
  // Remove the specified dimension
  dimensions = _.difference(dimensions, [d]);

  // Update the scale domain
  xscale.domain(dimensions);

  // Update the axis positions
  g.attr("transform", function(p) { return "translate(" + position(p) + ")"; });

  // Remove the axis for the specified dimension
  g.filter(function(p) { return p == d; }).remove();

  // Update the ticks on the remaining axes
  update_ticks();
}


// transition ticks for reordering, rescaling and inverting
function update_ticks(d, extent) {
  // update brushes
 
  // update brushes
  if (d) {
      var brush_el = d3.selectAll(".brush")
          .filter(function(key) { 
            //console.log('inside update_ticks: key und d  ',key,d);
            return key == d; });

      // single tick
      if (extent) {
          // restore previous extent
          yscale[d].brush = d3.brushY().extent([[0, 0], [36, h]])
          
          .on("start", function(event) { brushStart.call(this, event, yscale, d); }) 
          .on("brush", function(event) { brushed.call(this, event); }) 
          .on("end", function(event) { brushEnd.call(this, event, yscale, d); })
          
          ;
          brush_el.call(yscale[d].brush);
          brush_el.call(yscale[d].brush.move, extent);
      } else {
          yscale[d].brush = d3.brushY().extent([[0, 0], [36, h]])
          .on("start", function(event) { brushStart.call(this, event, yscale, d); }) 
          .on("brush", function(event) { brushed.call(this, event); }) 
          .on("end", function(event) { brushEnd.call(this, event, yscale, d); })
          ;
          
          brush_el.call(yscale[d].brush);
      }
  } else {
      // all ticks
      d3.selectAll(".brush")
          .each(function(d) {
            yscale[d].brush = d3.brushY().extent([[0, 0], [36, h]])
            .on("start", function(event) { brushStart.call(this, event, yscale, d); }) 
            .on("brush", function(event) { brushed.call(this, event); }) 
            .on("end", function(event) { brushEnd.call(this, event, yscale, d); })
            ;
            
            d3.select(this).call(yscale[d].brush);
          });
  }

  brush_count++;

  show_ticks();

  // update axes
  d3.selectAll(".axis")
    .each(function(d,i) {
      // hide lines for better performance
      d3.select(this).selectAll('line').style("display", "none");

      // transition axis numbers
      d3.select(this)
        .transition()
        .duration(720)
        .call(d3.axisLeft(yscale[d]));

      // bring lines back
      d3.select(this).selectAll('line').transition().delay(800).style("display", null);

      d3.select(this)
        .selectAll('text')
        .style('font-weight', null)
        .style('font-size', null)
        .style('display', null);
    });
}


// Feedback on selection
function selection_stats(opacity, n, total) {
  d3.select("#data-count").text(total);
  d3.select("#selected-count").text(n);
  d3.select("#selected-bar").style("width", (100*n/total) + "%");
  d3.select("#opacity").text((""+(opacity*100)).slice(0,4) + "%");
}

// render polylines i to i+render_speed 
function render_range(selection, i, max, opacity) {
  selection.slice(i,max).forEach(function(d) {
    path(d, foreground, color(d.group,opacity));
  });
};

// Adjusts rendering speed 
function optimize(timer) {
  var delta = (new Date()).getTime() - timer;
  render_speed = Math.max(Math.ceil(render_speed * 30 / delta), 8);
  render_speed = Math.min(render_speed, 300);
  return (new Date()).getTime();
}

// Feedback on rendering progress
function render_stats(i,n,render_speed) {
  d3.select("#rendered-count").text(i);
  d3.select("#rendered-bar")
    .style("width", (100*i/n) + "%");
  d3.select("#render-speed").text(render_speed);
}


// simple data table
function data_table(sample) {
  // sort by first column
  var sample = sample.sort(function(a,b) {
    var col = Object.keys(a)[0];
    return a[col] < b[col] ? -1 : 1;
  });

  var table = d3.select("#food-list")
    .html("")
    .selectAll(".row")
      .data(sample)
    .enter().append("div")
      .on("mouseover", highlight)
      .on("mouseout", unhighlight)
      .on("dblclick", function(event,d) { 
        console.log("Div was double-clicked!", d.TrackUrl); 
        var urlPar = d.TrackUrl;
        if (urlPar.length < 2) {
          alert("No gpx-track available.\n\nTry another activity from list. ");
        } else{
          var url = fancySliderBaseUrl + '?track=' + urlPar;
          window.open(url, '_blank');
        }
      })
      ;

  table
    .append("span")
      .attr("class", "color-block")
      .style("background", function(d) { return color(d.group,0.85) })

  table
    .append("span")
      .text(function(d) { return d.name; })
}


// Highlight single polyline
function highlight(event,d) {
  d3.select("#foreground").style("opacity", "0.25");
  d3.selectAll(".row").style("opacity", function(p) { return (d.group == p) ? null : "0.3" });
  path(d, highlighted, color(d.group,1));
}

// Remove highlight
function unhighlight() {
  d3.select("#foreground").style("opacity", null);
  d3.selectAll(".row").style("opacity", null);
  highlighted.clearRect(0,0,w,h);
}

// Get polylines within extents
// (same code as in brushed)
function actives() {

  var actives = dimensions.filter(function(p,i) {
    //var brushSelection = d3.brushSelection(d3.select(".brush").node());
    var brush_ind = dimbrush_index[p];
    var brushSelection = d3.brushSelection(d3.select("#brush-" + brush_ind).node());
    return brushSelection !== null;
  });

  // Get extents for active dimensions 
  var extents = [];
  actives.map(function(p,i) { 
    // get index of actives element in dimension array; we need this for the brush id
    //var ind = dimensions.indexOf[p];
    var brush_ind = dimbrush_index[p];
    var brushSelection = d3.brushSelection(d3.select("#brush-" + brush_ind).node()); 
    if (brushSelection) {extents.push(brushSelection) }
  });

    // Get lines within extents

  var selected = [];
  data
    .filter(function(d) {
      //return d.group == "Spices and Herbs";
      return !_.contains(excluded_groups, d.group);
    })
    .map(function(d) {
      return actives.every(function(p, dimension) {
        //console.log("d, p, dimension: ",  d, p, dimension);
        //console.log("d-p-dimension, extents: ",d[p], extents);
        //if (extents) console.log(d[p], extents[dimension][0], extents[dimension][1]);
        var extent =  extents[dimension].map(yscale[p].invert);
        //return extents[dimension][0] <= d[p] && d[p] <= extents[dimension][1];
        //console.log(d[p], extent[0], extent[1]);
        // imortant: extents is in screen coordinates where top-left = (0,0); so extent[0] is upper bound and extent[1] is lower bound
        //return  (extent[1] <= d[p] && d[p] <= extent[0]);
        return yscale[p].inverted ? (extent[0] <= d[p] && d[p] <= extent[1]) : (extent[1] <= d[p] && d[p] <= extent[0]);
      
      }) ? selected.push(d) : null;
    });  

    // free text search
    //var query = d3.select("#search")[0][0].value;
    var query = d3.select("#search").node().value;
    if (query.length > 0) {
      selected = search(selected, query);
    }

    return selected;
}

// Remove all but selected from the dataset
function keep_data() {
  new_data = actives();
  if (new_data.length == 0) {
    alert("I don't mean to be rude, but I can't let you remove all the data.\n\nTry removing some brushes to get your data back. Then click 'Keep' when you've selected data you want to look closer at.");
    return false;
  }
  data = new_data;
  rescale();
}

// Exclude selected from the dataset
function exclude_data() {
  new_data = _.difference(data, actives());
  if (new_data.length == 0) {
    alert("I don't mean to be rude, but I can't let you remove all the data.\n\nTry selecting just a few data points then clicking 'Exclude'.");
    return false;
  }
  data = new_data;
  rescale();
}


// Export data
/*
function export_csv() {
  var keys = Object.keys(data[0]);
  var rows = actives().map(function(row) {
    return keys.map(function(k) { return row[k]; })
  });
  var csv = d3.csv.format([keys].concat(rows)).replace(/\n/g,"<br/>\n");
  var styles = "<style>body { font-family: sans-serif; font-size: 12px; }</style>";
  window.open("text/csv").document.write(styles + csv);
}
*/

function export_csv() {
  var keys = Object.keys(data[0]);
  var rows = actives().map(function(row) {
    return keys.map(function(k) { return row[k]; });
  });
  var csv = d3.csvFormat([keys].concat(rows)).replace(/\n/g, "<br/>\n");
  var styles = "<style>body { font-family: sans-serif; font-size: 12px; }</style>";
  var newWindow = window.open("text/csv");
  newWindow.document.write(styles + csv);
}


/*
// scale to window size
window.onresize = function() {
  width = document.body.clientWidth,
  height = d3.max([document.body.clientHeight-500, 220]);

  w = width - m[1] - m[3],
  h = height - m[0] - m[2];

  d3.select("#chart")
      .style("height", (h + m[0] + m[2]) + "px")

  d3.selectAll("canvas")
      .attr("width", w)
      .attr("height", h)
      .style("padding", m.join("px ") + "px");

  d3.select("svg")
      .attr("width", w + m[1] + m[3])
      .attr("height", h + m[0] + m[2])
    .select("g")
      .attr("transform", "translate(" + m[3] + "," + m[0] + ")");
  
  xscale = d3.scale.ordinal().rangePoints([0, w], 1).domain(dimensions);
  dimensions.forEach(function(d) {
    yscale[d].range([h, 0]);
  });

  d3.selectAll(".dimension")
    .attr("transform", function(d) { return "translate(" + xscale(d) + ")"; })
  // update brush placement
  d3.selectAll(".brush")
    .each(function(d) { d3.select(this).call(yscale[d].brush = d3.svg.brush().y(yscale[d]).on("brush", brush)); })
  brush_count++;

  // update axis placement
  axis = axis.ticks(1+height/50),
  d3.selectAll(".axis")
    .each(function(d) { d3.select(this).call(axis.scale(yscale[d])); });

  // render data
  brush();
};
*/

// Rescale to new dataset domain
function rescale() {
  // reset yscales, preserving inverted state
  dimensions.forEach(function(d,i) {
    if (yscale[d].inverted) {
      yscale[d] = d3.scaleLinear()
          .domain(d3.extent(data, function(p) { return +p[d]; }))
          .range([0, h]);
      yscale[d].inverted = true;
    } else {
      yscale[d] = d3.scaleLinear()
          .domain(d3.extent(data, function(p) { return +p[d]; }))
          .range([h, 0]);
    }
  });

  update_ticks();

  // Render selected data
  paths(data, foreground, brush_count);
}


d3.select("#keep-data").on("click", keep_data);
d3.select("#exclude-data").on("click", exclude_data);
d3.select("#export-data").on("click", export_csv);
d3.select("#search").on("keyup", brushed);


// Appearance toggles
d3.select("#hide-ticks").on("click", hide_ticks);
d3.select("#show-ticks").on("click", show_ticks);
d3.select("#dark-theme").on("click", dark_theme);
d3.select("#light-theme").on("click", light_theme);

function hide_ticks() {
  d3.selectAll(".axis g").style("display", "none");
  //d3.selectAll(".axis path").style("display", "none");
  d3.selectAll(".background").style("visibility", "hidden");
  d3.selectAll("#hide-ticks").attr("disabled", "disabled");
  d3.selectAll("#show-ticks").attr("disabled", null);
};

function show_ticks() {
  d3.selectAll(".axis g").style("display", null);
  //d3.selectAll(".axis path").style("display", null);
  d3.selectAll(".background").style("visibility", null);
  d3.selectAll("#show-ticks").attr("disabled", "disabled");
  d3.selectAll("#hide-ticks").attr("disabled", null);
};


function dark_theme() {
  d3.select("body").attr("class", "dark");
  d3.selectAll("#dark-theme").attr("disabled", "disabled");
  d3.selectAll("#light-theme").attr("disabled", null);
}

function light_theme() {
  d3.select("body").attr("class", null);
  d3.selectAll("#light-theme").attr("disabled", "disabled");
  d3.selectAll("#dark-theme").attr("disabled", null);
}

function search(selection,str) {
  pattern = new RegExp(str,"i")
  return _(selection).filter(function(d) { return pattern.exec(d.name); });
}

function reset_brushExtend(brushElem, brush) {
  console.log("brush to be cleared: ", brushElem, d)
  // muss noch dimension d übergeben werden
  //d3.select("#" + brushElem.id).call(yscale[id].brush.clear);
  d3.select("#" + brushElem.id).call(brush.move, null);
  //d3.select("#brush-" + i).call(yscale[d].brush.move, null);
}

// transition ticks for reordering, rescaling and inverting
function update_ticks_old(d, extent) {
  // update brushes
 
  // update brushes
  if (d) {
      var brush_el = d3.selectAll(".brush")
          .filter(function(key) { 
            //console.log('inside update_ticks: key und d  ',key,d);
            return key == d; });

      // single tick
      if (extent) {
          // restore previous extent
          yscale[d].brush = d3.brushY().extent([[0, 0], [36, h]])

          .on("start", function(event){
            if (event && event.sourceEvent) event.sourceEvent.stopPropagation();
            console.log("brush-start");
          })
          .on("brush", function(event){
            if (event && event.sourceEvent) event.sourceEvent.stopPropagation();
            brushed();
          })
          .on("end", function(event){
            //event.sourceEvent.stopPropagation();
            console.log("brush-end");
          });

          brush_el.call(yscale[d].brush);
          brush_el.call(yscale[d].brush.move, extent);
      } else {
          yscale[d].brush = d3.brushY().extent([[0, 0], [36, h]])
          .on("start", function(event){
            if (event && event.sourceEvent) event.sourceEvent.stopPropagation();
            console.log("brush-start");
          })
          .on("brush", function(event){
            if (event && event.sourceEvent) event.sourceEvent.stopPropagation();
            brushed();
          })
          .on("end", function(event){
            //event.sourceEvent.stopPropagation();
            console.log("brush-end");
          });

          brush_el.call(yscale[d].brush);
      }
  } else {
      // all ticks
      d3.selectAll(".brush")
          .each(function(d) {
              yscale[d].brush = d3.brushY().extent([[0, 0], [36, h]])
              .on("start", function(event){
                if (event && event.sourceEvent) event.sourceEvent.stopPropagation();
                console.log("brush-start");
              })
              .on("brush", function(event){
                if (event && event.sourceEvent) event.sourceEvent.stopPropagation();
                brushed();
              })
              .on("end", function(event){
                //event.sourceEvent.stopPropagation();
                console.log("brush-end");
              })

              d3.select(this).call(yscale[d].brush);
          });
  }

  brush_count++;

  show_ticks();

  // update axes
  d3.selectAll(".axis")
    .each(function(d,i) {
      // hide lines for better performance
      d3.select(this).selectAll('line').style("display", "none");

      // transition axis numbers
      d3.select(this)
        .transition()
        .duration(720)
        .call(d3.axisLeft(yscale[d]));

      // bring lines back
      d3.select(this).selectAll('line').transition().delay(800).style("display", null);

      d3.select(this)
        .selectAll('text')
        .style('font-weight', null)
        .style('font-size', null)
        .style('display', null);
    });
}




// Define brush handler functions outside the .each function block
function brushStart(event,d) {
  if (event && event.sourceEvent) event.sourceEvent.stopImmediatePropagation();
  initialBrushPosition = d3.brushSelection(this);
  // check if priviouse brush selection
  if (getContext('initialBrushPosition'+d)) {
    console.log("brush-Start: old initialBrushPosition"+d , getContext('initialBrushPosition'+d));
  };

  console.log("brush-start");
}

function brushEnd(event, yscale, d) {
  console.log("entering brush-End: context: " , getContext());
  
 //if (event && event.sourceEvent) event.sourceEvent.stopImmediatePropagation(); ! intefers with re-initializing the brush
  var finalBrushPosition = d3.brushSelection(this);
  console.log("entering brush-end: final brush position: ", finalBrushPosition);

  // reset brush only in case, when there has not been a invert-axis or re-order axis operation just before
  if (!getContext('ignore_brushend')) {
     // Check if there has been no movement
     if (initialBrushPosition && finalBrushPosition &&
      initialBrushPosition[0] === finalBrushPosition[0] && initialBrushPosition[1] === finalBrushPosition[1]) {
      console.log("No movement detected between brushstart and brushend");
      d3.select(this).call(yscale[d].brush.move, null);
      //reset_brushExtend(this, d);
    } else if (initialBrushPosition && !finalBrushPosition) {
      console.log("No movement detected (single click)");
      d3.select(this).call(yscale[d].brush.move, null);
      //reset_brushExtend(this, d);
    
    } else {
      console.log("Movement detected between brushstart and brushend");
    }
  } else {
    //
    console.log("ignore_brushend has been true and reset to false");
    setContext('ignore_brushend', false);
  }
 

}

function setContext(propertyName, value) { 
  ctx[propertyName] = value; 
}

function getContext(propertyName) {
  if (propertyName) {return ctx[propertyName]} else return ctx;
  //return (propertyName)? ctx.propertyName : ctx;
}
