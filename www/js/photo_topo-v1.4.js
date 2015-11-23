function PT(canvas_id) {
    this._allow_edits          = false;
    this._canvas_center;
    this._canvas_center_1st;
    this._canvas_id;
    this._destination_loaded   = false;
    this._locked               = false;
    this._mouse_dragging       = false;
    this._mouse_drag_start_x   = 0;
    this._mouse_drag_start_y   = 0;
    this._offline_operation    = false;
    this._options              = {};
    this._paths_drawn          = false;
    this._photo_loaded         = false;
    this._photo_info_loaded    = false;

    this.canvas                = '';
    this.destination;
    this.last_segment_index    = 0;
    this.line_started          = false;
    this.loading_path;
    this.new_path_marker       = {};
    this.new_path_points       = []
    this.paper_scope;
    this.path_color            = 'rgba(23,  157, 150, 0.7)';
    this.path_color_selected   = 'rgba(255,   0,   0, 0.3)';
    this.paths                 = [];
    this.paths_json            = [];
    this.photo_area            = 0;
    this.photo_destination     = 0;
    this.photo_id              = 0;
    this.photo_left_margin     = 0;
    this.photo_json            = {};
    this.photo_top_margin      = 0;
    this.photo_url             = '';
    this.photo_user_id         = -1;
    this.photo_raster;
    this.photo_scale           = 1;
    this.photo_height_scaled   = 0;
    this.photo_width_scaled    = 0;
    this.pt_canvas_size        = [];
    this.route_markers         = [];
    this.route_markers_to_make = [];
    this.route_markers_outer   = [];
    this.route_marker_points   = [];
    this.route_marker_text     = [];
    this.selected_route_id     = 0;
    this.selected_path         = null;
    this.show_high_res_photos  = true;
    this.tool                  = {};
    this.use_offline_images    = true;

    /* Overridable Functions */
    this.path_click                 = function(route, segment_id, segment_index, segment_style) {};
    this.photo_topo_loaded          = function() {};
    this.photo_resized              = function() {};
    this.route_label_double_clicked = function(route) {};

    this.type_colors = {
        'Aid':      "#d3d3d3",
        'Alpine':   "#ffffff",
        'Boulder':  "#00f000",
        'Ice':      "#5edafe",
        'Mixed':    "#800080",
        'Sport':    "#0000ff",
        'Top Rope': "#ffd700",
        'Trad':     "#ff0000"
    };

    /* Default Grading Systems */
    this.grade_system = {
        'Aid':      'Aid-A',
        'Boulder':  'USA-VScale',
        'Mixed':    'USA-YDS',
        'Sport':    'USA-YDS',
        'Top Rope': 'USA-YDS',
        'Trad':     'USA-YDS'
    };
};

