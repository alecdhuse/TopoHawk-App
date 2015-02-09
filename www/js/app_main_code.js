var MODE_NONE        = 0;
var MODE_DESTINATION = 1;
var MODE_AREA        = 2;
var MODE_ROUTE       = 3;

var current_mode  = MODE_NONE;
var map_finished  = false;
var photo_ids     = [];
var photo_index   = 0;
var photo_topo    = new PT();
var stream_offset = 0;
var stream_scroll = false;
var stream_update = false;
var swipe_binded  = false;
var user_id       = -1;
var welcome_html  = "";

var stream_last   = {
    destination_id: 0,
    area_id:        0,
    route_id:       0
};

/* Map Setup */
var map = TH.map('screen_map', {
    cluster:        true,
    mobile:         true,
    offline:        true,
    show_location:  true,
    lat:            40.6,
    lng:            -98.0,
    zoom:           3
});

map.on_area_click               = function (area_obj)        { map_area_clicked(area_obj) };
map.on_destination_click        = function (destination_obj) { };
map.on_route_click              = function (route_obj)       { map_route_clicked(route_obj) };
map.on_user_info_loaded         = function ()                { user_info_loaded() };
map.destination_info_loaded     = function (destination_obj) { create_destination_list() };
map.on_destination_info_loaded  = function ()                { destination_info_loaded() };

function bind_swipes() {
    if (swipe_binded === false) {
        $("#screen_photo").on( "swipeleft", function() {
            photo_show_next();
        });
        
        $("#screen_photo").on( "swiperight", function() {
            photo_show_previous();
        });
        
        swipe_binded = true;
    }
}

function bread_crumb_area_click() {
    map.selected_route = {};
    current_mode       = MODE_AREA;
}

function bread_crumb_destination_click() {
    map.selected_area  = {};
    map.selected_route = {};
    current_mode       = MODE_DESTINATION;
    
    $("#breadcrumbs_div_2").html("");
    destination_info_loaded();
}

function bread_crumb_logo_click() {
    map.selected_area        = {};
    map.selected_destination = {};
    map.selected_route       = {};
    current_mode             = MODE_NONE;
    
    $("#breadcrumbs_div_1").html("TopoHawk");
    $("#breadcrumbs_div_2").html("");
    $("#screen_info_title").html("");
    $("#screen_info_inner").html(welcome_html);
    
    button1_click();
    create_destination_list();
}

function button1_click() {
    buttons_reset();
    $("#button1_img").attr("src", "images/button-info-selected.svg");
    $("#screen_info").css('visibility','visible');
}

function button2_click() {
    buttons_reset();
    $("#button2_img").attr("src", "images/button-destinations-selected.svg");
    $("#screen_destinations").css('visibility','visible');
}

function button3_click() {
    buttons_reset();
    $("#button3_img").attr("src", "images/button-photos-selected.svg");
    
    if (current_mode != MODE_NONE) {
        get_photo_ids();
        $("#screen_photo").css('visibility','visible');
    } else {
        show_photo_stream();
        $("#screen_stream").css('visibility','visible');
    }
}

function button4_click() {
    buttons_reset();
    $("#button4_img").attr("src", "images/button-map-selected.svg");
    $("#screen_map").css('visibility','visible');
    map.enable_device_location(true);
}

function button_menu_click() {
    if ($("#menu_popup").css('visibility') == 'visible') {
        $("#menu_popup").css('visibility','hidden');
    } else {
        var left = $(window).width() - $("#menu_popup").width() - 5;
        $("#menu_popup").css('left', left);
        $("#menu_popup").css('visibility','visible');
    }
}

function button_menu_about() {
    buttons_reset();
    $("#menu_popup").css('visibility','hidden');
    $("#screen_about").css('visibility','visible');
    $("#breadcrumbs_div_2").html("• About");    
}

function button_menu_edit() {
    buttons_reset();
    $("#menu_popup").css('visibility','hidden');

    $("#breadcrumbs_div_2").html("• Edit");
}

