function PT(canvas_id) {
    this._canvas_center;
    this._canvas_center_1st;
    this._canvas_id;
    this._destination_loaded  = false;
    this._locked              = false;
    this._mouse_dragging      = false;
    this._mouse_drag_start_x  = 0;
    this._mouse_drag_start_y  = 0;
    this._offline_operation   = false;
    this._paths_drawn         = false;
    this._photo_loaded        = false;

    this.canvas               = '';
    this.destination;
    this.last_segment_index   = 0;
    this.line_started         = false;
    this.loading_path;
    this.new_path_points      = []
    this.paper_scope;
    this.path_color           = 'rgba(23,  157, 150, 0.7)';
    this.path_color_selected  = 'rgba(255,   0,   0, 0.3)';
    this.paths                = [];
    this.paths_json           = [];
    this.photo_area           = 0;
    this.photo_destination    = 0;
    this.photo_id             = 0;
    this.photo_left_margin    = 0;
    this.photo_json           = {};
    this.photo_top_margin     = 0;
    this.photo_topo_loaded    = function() {};
    this.photo_url            = '';
    this.photo_user_id        = -1;
    this.photo_raster;
    this.photo_resized        = function() {};
    this.photo_scale          = 1;
    this.photo_height_scaled  = 0;
    this.photo_width_scaled   = 0;
    this.route_markers        = [];
    this.route_markers_outer  = [];
    this.route_marker_points  = [];
    this.route_marker_text    = [];
    this.selected_route_id    = 0;
    this.show_high_res_photos = true;
    this.use_offline_images   = true;

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

PT.prototype.init = function(canvas_id, photo_id, destination, offline) {
    $('body').append("<div class='leaflet-label' id='route_popup' style='position:absolute;visibility:hidden;'></div>");

    paper.install(window);

    this.photo_id    = photo_id;
    this._canvas_id  = canvas_id;
    this.canvas      = document.getElementById(canvas_id);
    this.paper_scope = new paper.PaperScope();
    this.paper_scope.setup(this.canvas);

    if (typeof offline !== "undefined") {
        this._offline_operation = offline;
        this.use_offline_images = offline;
    }

    if (typeof destination !== "undefined") {
        /* Destination supplied */
        this.destination = destination;
        this._destination_loaded = true;
    }

    paper = this.paper_scope;
    this._get_photo_info(photo_id);

    /* Bind Scroll Events */
    var pt_obj = this;
    var j_canvas_id = "#" + canvas_id;
    $(j_canvas_id).bind('mousewheel DOMMouseScroll', function(event){
        paper = pt_obj.paper_scope;

        if (paper.view.zoom == 1) {
            pt_obj._canvas_center_1st = paper.view.center;
        }

        if (this._locked == false) {
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
            this.loading_path.removeSegments();

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
        this.loading_path.removeSegments();
        paper.view.onFrame = function(event) {};
    }
};

PT.prototype._get_destination_data = function(destination_id) {
    var pt_obj = this;

    if (this._destination_loaded === false || (pt_obj.destination.destination_id != destination_id)) {
        $.ajax({
           type:     'POST',
           url:      'https://topohawk.com/api/v1.1/get_destination_data.php',
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

    this.photo_raster = new Raster(this.photo_url);

    pt_obj.photo_raster.onLoad = function () {
        pt_obj._photo_loaded = true;
        pt_obj.resize();
    };
};

PT.prototype._make_photo_request = function(photo_id) {
    var pt_obj = this;

    $.ajax({
       type:        'POST',
       dataType:    'json',
       url:         'https://topohawk.com/api/v1/get_photo_info.php',
       data: {
           'photo_id': photo_id
       },
       success: function(response) {
            if (response.result_code > 0) {
                if (typeof pt_obj.destination === "undefined" || pt_obj.destination === null) {
                    pt_obj._get_destination_data(response.result.dest_id);
                    this._photo_loaded = true;
                } else {
                    this._photo_loaded = true;
                }

                pt_obj.update_photo_object(photo_id, response.result, pt_obj);
            } else {
                TH.util.logging.log("Error getting photo info: " + response.result);
            }
        },
        error: function (req, status, error) {
            TH.util.logging.log("Error getting photo info: " + error);
        }
   });
};

PT.prototype.change_photo = function(photo_id) {
    this.photo_id = photo_id;

    if (typeof this.paper_scope !== 'undefined' && this.paper_scope !== null) {
        this.paper_scope.project.clear();
        paper = this.paper_scope;

        if (paper.view.zoom > 1) {
            paper.view.zoom = 1;
            paper.view.center = this._canvas_center_1st;
        }

        this._paths_drawn        = false;
        this._photo_loaded       = false;
        this.last_segment_index  = 0;
        this.line_started        = false;
        this.new_path_points     = []
        this.paths               = [];
        this.paths_json          = [];
        this.photo_area          = 0;
        this.photo_destination   = 0;
        this.photo_left_margin   = 0;
        this.photo_top_margin    = 0;
        this.photo_url           = '';
        this.photo_scale         = 1;
        this.photo_height_scaled = 0;
        this.photo_width_scaled  = 0;
        this.route_markers       = [];
        this.route_markers_outer = [];
        this.route_marker_points = [];
        this.route_marker_text   = [];

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
        this.paths.push(path);

        this.line_started = true;
        this.last_segment_index = 0;
        this.draw_route_marker(event.point, path, route);
    } else {
        this.last_segment_index = this.last_segment_index + 1;
        this.paths[this.paths.length-1].add(event.point);
    }

    this.new_path_points.push([event.point.x, event.point.y]);
};

PT.prototype.draw_path = function(path, route_object, left_margin, top_margin, photo_height, photo_width) {
    var height_diff      = photo_height / path.height;
    var width_diff       = photo_width / path.width;
    var x, y;
    var first_point;

    this.new_path_points  = [];
    paper = this.paper_scope;

    var new_path = new Path({
        fullySelected:  false,
        strokeCap:      'round',
        strokeWidth:    4
    });

    if (this.selected_route_id == route_object.properties.route_id) {
        new_path.strokeColor = this.path_color_selected;
    } else {
        new_path.strokeColor = this.path_color;
    }

    for (var i=0; i < path.points.length; i++) {
        x = parseFloat(path.points[i][0]) * width_diff;
        y = parseFloat(path.points[i][1]) * height_diff;
        x += left_margin;
        y += top_margin;

        if (i == 0) first_point = new Point(x, y);
        var point_new = new Point(x, y);
        new_path.add(point_new);
        this.new_path_points.push([x, y]);
    }

    this.draw_route_marker(first_point, new_path, route_object);
    this.paths.push(new_path);
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

PT.prototype.draw_route_marker = function(first_point, path, route) {
    paper = this.paper_scope;

    var photo_topo_obj = this;
    var marker_x = first_point.x;
    var marker_y = first_point.y;
    var y_adjust = 20;

    /* Check to see if marker wil lbe off the screen, and adjust if nessessary */
    if (first_point.y > ($('#' + this._canvas_id).height() - 20)) {
        y_adjust = 5;
    }

    marker_y = first_point.y + y_adjust;

    /* Make sure route markers do not overlap */
    for (var i=0; i<this.route_marker_points.length; i++) {
        if ((marker_x - 12) < this.route_marker_points[i][0] && (marker_x + 12) > this.route_marker_points[i][0]) {
            /* X Overlap */
            var marker_x_test = marker_x - 10;
            var best_marker_x = marker_x + 13;

            while (marker_x_test < marker_x + 12) {
                if ((marker_x_test - 13) < this.route_marker_points[i][0] && (marker_x_test + 13) > this.route_marker_points[i][0]) {
                    /* Still Overlapping */
                    marker_x_test += 4;
                } else {
                    if (Math.abs(marker_x_test - marker_x) < Math.abs(best_marker_x - marker_x)) {
                        best_marker_x = marker_x_test;
                    }

                    marker_x_test += 4;
                }
            }

            marker_x = best_marker_x;
        } else if ((marker_y - 11) < this.route_marker_points[i][1] && (marker_y + 11) > this.route_marker_points[i][1]) {
            /* Y Overlap */
        }
    }

    /* Create Route Markers */
    var route_label_outer = new Path.Circle(new Point(marker_x, marker_y), 11);
    route_label_outer.fillColor = 'black';

    var route_label = new Path.Circle(new Point(marker_x, marker_y), 10);
    route_label.fillColor = this.type_colors[route.properties.route_type];

    this.route_markers.push(route_label);
    this.route_marker_points.push([marker_x, marker_y]);
    this.route_markers_outer.push(route_label_outer);

    if (route.properties.display_order > 0) {
        /* The route desplay order is setm so display its numberical order */
        var marker_text = route.properties.display_order;
        var font_size   = 14;
        var y_offset    = 25;

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

    var marker_point_text = new PointText({
        point: [marker_x - text_position_offset, first_point.y + y_offset],
        content: marker_text,
        fillColor: 'white',
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: font_size
    });

    this.route_marker_text.push(marker_point_text);

    marker_point_text.onMouseEnter = function(event) {
        photo_topo_obj.show_route_popup(event, this, route);
        path.strokeColor = photo_topo_obj.path_color_selected;
    };

    marker_point_text.onMouseLeave = function(event) {
        /* Hide Route Info Popoup */
        $("#route_popup").css('visibility', 'hidden');

        if (photo_topo_obj.selected_route_id != route.properties.route_id) {
            path.strokeColor = photo_topo_obj.path_color;
        }
    };
};

PT.prototype.resize = function(canvas_size) {
    paper = this.paper_scope;

    if (typeof paper !== "undefined") {
        if (paper.view.zoom > 1) {
            paper.view.zoom = 1;
            paper.view.center = this._canvas_center_1st;
        }

        if (typeof canvas_size !== "undefined") {
            paper.view.setViewSize(canvas_size[1], canvas_size[0]);
        }

        if (this._photo_loaded === true) {
            var photo_height_scaled_old;
            var photo_width_scaled_old;

            paper = this.paper_scope;
            this.photo_raster.scale((1/this.photo_scale));

            var photo_size = this.photo_raster.size;
            var view_size = paper.view.size;

            var width_ratio  = view_size.width  / photo_size.width;
            var height_ratio = view_size.height / photo_size.height;

            photo_height_scaled_old = this.photo_height_scaled;
            photo_width_scaled_old  = this.photo_width_scaled;

            if (width_ratio < height_ratio) {
                this.photo_scale = width_ratio;
                this.photo_height_scaled = (photo_size.height * width_ratio);
                this.photo_width_scaled =  (photo_size.width  * width_ratio);
            } else {
                this.photo_scale = height_ratio;
                this.photo_height_scaled = (photo_size.height * height_ratio);
                this.photo_width_scaled =  (photo_size.width  * height_ratio);
            }

            this.photo_raster.scale(this.photo_scale);
            this.photo_raster.position = paper.view.center;

            var height_change = this.photo_height_scaled / photo_height_scaled_old;
            var width_change  = this.photo_width_scaled /  photo_width_scaled_old;

            var left_margin = (view_size.width  - this.photo_width_scaled) / 2.0;
            var top_margin  = (view_size.height - this.photo_height_scaled) / 2.0 ;

            var height_diff, width_diff;
            var new_path_points  = [];
            var path;
            var x, y;

            this.photo_left_margin = left_margin;
            this.photo_top_margin  = top_margin;

            if (this._paths_drawn == true) {
                for (var i=0; i<this.paths_json.length; i++) {
                    if (typeof this.paths[i] !== "undefined") {
                        path             = this.paths_json[i];
                        height_diff      = this.photo_height_scaled / path.height;
                        width_diff       = this.photo_width_scaled / path.width;

                        this.paths[i].removeSegments();

                        for (var j=0; j < path.points.length; j++) {

                            if (j == 1) {
                                /* Adjust route marker */
                                this.route_markers_outer[i].position = new Point(x, y + 20);
                                this.route_markers[i].position       = new Point(x, y + 20);
                                this.route_marker_text[i].position   = new Point(x, y + 20);
                            }

                            x = parseFloat(path.points[j][0]) * width_diff;
                            y = parseFloat(path.points[j][1]) * height_diff;
                            x += left_margin;
                            y += top_margin;

                            var point_new = new Point(x, y);
                            this.paths[i].add(point_new);
                        }
                    }
                }
            } else {
                if (this._destination_loaded == true) {
                    for (var i=0; i<this.paths_json.length; i++) {
                        if (this.paths_json[i].route_id > 0) {
                            var route_object = this._get_route_from_id(this.paths_json[i].route_id);
                            this.draw_path(this.paths_json[i], route_object, left_margin, top_margin, this.photo_height_scaled, this.photo_width_scaled);
                        }
                    }

                    this.photo_topo_loaded();
                    this._paths_drawn = true;
                }
            }
        }

        paper.view.update();
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

PT.prototype.show_route_popup = function(event, point_text, route) {
    var top  = event.event.clientY - 10;
    var left = event.event.clientX + 25;
    var difficulty = TH.util.grades.convert_common_to(this.grade_system[route.properties.route_type], route.properties.route_grade);

    var lable_text = "<b>" + route.properties.name + "</b><br/>" + difficulty + " " + route.properties.route_type + "<br/>" + TH.util.get_star_html(route.properties.rating, true, this._offline_operation);

    $("#route_popup").html(lable_text);
    $("#route_popup").css('visibility', 'visible');
    $("#route_popup").css('top', top);
    $("#route_popup").css('left', left);
},

PT.prototype.undo_last_segment = function () {
    paper = this.paper_scope;

    var last_index = this.paths.length - 1;

    this.paths[last_index].removeSegment(this.last_segment_index);
    this.last_segment_index = this.last_segment_index - 1;
    this.new_path_points.pop();
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