PT.prototype.init = function(canvas_id, options) {
    paper.install(window);

    if  (typeof options !== "undefined") {
        this._options               = options;
        this._options.photo_id      = options.hasOwnProperty('photo_id')    ? options.photo_id : 0;
        this._options.destination   = options.hasOwnProperty('destination') ? options.destination : {destination_id: 0};
        this._options.offline       = options.hasOwnProperty('offline')     ? options.offline : false;
    } else {
        this._options = {
            photo_id:       0,
            destination:    {destination_id: 0},
            offline:        false
        };
    }

    if ($("#route_popup").length) {
        /* route popup exits already */
    } else {
        $('body').append("<div class='leaflet-label' id='route_popup' style='position:absolute;visibility:hidden;'></div>");
    }

    this.photo_id    = this._options.photo_id;
    this._canvas_id  = canvas_id;
    this.canvas      = document.getElementById(canvas_id);
    this.paper_scope = new paper.PaperScope();
    this.paper_scope.setup(this.canvas);

    paper = this.paper_scope;

    this._offline_operation = this._options.offline;
    this.use_offline_images = this._options.offline;

    if (this._options.destination.destination_id > 0) {
        /* Destination supplied */
        this.destination = this._options.destination;
        this._destination_loaded = true;
    }

    this._get_photo_info(this._options.photo_id);

    /* Bind Events */
    var pt_obj = this;
    var j_canvas_id = "#" + canvas_id;

    this.tool = new Tool();
    this.tool.onMouseDown = function(event) {
        pt_obj.hide_popups();
    };

    $(j_canvas_id).bind('mousewheel DOMMouseScroll', function(event){
        paper = pt_obj.paper_scope;

        if (paper.view.zoom == 1) {
            pt_obj._canvas_center_1st = paper.view.center;
        }

        if (this._locked === false) {
            if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
                /* Zoom In */
                paper.view.zoom += 0.2;
            } else {
                /* Zoom Out */
                if (paper.view.zoom > 1) {
                    paper.view.zoom -= 0.2;
                }

                if (paper.view.zoom > 0.98) {
                    paper.view.center = pt_obj._canvas_center_1st;
                }
            }
        }
    });

    /* Bind Events for panning while zoomed */
    $(j_canvas_id).mousedown(function(e) {
        if (this._locked == false) {
            paper = pt_obj.paper_scope;
            pt_obj._mouse_drag_start_x = parseInt(e.pageX);
            pt_obj._mouse_drag_start_y = parseInt(e.pageY);
            pt_obj._canvas_center      = paper.view.center;
            pt_obj._mouse_dragging     = true;
        }
    });

    $(j_canvas_id).mousemove(function(e) {
        paper = pt_obj.paper_scope;

        if (paper.view.zoom > 1 && pt_obj._mouse_dragging === true) {
            var x_delta = parseInt(pt_obj._mouse_drag_start_x - e.pageX);
            var y_delta = parseInt(pt_obj._mouse_drag_start_y - e.pageY);
            paper.view.center = new Point((pt_obj._canvas_center.x + x_delta), (pt_obj._canvas_center.y + y_delta));
        }
    });

    $(j_canvas_id).mouseup(function() {
        pt_obj._mouse_dragging = false;
    });
};

PT.prototype._click_route = function(route, path, event) {
    var popup_x, popup_y;

    paper = this.paper_scope;

    if (event.event.clientY && event.event.clientX) {
        popup_x = event.event.pageX;
        popup_y = event.event.pageY;
    } else if (event.point) {
        /* Touch Event uses different variable for location */
        popup_x = event.point.x;
        popup_y = event.point.y + 25;
    } else {
        popup_x = marker_x - text_position_offset;
        popup_y = first_point.y + y_offset;
    }

    this.selected_path = path;
    this.show_route_popup(popup_x, popup_y, route);

    /* Reset all path colors */
    for (var i=0; i<this.paths.length; i++) {
        for (var j=0; j<this.paths[i].length; j++) {
            this.paths[i][j].strokeColor = this.path_color;
        }
    }

    for (var i=0; i<path.length; i++) {
        path[i].strokeColor = this.path_color_selected;
    }

    this.paper_scope.view.update();
};

PT.prototype._create_loading_path = function() {
    var pt_obj = this;

    paper = pt_obj.paper_scope;

    if (this._paths_drawn === false) {
        var view = paper.view;

        if (typeof this.loading_path === "undefined") {
            this.loading_path = new Path.Rectangle({
                point:       [view.center.x-25, view.center.y-25],
                size:        [50, 50],
                strokeColor: 'white',
                strokeWidth:  4
            });
        } else {
            if (this.loading_path) {
                this.loading_path.removeSegments();
            }

            this.loading_path = new Path.Rectangle({
                point:       [view.center.x-25, view.center.y-25],
                size:        [50, 50],
                strokeColor: 'white',
                strokeWidth:  4
            });
        }

        paper.view.onFrame = function(event) {
            if (pt_obj._photo_loaded === false) {
                if (typeof pt_obj.loading_path !== "undefined") {
                    pt_obj.loading_path.rotate(3);
                }
            } else {
                pt_obj.loading_path.removeSegments();
            }
        };

    } else {
        if (this.loading_path) {
            this.loading_path.removeSegments();
        }

        paper.view.onFrame = function(event) {};
    }
};