function button_menu_offline_content() {
    buttons_reset();
    $("#menu_popup").css('visibility','hidden');
    $("#screen_offline_content").css('visibility','visible');
    $("#breadcrumbs_div_2").html("• Offline Content");
}

function button_menu_search() {
    buttons_reset();
    $("#menu_popup").css('visibility','hidden');
    $("#screen_search").css('visibility','visible');
    $("#breadcrumbs_div_2").html("• Search");
}

function button_menu_settings() {
    buttons_reset();
    $("#menu_popup").css('visibility','hidden');
    $("#screen_settings").css('visibility','visible');
    $("#breadcrumbs_div_2").html("• Settings");
}

function button_menu_spray() {
    buttons_reset();
    $("#menu_popup").css('visibility','hidden');
    $("#screen_spray").css('visibility','visible');
    $("#breadcrumbs_div_2").html("• Spray");
}

function button_menu_ticks() {
    buttons_reset();
    $("#menu_popup").css('visibility','hidden');
    $("#screen_ticks").css('visibility','visible');
    $("#breadcrumbs_div_2").html("• Route Ticks");
}

function buttons_reset() {
     map.enable_device_location(false);
     
     $("#button1_img").attr("src", "images/button-info.svg");
     $("#button2_img").attr("src", "images/button-destinations.svg");
     $("#button3_img").attr("src", "images/button-photos.svg");
     $("#button4_img").attr("src", "images/button-map.svg");
     
     $("#screen_about").css('visibility','hidden');
     $("#screen_destinations").css('visibility','hidden');
     $("#screen_edit").css('visibility','hidden');
     $("#screen_info").css('visibility','hidden');
     $("#screen_map").css('visibility','hidden');
     $("#screen_offline_content").css('visibility','hidden');
     $("#screen_photo").css('visibility','hidden');
     $("#screen_search").css('visibility','hidden');
     $("#screen_settings").css('visibility','hidden');
     $("#screen_stream").css('visibility','hidden');
     $("#screen_spray").css('visibility','hidden');
     $("#screen_ticks").css('visibility','hidden');
}

function change_area(area_id) {
    $("#destination_search_filter").val("");
    
    map.set_area(area_id);
    current_mode = MODE_AREA;
    create_route_list(area_id);
    
    $("#breadcrumbs_div_2").html("• " + map.selected_area.properties.name);
    $("#screen_info_title").html(map.selected_area.properties.name);
    $("#screen_info_inner").html(map.selected_area.properties.description);
}

function change_destination(destination_id) {
    var loading_html = "<div style='margin-top:5px;text-align:center;'>Loading Area List <img src='images/ui-anim_basic_16x16.gif'></div>"
    $("#destination_search_results").html(loading_html);
    
    current_mode = MODE_DESTINATION;
    map.set_destination(destination_id);
}

function change_photo_topo_photo(photo_id) {
    photo_topo.change_photo(photo_id);
    photo_bullets_update();
}