PT.prototype._get_destination_data = function(destination_id) {
    var pt_obj = this;

    if (this._destination_loaded === false || (pt_obj.destination.destination_id != destination_id)) {
        $.ajax({
           type:     'GET',
           url:      'https://topohawk.com/api/v1.2/get_destination_data.php',
           dataType: 'json',
           data: {
               'destination_id': destination_id,
               'user_id':        -1
           },
           success: function(response) {
                pt_obj.destination = response.result;
                pt_obj._destination_loaded = true;
                pt_obj.resize();
           },
           error: function (req, status, error) {
               TH.util.logging.log('Error getting destination data: ' + error);
           }
        });
    }
};

PT.prototype._get_photo_info = function(photo_id) {
    var pt_obj = this;

    this.paper_scope.project.clear();
    this._create_loading_path();

    if (pt_obj.use_offline_images === true) {
        TH.util.storage.get_photo(photo_id, function(photo_id, photo_obj) {
            pt_obj.update_photo_object(photo_id, photo_obj, pt_obj);
        });
    } else {
        pt_obj._make_photo_request(photo_id);
    }
};

PT.prototype._get_route_from_id = function(route_id) {
    for (var i=0; i<this.destination.routes.features.length; i++) {
        if (this.destination.routes.features[i].properties.route_id == route_id) {
            return this.destination.routes.features[i];
        }
    }
};

PT.prototype._load_photo = function(result) {
    var pt_obj = this;
    paper = pt_obj.paper_scope;
    this.photo_json = result;

    if (result.photo_file.slice(0, 4) != "data") {
        if (result.photo_file != "no-photo.png") {
            if (this.show_high_res_photos === true) {
                this.photo_url = "https://topohawk.com/images/routes/" + result.photo_file;
            } else {
                this.photo_url = "https://topohawk.com/images/routes/t" + result.photo_file;
            }
        } else {
            this.photo_url = "images/no-photo.png";
        }
    } else {
        this.photo_url = result.photo_file;
    }

    pt_obj.photo_raster = new Raster(this.photo_url);
    pt_obj.photo_raster.visible = false;

    pt_obj.photo_raster.onLoad = function () {
        setTimeout(function(){
            pt_obj._photo_loaded = true;
            pt_obj.resize();
            pt_obj.photo_raster.visible = true;
        }, 80);
    };

    pt_obj.photo_raster.onClick = function(event) {
        /* Reset all paths */
        for (var i=0; i<pt_obj.paths.length; i++) {
            for (var j=0; j<pt_obj.paths[i].length; j++) {
                //pt_obj.paths[i][j].fullySelected = false;
                pt_obj.paths[i][j].selectedColor = this.path_color;
            }
        }

        pt_obj.raster_click(event);
    }
};

PT.prototype._make_photo_request = function(photo_id) {
    var pt_obj = this;

    $.ajax({
       type:        'GET',
       dataType:    'json',
       url:         'https://topohawk.com/api/v1.2/get_photo_info.php',
       data: {
           'photo_id': photo_id
       },
       success: function(response) {
            if (response.result_code > 0) {
                if (typeof pt_obj.destination === "undefined" || pt_obj.destination === null) {
                    pt_obj._get_destination_data(response.result.dest_id);
                }

                pt_obj.update_photo_object(photo_id, response.result, pt_obj);
            } else {
                TH.util.logging.log("Error getting photo info: " + response.result);
            }

            pt_obj._photo_info_loaded = true;
        },
        error: function (req, status, error) {
            TH.util.logging.log("Error getting photo info: " + error);
            pt_obj._photo_info_loaded = true;
        }
   });
};

PT.prototype.change_photo = function(photo_id) {
    this.photo_id = photo_id;

    if (typeof this.paper_scope !== 'undefined' && this.paper_scope !== null) {
        paper = this.paper_scope;

        if (paper.view.zoom > 1) {
            paper.view.zoom = 1;
            paper.view.center = this._canvas_center_1st;
        }

        this._photo_loaded          = false;
        this._photo_info_loaded     = false;
        this.paths_json             = [];
        this.photo_area             = 0;
        this.photo_destination      = 0;
        this.photo_left_margin      = 0;
        this.photo_top_margin       = 0;
        this.photo_url              = '';
        this.photo_scale            = 1;
        this.photo_height_scaled    = 0;
        this.photo_width_scaled     = 0;

        this.remove_paths();
        this._get_photo_info(photo_id);
    }
};

PT.prototype.create_new_line = function(event, route) {
    paper = this.paper_scope;

    if (this.line_started === false) {
        this.new_path_points = [];
        var path = new Path();
        path.add(event.point);
        path.strokeColor = this.path_color;
        path.strokeWidth = 4;
        path.fullySelected = true;
        this.paths.push([path]);

        this.line_started = true;
        this.last_segment_index = 0;
        this.new_path_marker = this.create_route_marker_graphic(event.point.x, event.point.y + 14, path, route);
    } else {
        this.last_segment_index = this.last_segment_index + 1;
        this.paths[this.paths.length-1][0].add(event.point);
    }

    this.new_path_points.push([event.point.x, event.point.y]);
};

PT.prototype.get_path_segments = function(path, route_object, left_margin, top_margin, photo_height, photo_width, all_segments) {
    var segments_obj = {
            path_object:    path,
            route_object:   route_object,
            margin_left:    left_margin,
            margin_top:     top_margin,
            photo_height:   photo_height,
            photo_width:    photo_width,
            segments:       []
    };

    var segment         = new Array();
    var segment_stroke  = "";
    var height_diff     = segments_obj.photo_height / segments_obj.path_object.height;
    var width_diff      = segments_obj.photo_width  / segments_obj.path_object.width;
    var x, y;

    /* Fist Point */
    x = parseFloat(segments_obj.path_object.points[0][0]) * width_diff;
    y = parseFloat(segments_obj.path_object.points[0][1]) * height_diff;
    x += segments_obj.margin_left;
    y += segments_obj.margin_top;
    segment.push([x, y]);
    segment_stroke = path.segments[0];

    for (var i=1; i < segments_obj.path_object.points.length; i++) {
        x = parseFloat(segments_obj.path_object.points[i][0]) * width_diff;
        y = parseFloat(segments_obj.path_object.points[i][1]) * height_diff;
        x += segments_obj.margin_left;
        y += segments_obj.margin_top;

        if ((segment_stroke != path.segments[i-1]) || (all_segments === true)) {
            /* Split segment */
            if (i > 1) {
                var last_point = segment[segment.length - 1];
                segments_obj.segments.push(segment);
                segment = new Array();
                segment.push(last_point);
            }
        }

        segment.push([x, y]);
        segment_stroke = path.segments[i-1];
    }

    segments_obj.segments.push(segment);

    return segments_obj;
}

PT.prototype.draw_all_paths = function(all_segments) {
    if (this.paths_json.length > 0) {
        if (this._destination_loaded === true) {
            for (var i=0; i<this.paths_json.length; i++) {
                if (this.paths_json[i].route_id > 0) {
                    var route_object = this._get_route_from_id(this.paths_json[i].route_id);
                    this.draw_path(this.paths_json[i], route_object, this.photo_left_margin, this.photo_top_margin, this.photo_height_scaled, this.photo_width_scaled, all_segments);
                }
            }

            /* Draw all route markers */
            this.draw_route_markers(this.route_markers_to_make);
            this.paper_scope.view.update();
            this._paths_drawn = true;
        }
    }
}