function change_route(route_id, screen_switch) {
    var title_html = "";
    var inner_html = "";
    
    current_mode = MODE_ROUTE;
    map.set_route(route_id);
    
    /* Center map on route latlng */
    var route_latlng = L.latLng(map.selected_route.geometry.coordinates[1], map.selected_route.geometry.coordinates[0]);
    map.set_view(route_latlng, map.get_zoom())
    
    /* Get rating in prefered scale */
    var route_grade = TH.util.grades.convert_common_to(map.get_grade_systems()[map.selected_route.properties.route_type], map.selected_route.properties.route_grade);
    
    title_html += "<span>" + map.selected_route.properties.name + "</span><br/>";
    title_html += "<span id='screen_info_title_second_line'>";
    title_html += "<span>" + route_grade + "</span> ";
    title_html += "<span>" + map.selected_route.properties.route_type + "</span> ";
    
    if (map.selected_route.properties.pitches > 1) {
        title_html += "<span>Multipitch</span>";
    }
    
    title_html += "</span><br/>"
    title_html += "<span>" + TH.util.get_star_html(map.selected_route.properties.rating, true).substr(5) + "</span>";
    
    $("#screen_info_title").html(title_html);
    
    /* Add route rescription */
    inner_html += "<div id='route_description'>" + map.selected_route.properties.description + "</div><br />";
    
    /* Add route comments */
    inner_html += "<div class='comments_header'>";
    
    if (map.selected_route.route_comments.length > 0) {
        inner_html += map.selected_route.route_comments.length;

        if (map.selected_route.route_comments.length == 1) {
            inner_html += " Comment</div>";
        } else {
            inner_html += " Comments</div>";
        }
        
        inner_html += "<div class='comments'>";
        
        for (var i=0; i<map.selected_route.route_comments.length; i++) {
            inner_html += map.selected_route.route_comments[i].comment;
            inner_html += "<div class='comment_meta_info'>";
            inner_html += map.selected_route.route_comments[i].user_name + " on ";
            inner_html += map.selected_route.route_comments[i].comment_date;
            inner_html += "</div><br />";
        }
        
        inner_html += "</div>";
    } else {
        inner_html += "No Comments</div>";
    }
    
    /* Set inner screen html */
    $("#screen_info_inner").html(inner_html);
    
    /* Change screen to info view */
    if (screen_switch === true) {
        button1_click();
    }
}

function click_stream_item(route_id, area_id, destination_id) {
    /* Update last stream clicks */
    stream_last.destination_id = destination_id;
    stream_last.area_id        = area_id;
    stream_last.route_id       = route_id;
    
    /* Get destination data, if new destination */
    if (map.selected_destination.destination_id != destination_id) {
        map.set_destination(destination_id);
        stream_update = true;
    } else {
        proccess_stream_change(stream_last);
    }
}

function create_area_list() {
    var area_list_html = "";
    var hidden_count   = 0;
    var search_string  = $("#destination_search_filter").val();
    var show_area      = false;
    
    if (map.areas.features.length > 0) {
        for (var i=0; i < map.areas.features.length; i++) {
        
            if (search_string.length == 0) {
                show_area = true;
            } else {
                if (map.areas.features[i].properties.name.toLowerCase().indexOf(search_string.toLowerCase()) > -1) {
                    show_area = true;
                } else {
                    show_area = false;
                }
            }
            
            if (show_area === true) {
                if (route_count = map.areas.features[i].properties.stats !== null) {
                    route_count = map.areas.features[i].properties.stats.types.Total;
                } else {
                    route_count = 0;
                }
                
                area_list_html += "<div class='destination_list_element' onclick='change_area(" + map.areas.features[i].properties.area_id + ")'>";
                area_list_html += "<div class='destination_list_name'>" + map.areas.features[i].properties.name + "</div>";
                area_list_html += "<div class='destination_list_location'>" + route_count + " routes/problems</div>";
                area_list_html += "</div>";
            } else {
                hidden_count++;
            }
        }
    } else {
        /* No Areas at destination */
        area_list_html += "<div style='text-align:center;'>No areas found</div>";
    }
    
    $("#destination_search_results").html(area_list_html);
    
    if (hidden_count > 0) {
        $("#filter_hidden_items").html(hidden_count + " hidden items.");
    } else {
        $("#filter_hidden_items").html("");
    }
}