PT.prototype.draw_path = function(path, route_object, left_margin, top_margin, photo_height, photo_width, all_segments) {
    this.new_path_points = [];
    paper = this.paper_scope;

    var segments_obj  = this.get_path_segments(path, route_object, left_margin, top_margin, photo_height, photo_width, all_segments);
    var path_color    = (this.selected_route_id == segments_obj.route_object.properties.route_id) ? this.path_color_selected : this.path_color;
    var path_segments = new Array();
    var pt_obj        = this;
    var points        = new Array();
    var x, y;

    for (var i=0; i<segments_obj.segments.length; i++) {
        var segment_index   = i;
        var segment_style   = "solid";
        var current_segment = segments_obj.segments[i];
        var new_path = new Path({
            fullySelected:  false,
            strokeCap:      'round',
            strokeWidth:    4
        });

        new_path.strokeColor = path_color;
        if (i < path.segments.length) {
            if (path.segments[i].trim() == "dotted") {
                new_path.dashArray = [4, 9];
                segment_style = "dotted";
            }
        } else {
            segment_style = "solid";
        }

        for (var j=0; j<current_segment.length; j++) {
            x = current_segment[j][0];
            y = current_segment[j][1];
            points.push(current_segment[j]);
            new_path.add(new Point(x, y));
            this.new_path_points.push([x, y]);

            if (i == 0 && j == 0) {
                this.route_markers_to_make.push({
                    x:      x,
                    y:      y + 14,
                    path:   path_segments,
                    route:  segments_obj.route_object
                });
            }
        }

        new_path.segment_index = segment_index;
        new_path.segment_style = segment_style;
        new_path.topo_id       = parseInt(path.topo_id);

        new_path.onClick = function(event) {
            if (pt_obj._allow_edits === true) {
                /* Reset all paths */
                for (var i=0; i<pt_obj.paths.length; i++) {
                    for (var j=0; j<pt_obj.paths[i].length; j++) {
                        pt_obj.paths[i][j].fullySelected = false;
                        //pt_obj.paths[i][j].selectedColor = this.path_color;
                        pt_obj.paths[i][j].strokeColor = pt_obj.path_color;
                    }
                }

                //this.fullySelected = true;
                //this.selectedColor = '#ffffff';
                this.strokeColor = 'rgba(255,   0,   0, 0.8)';

                /* Remove newly started line */
                if (pt_obj.line_started === true) {
                    pt_obj.line_started = false;
                    pt_obj.paths[pt_obj.paths.length-1][0].removeSegments();
                    pt_obj.paths[pt_obj.paths.length-1].splice(-1,1);

                    pt_obj.new_path_marker.label.remove();
                    pt_obj.new_path_marker.label_outer.remove();
                    pt_obj.new_path_marker.marker_text.remove();
                }

                pt_obj.path_click(segments_obj.route_object, this.topo_id, this.segment_index, this.segment_style);
            }
        }

        path_segments.push(new_path);
    }

    this.paths.push(path_segments);
};

PT.prototype.get_height_from_width = function(given_width) {
    if (this._photo_loaded === true) {
        var ratio  = pt_obj.paths_json[0].height / pt_obj.paths_json[0].width;
        var height = ratio * given_width;

        return height;
    } else {
        return 0;
    }
}

PT.prototype.route_marker_overlaps = function(index, all_markers, margin) {
    var does_overlap = false;

    for (var i=0; i<all_markers.length; i++) {
        if (i !== index) {
            if (Math.abs(all_markers[index].x - all_markers[i].x) <= margin &&
                Math.abs(all_markers[index].y - all_markers[i].y) <= margin) {
                    does_overlap = true;
                    break;
            }
        }
    }

    return does_overlap;
};

PT.prototype.draw_route_markers = function(markers_to_make) {
    if (markers_to_make.length > 0) {
        /* Make sure all markers on on the canvas */
        for (var i=0; i<markers_to_make.length; i++) {
            if (markers_to_make[i].x < 9) {
                markers_to_make[i].x = 9;
            }

            /* todo: check bottom, top, right */
        }

        this.place_route_markers(markers_to_make);
    }
};

PT.prototype.enable_edits = function (allow_edits) {
    this._allow_edits = allow_edits;
    this.remove_paths();
    this.draw_all_paths(allow_edits);
}

PT.prototype.place_route_markers = function(markers_to_make) {
    if (markers_to_make.length > 0) {
        var overlapping_markers = [];

        for (var i=0; i<markers_to_make.length; i++) {
            if (this.route_marker_overlaps(i, markers_to_make, 18)) {
                overlapping_markers.push(markers_to_make[i]);
            } else {
                /* Draw marker */
                this.draw_route_marker_graphic(markers_to_make[i].x, markers_to_make[i].y, markers_to_make[i].path, markers_to_make[i].route);
            }
        }

        if (overlapping_markers.length > 1) {
            for (var i=1; i<overlapping_markers.length; i++) {
                var y_overlap = Math.abs(overlapping_markers[0].y - overlapping_markers[i].y);
                var x_overlap = Math.abs(overlapping_markers[0].x - overlapping_markers[i].x);

                if (y_overlap < 10 && (x_overlap < 12)) {
                    if (overlapping_markers[0].y < overlapping_markers[i].y) {
                        overlapping_markers[0].y -= (10 - y_overlap);
                        overlapping_markers[i].y += (10 - y_overlap);
                    } else {
                        overlapping_markers[0].y += (10 - y_overlap);
                        overlapping_markers[i].y -= (10 - y_overlap);
                    }
                }

                if (x_overlap < 10) {
                    if (overlapping_markers[0].x < overlapping_markers[i].x) {
                        overlapping_markers[0].x -= (10 - x_overlap);
                        overlapping_markers[i].x += (10 - x_overlap);
                    } else {
                        overlapping_markers[0].x += (10 - x_overlap);
                        overlapping_markers[i].x -= (10 - x_overlap);
                    }
                }
            }
        }

        if (overlapping_markers.length > 0) {
            this.draw_route_marker_graphic(overlapping_markers[0].x, overlapping_markers[0].y, overlapping_markers[0].path, overlapping_markers[0].route);
            overlapping_markers.splice(0, 1);
        }

        this.place_route_markers(overlapping_markers);
    }
};

PT.prototype.create_route_marker_graphic = function(marker_x, marker_y, path, route) {
    paper = this.paper_scope;
    var photo_topo_obj = this;
    var y_adjust = 1;

    var route_label_outer = new Path.Circle(new Point(marker_x, marker_y), 11);
    route_label_outer.fillColor = 'black';

    var route_label = new Path.Circle(new Point(marker_x, marker_y), 10);
    route_label.fillColor = this.type_colors[route.properties.route_type];

    if (route.properties.display_order > 0) {
        /* The route desplay order is set so display its numberical order */
        var marker_text = route.properties.display_order;
        var font_size   = 14;
        var y_offset    = 5;

        if (route.properties.display_order > 9) {
            var text_position_offset = 8;
        } else {
            var text_position_offset = 4;
        }
    } else {
        var marker_text = TH.util.grades.convert_common_to(this.grade_system[route.properties.route_type], route.properties.route_grade);
        var text_position_offset = 8;

        if (marker_text.length > 3) {
            var font_size = 5;
            var y_offset  = y_adjust + 2;
        } else if (marker_text.length == 3) {
            var font_size = 9;
            var y_offset  = y_adjust + 3;
        } else {
            var font_size = 14;
            var y_offset  = y_adjust + 5;
        }
    }

    var marker_text_pos = [marker_x - text_position_offset, marker_y + y_offset];

    var marker_point_text = new PointText({
        point: marker_text_pos,
        content: marker_text,
        fillColor: 'white',
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: font_size
    });

    var marker_components = {
        label:       route_label,
        label_outer: route_label_outer,
        marker_text: marker_point_text
    };

    return marker_components;
}

PT.prototype.draw_route_marker_graphic = function(marker_x, marker_y, path, route) {
    var photo_topo_obj   = this;
    var route_marker_obj = this.create_route_marker_graphic(marker_x, marker_y, path, route);

    this.route_markers.push(route_marker_obj.label);
    this.route_marker_points.push([marker_x, marker_y]);
    this.route_markers_outer.push(route_marker_obj.label_outer);
    this.route_marker_text.push(route_marker_obj.marker_text);

    route_marker_obj.label.onClick = function(event) {
        photo_topo_obj._click_route(route, path, event);
    }

    route_marker_obj.marker_text.onClick = function(event) {
        photo_topo_obj._click_route(route, path, event);
    };

    route_marker_obj.marker_text.onDoubleClick = function(event) {
        photo_topo_obj.route_label_double_clicked(route);
    };

    route_marker_obj.marker_text.onMouseEnter = function(event) {
        photo_topo_obj.show_route_popup(event.event.pageX, event.event.pageY, route);
        for (var i=0; i<path.length; i++) {
            path[i].strokeColor = photo_topo_obj.path_color_selected;
        }
    };

    route_marker_obj.marker_text.onMouseLeave = function(event) {
        if (photo_topo_obj.selected_path !== path) {
            /* Hide Route Info Popoup */
            $("#route_popup").css('visibility', 'hidden');

            if (photo_topo_obj.selected_route_id != route.properties.route_id) {
                for (var i=0; i<path.length; i++) {
                    path[i].strokeColor = photo_topo_obj.path_color;
                }
            }
        };
    }
}