function create_destination_list() {
    var destination_id          = 0;
    var destination_list_html   = "";
    var hidden_count            = 0;
    var show_destination        = false;
    var search_string           = $("#destination_search_filter").val();
    
    for (var i=0; i < map.destinations.features.length; i++) {
        destination_id = map.destinations.features[i].properties.destination_id;
        
        if (search_string.length == 0) {
            show_destination = true;
        } else {
            if (map.destinations.features[i].properties.name.toLowerCase().indexOf(search_string.toLowerCase()) > -1) {
                show_destination = true;
            } else {
                if (map.destinations.features[i].properties.location.toLowerCase().indexOf(search_string.toLowerCase()) > -1) {
                    show_destination = true;
                } else {
                    show_destination = false;
                }
            }
        }
        
        if (show_destination === true) {
            destination_list_html += "<div class='destination_list_element' onclick='change_destination(" + destination_id + ")'>";
            destination_list_html += "<div class='destination_list_name'>" + map.destinations.features[i].properties.name + "</div>";
            destination_list_html += "<div class='destination_list_location'>" + map.destinations.features[i].properties.location + "</div>";
            destination_list_html += "</div>";
        } else {
            hidden_count++;
        }
    }
    
    $("#destination_search_results").html(destination_list_html);
    
    if (hidden_count > 0) {
        $("#filter_hidden_items").html(hidden_count + " hidden items.");
    } else {
        $("#filter_hidden_items").html("");
    }
}

function create_photo_canvas(photos) {
    var photo_bullets;
    
    photo_index = 0;
    photo_ids   = photos;
    
    if (photos.length > 0) {
        var max_height = $(window).height() - 120;
        var max_width  = $(window).width();
    
        $("#photo_topo_canvas").css({"height": max_height});
        $("#photo_topo_canvas").css({"width": max_width});
        
        photo_bullets_update();
        photo_topo.init('photo_topo_canvas', photos[0]);
        photo_topo.show_small_photos = true;
        photo_topo.resize([$("#photo_topo_canvas").height(), $("#photo_topo_canvas").width()]);
    } else {
        /* No Photo */
        var t=0;
    }
}

function create_photo_stream_html(stream_json) {
    var html = "";
    var reload_at = 6;
    
    if (stream_json.result_code > 0) {
        var reload_at = stream_json.photos.length - 4;
        
        for (var i = 0; i < stream_json.photos.length; i++) {
            var photo_name = stream_json.photos[i].photo_name;
            var photo_file = "t" + stream_json.photos[i].photo_file;
            var photo_url  = "http://topohawk.com/images/routes/" +  photo_file;
            var on_click   = "onclick='click_stream_item(" + stream_json.photos[i].route_id + "," + stream_json.photos[i].area_id + "," + stream_json.photos[i].destination_id + ")'";
            
            html = html + "<div class='stream_photo'>";
            html = html + "<img src='" + photo_url + "' alt='" + photo_name + "'" + on_click + " width='300'/>";
            html = html + "<br />";
            
            if (i == reload_at) html = html + "<div class='load_more_photos'></div>";
            
            html = html + "</div>";
        }
    } else {
        
    }
    
    return html;
}

function create_route_list(area_id) {
    var current_route   = {};
    var grade_system    = map.get_grade_systems();
    var hidden_count    = 0;
    var route_grade     = "";
    var route_list_html = "";
    var search_string   = $("#destination_search_filter").val();
    var show_route      = false;
    
    for (var i=0; i < map.routes.features.length; i++) {
        current_route = map.routes.features[i];
        
        if (search_string.length == 0) {
            show_route = true;
        } else {
            if (current_route.properties.name.toLowerCase().indexOf(search_string.toLowerCase()) > -1) {
                show_route = true;
            } else {
                show_route = false;
            }
        }
        
        if (show_route === true) {
            if (current_route.properties.area_id == area_id) {
                route_grade = TH.util.grades.convert_common_to(grade_system[current_route.properties.route_type], current_route.properties.route_grade);
                
                route_list_html += "<div class='destination_list_element' onclick='change_route(" + current_route.properties.route_id + ", true)'>";
                route_list_html += "<div class='destination_list_name'>" + current_route.properties.name + " ";
                route_list_html += "<span>" + TH.util.get_star_html(current_route.properties.rating, true).substr(5) + "</span>";
                route_list_html += "</div>";
                route_list_html += "<div class='destination_list_location'>";
                route_list_html += "<span class='route_list_rating'>" + route_grade + "</span> ";
                route_list_html += "<span class='route_list_type'>" + current_route.properties.route_type + "</span> ";
                
                if (current_route.properties.pitches > 1) {
                    route_list_html += "<span>Multipitch</span>";
                }
                
                route_list_html += "</div>";
                route_list_html += "</div>";
            }
        } else {
            hidden_count++;
        }
    }
    
    $("#destination_search_results").html(route_list_html);
    
    if (hidden_count > 0) {
        $("#filter_hidden_items").html(hidden_count + " hidden items.");
    } else {
        $("#filter_hidden_items").html("");
    }
}