PT.prototype.hide_popups = function() {
    $("#route_popup").css('visibility', 'hidden');
}

PT.prototype.raster_click = function(event) {
    /* Overridable Function */
}

PT.prototype.redraw_segments = function() {
    /* Remove old labels */
    for (var i=0; i<this.route_marker_text.length; i++) {
        this.route_markers_outer[i].remove();
        this.route_markers[i].remove();
        this.route_marker_text[i].remove();
    }

    this.route_markers_outer    = [];
    this.route_markers          = [];
    this.route_marker_text      = [];
    this.route_markers_to_make  = [];

    for (var i=0; i<this.paths_json.length; i++) {
        if (typeof this.paths[i] !== "undefined") {
            path             = this.paths_json[i];
            path_route_obj   = this._get_route_from_id(path.route_id);
            var segments_obj = this.get_path_segments(path, path_route_obj, this.photo_left_margin, this.photo_top_margin, this.photo_height_scaled, this.photo_width_scaled, false);

            for (var s=0; s<this.paths[i].length; s++) {
                path.strokeColor = this.path_color;
                path.fullySelected = false;
                this.paths[i][s].removeSegments();
            }

            for (var k=0; k<segments_obj.segments.length; k++) {
                var current_segment = segments_obj.segments[k];

                for (var l=0; l<current_segment.length; l++) {
                    x = current_segment[l][0];
                    y = current_segment[l][1];

                    try {
                        this.paths[i][k].add(new Point(x, y));
                    } catch(err) {
                        var e = err;
                    }

                    if (k == 0 && l == 0) {
                        this.route_markers_to_make.push({
                            x:      x,
                            y:      y + 14,
                            path:   this.paths[i],
                            route:  segments_obj.route_object
                        });
                    }
                }
            }
        }
    }

    this.draw_route_markers(this.route_markers_to_make);
}

PT.prototype.remove_paths = function() {
    for (var i=0; i<this.paths.length; i++) {
        for (var j=0; j<this.paths[i].length; j++) {
            this.paths[i][j].remove();
        }
    }

    for (var i=0; i<this.route_markers_outer.length; i++) {
        this.route_markers_outer[i].remove();
        this.route_marker_text[i].remove();
        this.route_markers[i].remove();
    }

    this._paths_drawn           = false;
    this.last_segment_index     = 0;
    this.line_started           = false;
    this.new_path_points        = [];
    this.paths                  = [];
    this.route_markers          = [];
    this.route_markers_to_make  = [];
    this.route_markers_outer    = [];
    this.route_marker_points    = [];
    this.route_marker_text      = [];
}