function destination_info_loaded() {
    current_mode = MODE_DESTINATION;
    
    $("#breadcrumbs_div_1").html(map.selected_destination.destination_name);
    $("#breadcrumbs_div_2").html("");
    $("#screen_info_inner").html(map.selected_destination.description);
    $("#screen_info_title").html(map.selected_destination.destination_name);
    $("#destination_search_filter").val("");
    
    photo_topo.set_destination(map.selected_destination);
    create_area_list();
    
    if (stream_update === true) {
        /* Stream Item was clicked and we needed to wait for the destination info to be loaded */
        stream_update = false;
        proccess_stream_change(stream_last);
    }
}

function do_search() {

}

function filter_list() {
    if (current_mode == MODE_NONE) {
        create_destination_list();
    } else if (current_mode == MODE_DESTINATION) {
        create_area_list();
    } else {
        create_route_list(map.selected_area.properties.area_id);
    }
}

function finish_map_setup(max_slider_val) {
    if (map_finished === false) {
        th_map = map;
        $('.noUiSlider').noUiSlider({
            range: [0, max_slider_val],
            start: [0, max_slider_val],
            step:  1,
            slide: function() {
                var sliderVal  = $(".noUiSlider").val();
                var max_sport  = TH.util.grades.get_grade_by_index(th_map._options.grade_sport, parseInt(sliderVal[1]));
                var min_sport  = TH.util.grades.get_grade_by_index(th_map._options.grade_sport, parseInt(sliderVal[0]));
                var common_max = TH.util.grades.convert_to_common(th_map._options.grade_sport, max_sport);
                var common_min = TH.util.grades.convert_to_common(th_map._options.grade_sport, min_sport);
                
                map.route_filter.difficulty_min = common_min.difficulty;
                map.route_filter.difficulty_max = common_max.difficulty;

                map._filter_control._update_filter_labels(th_map);
                map.redraw_map();
            }
        });
        
        $("body select").msDropDown({
            animStyle: 'none',
            on: {change:function(data, ui) {
                map.route_filter.min_rating = parseInt(data.value);
                map.redraw_map();
            }}
        });
        
        map._leaflet_map.on('click', function () {
            /* TODO: Put Tap Action here */
        });
        
        map_finished = true;
    }
}

function get_photo_ids() {
    var data;
    var make_request = true;
    
    if (current_mode == MODE_DESTINATION) {
        data = {
            destination_id: map.selected_destination.destination_id
        };
    } else if (current_mode == MODE_AREA) {
        data = {
            area_id: map.selected_area.properties.area_id
        };
    } else if (current_mode == MODE_ROUTE) {
        data = {
            route_id: map.selected_route.properties.route_id
        };
    } else {
        make_request = false;
    }

    if (make_request == true) {
        $.ajax({
           type:     'POST',
           url:      'https://topohawk.com/api/v1/get_photos.php',
           dataType: 'json',
           data:     data,
           success:  function(response) {
                if (response.result_code > 0) {
                    create_photo_canvas(response.photo_ids);
                } else {
                    console.log("Error " + response.result);
                }
           },
           error: function (req, status, error) {
               console.log("Error retrieving photo_ids.");
           }
        });
    } else {
        console.log("Function get_photo_ids has incorrect parameters.");
    }
}

function get_user_info() {
    if (user_id >= 0) {
        map.set_user_id(user_id);
    } else {
        map.set_localization();
    }
}

function map_area_clicked(area_obj) {
    change_area(area_obj.properties.area_id);
}

function map_route_clicked(route_obj) {
    change_route(route_obj.properties.route_id, false);
}