PT.prototype.resize = function(canvas_size) {
    paper = this.paper_scope;

    if (typeof paper !== "undefined") {
        if (this.paper_scope.view.zoom > 1) {
            this.paper_scope.view.zoom = 1;
            this.paper_scope.view.center = this._canvas_center_1st;
        }

        if (typeof canvas_size !== "undefined" && canvas_size !== null) {
            this.pt_canvas_size = canvas_size;
            this.paper_scope.view.setViewSize(canvas_size[1], canvas_size[0]);
        } else {
            canvas_size = this.pt_canvas_size;
            this.paper_scope.view.setViewSize(canvas_size[1], canvas_size[0]);
        }

        if (this._photo_loaded === true) {
            this.photo_raster.scale((1/this.photo_scale));

            var photo_size = this.photo_raster.size;
            var view_size = this.paper_scope.view.size;

            var width_ratio  = view_size.width  / photo_size.width;
            var height_ratio = view_size.height / photo_size.height;

            var photo_height_scaled_old = (this.photo_height_scaled > 0) ? this.photo_height_scaled : this.photo_raster.height;
            var photo_width_scaled_old  = (this.photo_width_scaled > 0)  ? this.photo_width_scaled  : this.photo_raster.width;

            this.photo_scale = (width_ratio < height_ratio) ? width_ratio : height_ratio;
            this.photo_height_scaled = (photo_size.height * this.photo_scale);
            this.photo_width_scaled  = (photo_size.width  * this.photo_scale);

            this.photo_raster.scale(this.photo_scale);
            this.photo_raster.position = this.paper_scope.view.center;
            this.paper_scope.view.update();

            var height_change = (this.photo_height_scaled / photo_height_scaled_old);
            var width_change  = (this.photo_width_scaled /  photo_width_scaled_old);

            var left_margin = (view_size.width  - this.photo_width_scaled) / 2.0;
            var top_margin  = (view_size.height - this.photo_height_scaled) / 2.0 ;

            var height_diff, width_diff;
            var new_path_points = [];
            var path;
            var path_route_obj;
            var x, y;

            this.photo_left_margin = left_margin;
            this.photo_top_margin  = top_margin;

            if (this._paths_drawn === true) {
                this.redraw_segments();
            } else {
                if (this._photo_info_loaded === true) {
                    if (this.paths_json.length > 0) {
                        if (this._destination_loaded === true) {
                            this.draw_all_paths(false);
                            this.photo_topo_loaded();
                        }
                    } else {
                        this.paper_scope.view.update();

                        if (this._destination_loaded === true) {
                            this.photo_topo_loaded();
                            this._paths_drawn = true;
                        }
                    }
                } else {
                    /* Photo Info not yet loaded */
                }
            }
        }

        this.paper_scope.view.update();
        this.photo_resized();
    }

    this._create_loading_path();
};

PT.prototype.set_destination = function(destination_obj) {
    this._destination_loaded = true;
    this.destination = destination_obj;
};

PT.prototype.set_locked = function(is_locked) {
    this._locked = is_locked;
}

PT.prototype.show_route_popup = function(x, y, route) {
    var top  = y - 10;
    var left = x + 20;
    var difficulty  = TH.util.grades.convert_common_to(this.grade_system[route.properties.route_type], route.properties.route_grade);
    var lable_text  = "<b>" + route.properties.name + "</b><br/>" + difficulty + " " + route.properties.route_type + "<br/>" + TH.util.get_star_html(route.properties.rating, true, this._offline_operation);

    $("#route_popup").html(lable_text);

    var popup_width = ($("#route_popup").width() < 40) ? 50 : $("#route_popup").width();

    if ((left + popup_width) > $(window).width()) {
        left = x - 35 - popup_width;
    }

    $("#route_popup").css('visibility', 'visible');
    $("#route_popup").css('top', top);
    $("#route_popup").css('left', left);
},

PT.prototype.undo_last_segment = function () {
    paper = this.paper_scope;
    var last_index = this.paths.length - 1;

    if (this.last_segment_index == 0) {
        this.new_path_marker.label.remove();
        this.new_path_marker.label_outer.remove();
        this.new_path_marker.marker_text.remove();

        /* Remove newly started line */
        this.line_started = false;
        this.paths[this.paths.length-1][0].removeSegments();
        this.paths[this.paths.length-1].splice(-1,1);
    } else {
        this.paths[last_index][0].removeSegment(this.last_segment_index);
        this.last_segment_index = this.last_segment_index - 1;
        this.new_path_points.pop();
    }

    paper.view.update();
};

PT.prototype.update_photo_object = function(photo_id, photo_obj, pt_obj) {
    if (typeof photo_obj !== 'undefined' && photo_obj !== null) {
        pt_obj.paths_json = photo_obj.photo_topos;
        pt_obj.photo_area = photo_obj.area_id;
        pt_obj.photo_destination = photo_obj.dest_id;
        pt_obj.photo_user_id = photo_obj.user_id;
        pt_obj._load_photo(photo_obj);
    } else {
        pt_obj._make_photo_request(photo_id);
    }
};