function photo_bullets_update() {
    var bullet_div_width = $(window).width() - 58;
    var max_bullets      = bullet_div_width / 24;
    var hidden_bullets   = photo_ids.length - max_bullets;
    var left_ellipsis    = false;
    var photo_bullets    = "";
    
    for (var i=0; i<photo_ids.length; i++) {
        if (i < max_bullets && photo_index < max_bullets) {
            if (photo_index == i) {
                photo_bullets += " <span id='photo_bullet_selected'>•</span>";
            } else {
                photo_bullets += " •";
            }
        } else {
            if (photo_index >= max_bullets) {
                if (i < hidden_bullets && left_ellipsis == false) {
                    photo_bullets += " ⋯";
                    left_ellipsis  = true;
                } else if (i > hidden_bullets) {
                    if (photo_index == i) {
                        photo_bullets += " <span id='photo_bullet_selected'>•</span>";
                    } else {
                        photo_bullets += " •";
                    }
                }
            } else {
                photo_bullets += " ⋯";
                break;
            }
        }
    }
    
    $("#photo_bullets").html(photo_bullets);
}

function photo_show_next() {
    photo_index++;
    
    if (photo_index >= photo_ids.length) {
        photo_index = 0;
    }
    
    change_photo_topo_photo(photo_ids[photo_index]);
}

function photo_show_previous() {
    photo_index--;
    
    if (photo_index < 0) {
        photo_index = (photo_ids.length - 1);
    }
    
    change_photo_topo_photo(photo_ids[photo_index]);
}

function proccess_stream_change(stream_last_obj) {
    /* Finishes the stream click action after the new destination has been loaded */
    if (stream_last_obj.route_id > 0) {
        change_area(stream_last_obj.area_id);
        change_route(stream_last_obj.route_id, true);
    } else if (stream_last_obj.area_id > 0) {
        change_area(stream_last_obj.area_id);
    }
}

function resize_window() {
    $("#screen_map").height($(window).height()-80).width($(window).width());
    var search_box_width = ($(window).width() - 48);
    
    $("#search_box").css({"width": search_box_width});
    map.invalidate_size();
}

function show_photo_stream() {
    $.ajax({
        type: 'POST',
        url:  'http://topohawk.com/api/v1/get_photo_stream.php',
        dataType: 'json',
        data: {
            'offset': stream_offset,
            'limit':  10
        },
        success: function(response) {
            if (response.result_code > 0) {
                var photo_margin = ($("#stream_inner").width() - 300) / 2.0;
                var html = create_photo_stream_html(response);
           
                $("#photo_stream_div").html($("#photo_stream_div").html() + html);
                $(".stream_photo").css( { marginLeft : photo_margin + "px" } );
                stream_scroll = false;
            } else {
                console.log("Error " + response.result);
            }
        },
        error: function (req, status, error) {
           console.log("Error getting photo stream: " + error);
        }
    });
}

function user_info_loaded() {
    /* Update Filter Max Value */
    finish_map_setup(TH.util.grades.get_grade_count(map._options.grade_sport));
    photo_topo.grade_system = map.get_grade_systems();
}

window.onresize = function () {
    resize_window();
}

document.onreadystatechange = function(e) {
    $("#destination_search_filter").keyup(function() { filter_list() });
    
    bind_swipes();
    get_user_info();
    button1_click();
    resize_window();
    
    $("#stream_inner").scroll(function() {
         if ($("#stream_inner").is(":visible")) {
            /* Code to test if new photos need to be loaded. */
            var divs = $(".load_more_photos");
            var last_index = divs.length - 1;
            var offset = divs[last_index].offsetTop;
            var view_bottom = $("#stream_inner").scrollTop() + ($(window).height() - 50);

            if (view_bottom > offset) {
                if (stream_scroll == false) {
                    /* load more photos */
                    stream_scroll  = true;
                    stream_offset += 10;
                    show_photo_stream();
                }
            }
         }
    });
};

function onDeviceReady() {
    navigator.splashscreen.show();
}
