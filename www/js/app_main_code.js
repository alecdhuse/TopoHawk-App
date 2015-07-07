var EDIT_MODE_NONE        = 0;
var EDIT_MODE_DESTINATION = 1;
var EDIT_MODE_AREA        = 2;
var EDIT_MODE_ROUTE       = 3;

var MODE_NONE        = 0;
var MODE_DESTINATION = 1;
var MODE_AREA        = 2;
var MODE_ROUTE       = 3;

var api_key_th           = "";
var current_edit_mode    = EDIT_MODE_NONE;
var current_mode         = MODE_NONE;
var destination_callback = false;
var edit_new_object      = true;
var edit_step            = 0;
var map_finished         = false;
var perform_grade_update = true;
var photo_ids            = [];
var photo_index          = 0;
var photo_topo           = new PT();
var photo_topo_init      = false;
var photos_loaded        = false;
var stream_offset        = 0;
var stream_scroll        = false;
var swipe_binded         = false;
var user_id              = -1;
var version              = "1.0.0";
var welcome_html         = "";

var destination_callback_change   = {
    change_screen:  false,
    destination_id: 0,
    area_id:        0,
    route_id:       0
};

var photo_uploader      = {
    dataurl: "",
    init:    false,
    obj:     {}
};

/* Map Setup */
var map = TH.map('screen_map', {
    cluster:        true,
    mobile:         true,
    offline:        true,
    show_location:  false,
    lat:            40.6,
    lng:            -98.0,
    zoom:           3
});

map.on_area_click               = function (area_obj)        { map_area_clicked(area_obj); };
map.on_destination_click        = function (destination_obj) { };
map.on_route_click              = function (route_obj)       { map_route_clicked(route_obj); };
map.on_user_info_loaded         = function ()                { user_info_loaded() };
map.destination_info_loaded     = function (destination_obj) { create_destination_list(); };
map.on_destination_info_loaded  = function ()                { destination_info_loaded(); };

function add_new_destination() {
    current_mode = MODE_NONE;
    show_map_edit_buttons(true);
}

function add_tick() {
    var route_id = map.selected_route.properties.route_id;
    var sel = "#tick_send_type option[value='Project']";

    $(sel).prop("selected", true);
    $("#tick_send_comment").val("");
    $("#tick_date").datepicker("setDate", new Date());
    $("#tick_public_visible").prop('checked', true);
    $("#edit_tick_id").val(0);
    $("#new_tick_route_id").val(route_id);

    buttons_reset();
    $("#screen_tick_edit").css('visibility', 'visible');
}

function bind_swipes() {
    if (swipe_binded === false) {
        $("#screen_photo").on("swipeleft", function() {
            photo_show_next();
        });

        $("#screen_photo").on("swiperight", function() {
            photo_show_previous();
        });

        swipe_binded = true;
    }
}

function bread_crumb_area_click() {
    map.selected_route = {};
    current_mode       = MODE_AREA;

    change_area(map.selected_area.properties.area_id, true);
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
    photos_loaded            = false;

    $("#breadcrumbs_div_1").html("TopoHawk");
    $("#breadcrumbs_div_2").html("");
    $("#screen_info_title").html("");
    //$("#screen_info_inner").html(welcome_html);

    button1_click();
    create_destination_list();
}

function button1_click() {
    buttons_reset();
    $("#button1_img").attr("src", "images/button-info-selected.svg");
    $("#screen_info").css('visibility', 'visible');

    if (current_mode === MODE_NONE) {
        $("#breadcrumbs_div_2").html("");
    }
}

function button2_click() {
    buttons_reset();
    $("#button2_img").attr("src", "images/button-destinations-selected.svg");
    $("#screen_destinations").css('visibility','visible');

    if (current_mode == MODE_NONE) {
        $("#breadcrumbs_div_1").html("Destinations");
    }
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
        $("#breadcrumbs_div_2").html("• Photo Stream");
    }
}

function button4_click() {
    buttons_reset();
    $("#button4_img").attr("src", "images/button-map-selected.svg");
    $("#screen_map").css('visibility','visible');
    $(".leaflet-control-attribution").css('visibility','visible');
    map.enable_device_location(true);
}

function button_back_click() {
    if ($("#screen_destinations").css('visibility') == 'visible') {
        if (current_mode == MODE_DESTINATION) {
            current_mode = MODE_NONE;
            create_destination_list();
        } else if (current_mode >= MODE_AREA) {
            current_mode = MODE_DESTINATION;
            create_area_list();
            $("#breadcrumbs_div_2").html("");
        }

        button2_click();
    } else if ($("#screen_info").css('visibility') == 'visible') {
        button2_click();
    } else if ($("#screen_map").css('visibility') == 'visible') {
        current_mode = MODE_AREA;
        change_area(map.selected_area.properties.area_id, false);
        map.selected_route = {};
        map.redraw_map();
    }
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

    $("#screen_edit").css('visibility','visible');
}

function button_login_logout() {
    if (api_key_th.length > 0) {
        //logout
        api_key_th = "";
        user_id    = -1;

        localStorage.setItem("key", api_key_th);
        localStorage.setItem("user_id", user_id);
        $("#menu_login_logout").html("Login");
    }

    $("#menu_popup").css('visibility','hidden');
    show_login();
}

function button_menu_offline_content() {
    buttons_reset();
    $("#menu_popup").css('visibility','hidden');
    $("#screen_offline_content").css('visibility','visible');
    $("#breadcrumbs_div_2").html("• Offline Content");

    $("#screen_offline_inner").html("<div style='margin-top:5px;text-align:center;'>Loading Offline List <img src='images/ui-anim_basic_16x16.gif'></div>");
    create_offline_destinations_list();
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

    if (user_id >= 0) {
        get_route_ticks_html(0, 0, "#user_route_ticks");
    } else {
        $("#user_route_ticks").html("You must be logged in to use the route ticks feature.");
    }
}

function buttons_reset() {
     map.enable_device_location(false);
     hide_help_comment();

     $("#button1_img").attr("src", "images/button-info.svg");
     $("#button2_img").attr("src", "images/button-destinations.svg");
     $("#button3_img").attr("src", "images/button-photos.svg");
     $("#button4_img").attr("src", "images/button-map.svg");

     $(".captcha_question_div").css('visibility','hidden');
     $(".leaflet-control-attribution").css('visibility','hidden');
     $("#menu_popup").css('visibility','hidden');

     $("#screen_about").css('visibility','hidden');
     $("#screen_add_photo").css('visibility','hidden');
     $("#screen_destinations").css('visibility','hidden');
     $("#screen_edit").css('visibility','hidden');
     $("#screen_edit_area").css('visibility','hidden');
     $("#screen_edit_destination").css('visibility','hidden');
     $("#screen_edit_route").css('visibility','hidden');
     $("#screen_info").css('visibility','hidden');
     $("#screen_login").css('visibility','hidden');
     $("#screen_map").css('visibility','hidden');
     $("#screen_offline_content").css('visibility','hidden');
     $("#screen_photo").css('visibility','hidden');
     $("#screen_search").css('visibility','hidden');
     $("#screen_settings").css('visibility','hidden');
     $("#screen_signup").css('visibility','hidden');
     $("#screen_stream").css('visibility','hidden');
     $("#screen_spray").css('visibility','hidden');
     $("#screen_tick_edit").css('visibility','hidden');
     $("#screen_ticks").css('visibility','hidden');
}

function cancel_map_edit() {
    show_main_buttons();
    button1_click();
}

function cancel_tick() {
    if ($("#edit_tick_id").val(0) > 0) {
        button_menu_ticks();
    } else {
        button1_click();
    }
}

/* Proccesses a change in destination, area, or route
    destination_id - Int: The ID to change the destination to, required if changing area or route.
    area_id        - Int: The ID to change the area to, or < 1 if no area change is wanted.
    route_id       - Int: The ID to change the route to, or < 1 id no route change is wanted.
    change_screen  - Boolean: Automaticaly change to info sceen or not.
*/
function change(destination_id, area_id, route_id, change_screen) {
    destination_callback_change.change_screen  = change_screen;
    destination_callback_change.destination_id = destination_id;
    destination_callback_change.area_id        = area_id;
    destination_callback_change.route_id       = route_id;

    photos_loaded = false;
    destination_callback = true;
    change_destination(destination_id);

    /* Show loading screen */
    $("#search_loading_screen").css('visibility','visible');
}

function change_area(area_id, change_map_view) {
    var area_inner_html = "";

    $("#destination_search_filter").val("");

    map.set_area(area_id, change_map_view);
    current_mode = MODE_AREA;
    create_route_list(area_id);

    /* Setup Inner HTML */
    area_inner_html += "<div>" + map.selected_area.properties.description + "</div>";

    if (api_key_th.length > 0) {
        /* Show the add new route option */
        area_inner_html += "<div style='margin-top:6px;'><a nohref onclick='show_map_edit_buttons(true)'>Add Route</a></div>";
    }

    $("#breadcrumbs_div_2").html("• " + map.selected_area.properties.name);
    $("#screen_info_title").html(map.selected_area.properties.name);
    $("#screen_info_inner").html(area_inner_html);

    /* Remove selected route on Photo_Topo */
    photo_topo.selected_route_id = 0;
    photos_loaded = false;
}

function change_destination(destination_id) {
    var loading_html = "<div style='margin-top:5px;text-align:center;'>Loading Area List <img src='images/ui-anim_basic_16x16.gif'></div>"
    $("#destination_search_results").html(loading_html);

    current_mode = MODE_DESTINATION;
    map.set_destination(destination_id);

    /* Remove selected route on Photo_Topo */
    photo_topo.selected_route_id = 0;
    photos_loaded = false;
}

function change_photo_topo_photo(photo_id) {
    photo_topo.change_photo(photo_id);
    photo_bullets_update();
}

function change_route(route_id, screen_switch, change_map_view) {
    var title_html = "";
    var inner_html = "";

    current_mode  = MODE_ROUTE;
    photos_loaded = false;
    map.set_route(route_id);

    /* Update selected route on Photo_Topo */
    photo_topo.selected_route_id = route_id;

    /* Center map on route latlng */
    if (change_map_view === true) {
        var route_latlng = L.latLng(map.selected_route.geometry.coordinates[1], map.selected_route.geometry.coordinates[0]);
        map.set_view(route_latlng, map.get_zoom())
    }

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
    title_html += "<span>" + TH.util.get_star_html(map.selected_route.properties.rating, true, true).substr(5) + "</span>";
    title_html += "<span style='float:right;margin-top:-30px;'><img src='images/tick_route.svg' onclick='add_tick()' /></span>";

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

    /* Add photo link */
    if (api_key_th.length > 0) {
        inner_html += "<br /><a nohref onclick='show_upload_photo()'>Upload Photo</a>";
    }

    /* Set inner screen html */
    $("#screen_info_inner").html(inner_html);

    /* Refresh Map */
    map.redraw_map();

    /* Change screen to info view */
    if (screen_switch === true) {
        button1_click();
    }
}

function check_for_human() {
    var user_latlng = map.get_location();
    var user_location = [user_latlng.lat.toFixed(2), user_latlng.lng.toFixed(2)];
    var email_addr = $("#signup_email").val();

    /* $(".captcha_check").prop('checked', false); */

    $("#verification_text").html("<img src='images/ui-anim_basic_16x16.gif' />");

    var data = {
        email: email_addr,
        user_location: user_location
    };

    $.ajax({
       type:     'POST',
       url:      'https://topohawk.com/api/v1/get_verification.php',
       dataType: 'json',
       data:     data,
       success:  function(response) {
            if (response.result_code > 0) {
                if (response.result.check == true) {
                    $(".captcha_check_div").css('visibility','hidden');
                    $(".captcha_question_div").css('visibility','visible');

                    $("#captcha_question_text").html(response.result.question);
                    $("#captcha_question_img").attr('src', response.result.image);
                    $("#captcha_answer").val("");
                    $("#captcha_answer").focus();
                } else {
                    $("#verification_text").html("OK");
                }

                window.verification_id = response.result.verification_id;
            } else {
                console.log("Error " + response.result);
            }
       },
       error: function (req, status, error) {
           console.log("Error performing human check: " + error);
       }
    });
}

function click_stream_item(route_id, area_id, destination_id) {
    /* Update last stream clicks */
    destination_callback_change.change_screen  = true;
    destination_callback_change.destination_id = destination_id;
    destination_callback_change.area_id        = area_id;
    destination_callback_change.route_id       = route_id;

    /* Get destination data, if new destination */
    if (map.selected_destination.destination_id != destination_id) {
        map.set_destination(destination_id);
        destination_callback = true;
    } else {
        proccess_destination_callback(destination_callback_change);
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

                area_list_html += "<div class='destination_list_element' onclick='change_area(" + map.areas.features[i].properties.area_id + ", true)'>";
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

function create_offline_destinations_list() {
    TH.util.storage.get_all_destinations( function (offline_destinations) {
        var list_html = "<div>";

        if (offline_destinations.length > 0) {
            for (var i=0; i<offline_destinations.length; i++) {
                list_html += "<div class='destination_list_offline'>"
                list_html += "<div class='destination_list_name_offline'>" + offline_destinations[i].destination_name + "</div>";
                list_html += "<div class='destination_list_name_offline_delete' onclick='remove_offline_destination(" + offline_destinations[i].destination_id + ")'>✖</div>";
                list_html += "</div>"
            }
        } else {
            list_html += "No offline destinations saved.";
        }

        list_html += "</div>";

        $("#screen_offline_inner").html(list_html);
    });
}

function create_photo_canvas(photos) {
    var photo_bullets;

    photo_index = 0;
    photo_ids   = photos;

    if (photos.length > 0) {
        if (photo_topo_init === false) {
            var max_height = $(window).height() - 120;
            var max_width  = $(window).width();

            $("#photo_topo_canvas").css({"height": max_height});
            $("#photo_topo_canvas").css({"width": max_width});

            photo_topo.init('photo_topo_canvas', photos[0]);
            photo_topo.use_offline_images = true;
            photo_topo.resize([$("#photo_topo_canvas").height(), $("#photo_topo_canvas").width()]);
            photo_topo_init = true;
            photo_bullets_update();
        } else {
            change_photo_topo_photo(photos[0]);
        }
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

                route_list_html += "<div class='destination_list_element' onclick='change_route(" + current_route.properties.route_id + ", true, true)'>";
                route_list_html += "<div class='destination_list_name'>" + current_route.properties.name + " ";
                route_list_html += "<span>" + TH.util.get_star_html(current_route.properties.rating, true, true).substr(5) + "</span>";
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

function create_search_result_html(search_results) {
    var seach_results_html = "";

    for (var i=0; i<search_results.length; i++) {
        if (search_results[i].type == "destination") {
            seach_results_html += "<div class='seach_result_div' onclick='change(" + search_results[i].id + ",0,0,true)'>";
        } else if (search_results[i].type == "area") {
            seach_results_html += "<div class='seach_result_div' onclick='change(" + search_results[i].destination_id + "," + search_results[i].id + ",0,true)'>";
        } else if (search_results[i].type == "route") {
            seach_results_html += "<div class='seach_result_div' onclick='change(" + search_results[i].destination_id + "," + search_results[i].area_id + "," + search_results[i].id + ",true)'>";
        } else {
            seach_results_html += "<div class='seach_result_div'>";
        }

        seach_results_html += "<div class='destination_list_name'>" + search_results[i].title + "</div>";
        seach_results_html += "<div class='destination_list_location'>" + search_results[i].location + "</div>";

        seach_results_html += "";
        seach_results_html += "</div>";
    }

    $("#search_results").html(seach_results_html);
}

function destination_info_loaded() {
    var current_amenity;
    var camping   = [];
    var info_html = "";
    var lodging   = [];

    current_mode = MODE_DESTINATION;
    info_html += "<div>" + map.selected_destination.description + "</div>";

    for (var i=0; i<map.selected_destination.amenities.features.length; i++) {
        current_amenity = map.selected_destination.amenities.features[i];

        if (current_amenity.properties.amenity_type == "Camping") {
            camping.push(current_amenity);
        } else if (current_amenity.properties.amenity_type == "Lodging") {
            lodging.push(current_amenity);
        }
    }

    if (camping.length > 0) {
        info_html += "<br /><div>";
        info_html += "<div style='font-weight:bold;margin-bottom:5px;'><img src='images/campsite-12.svg' align='top' height='20; width='20'> Camping:</div>";

        for (var i=0; i<camping.length; i++) {
            info_html += "<div style='margin-left:12px;'><div class='amenity_name'>" + camping[i].properties.name + "</div>";
            info_html += "<div class='amenity_description'>" + camping[i].properties.description + "</div></div><br />";
        }

        info_html += "</div>";
    }

    /* Add Area Option */
    if (api_key_th.length > 0) {
        info_html += "<div style='margin-top:6px;'><a nohref onclick='show_map_edit_buttons(true)'>Add Area</a></div>";
    }

    $("#breadcrumbs_div_1").html(map.selected_destination.destination_name);
    $("#breadcrumbs_div_2").html("");

    /* Change title info */
    var title_html = "<div>" + map.selected_destination.destination_name;
    title_html += "<div class='destination_list_location'>" + map.selected_destination.destination_location + "</div>";

    var offline_status = TH.util.storage.get_destination_status(map.selected_destination.destination_id);

    if (offline_status == "downloaded") {
        title_html += "<div class='download_icon' id='destination_downloaded'>";
    } else if (offline_status == "downloading") {
        title_html += "<div class='download_icon' id='destination_downloading'>";
    } else {
        title_html += "<div class='download_icon' id='destination_download' onclick='download_selected_destination()'>";
    }

    title_html += "<svg width='36' height='34'><g transform='scale(1,1) translate(0,0)' ><circle class='download_outer_circle' cx='175' cy='20' r='14' transform='rotate(-90, 95, 95)'/><g><path style='stroke:none;stroke-opacity:1;fill-opacity:1'd='m 15,14.013038 c -0.288333,-0.296648 -0.120837,-0.785812 0.379028,-0.785812 0.65373,0 1.306936,0 1.960405,0 0,-2.427829 0,-4.855658 0,-7.283712 0,-0.250992 0.244035,-0.4603768 0.536562,-0.4603768 1.450579,0 2.900896,0 4.350688,0 0.292527,0 0.536563,0.2093848 0.536563,0.4603768 0,2.428054 0,4.855883 0,7.283712 0.653468,0 1.306674,0 1.960405,0 0.499865,0 0.667361,0.489164 0.379027,0.785812 -1.557262,1.605358 -3.114787,3.210716 -4.67205,4.816075 -0.114285,0.118072 -0.249277,0.160801 -0.379288,0.153158 -0.130013,0.0077 -0.264481,-0.03531 -0.37929,-0.153158 -1.557263,-1.605359 -3.114787,-3.210717 -4.67205,-4.816075 z' /><rect y='22' x='13' height='0.17780706' width='14' style='opacity:1;fill-opacity:1;fill-rule:evenodd;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1' /></g></svg></div>";

    $("#screen_info_title").html(title_html);
    $("#screen_info_inner").html(info_html);
    $("#destination_search_filter").val("");

    photo_topo.set_destination(map.selected_destination);
    create_area_list();

    if (destination_callback === true) {
        /* Stream Item was clicked and we needed to wait for the destination info to be loaded */
        destination_callback = false;
        proccess_destination_callback(destination_callback_change);
    }
}

function do_checkin() {
    var logged_in       = (user_id >= 0) ? true : false;
    var user_latlng     = map.get_location();
    var user_location   = [user_latlng.lat.toFixed(2), user_latlng.lng.toFixed(2)];

    var data = {
        user_agent: navigator.userAgent,
        version:    version,
        location:   user_location,
        logged_in:  logged_in
    };

    $.ajax({
       type:     'POST',
       url:      'https://topohawk.com/api/v1/app_checkin.php',
       dataType: 'json',
       data:     data,
       success:  function(response) {
            if (response.result_code > 0) {
                console.log(response.result);
            } else {
                console.log(response.result);
            }
       },
       error: function (req, status, error) {
           console.log("Error checking in: " + error);
       }
    });
}

function do_login() {
    var login_data = {
        email:    $('#login_email').val(),
        password: $('#login_password').val(),
        get_key: true
    };

    $.ajax({
       type:     'POST',
       url:      'https://topohawk.com/api/v1/login.php',
       dataType: 'json',
       data:     login_data,
       success:  function(response) {
            if (response.result_code > 1) {
                api_key_th = response.result.key;
                user_id = response.result.user_id;

                localStorage.setItem("key", api_key_th);
                localStorage.setItem("user_id", user_id);

                $('#login_message').html('Login Successful');

                //Wait a bit
                setTimeout(function() { button1_click(); }, 1000);
            } else {
                $('#login_message').html(response.result);
            }
       },
       error: function (req, status, error) {
           $('#login_message').html("Error logging in: " + error);
       }
    });
}

function do_search() {
    var search_query = $("#search_box").val();
    var loading_html = "<div style='margin-top:5px;text-align:center;'>Searching <img src='images/ui-anim_basic_16x16.gif'></div>"
    $("#search_results").html(loading_html);

    var search_data = {
        query:  search_query,
        offset: 0,
        limit:  20
    };

    $.ajax({
       type:     'POST',
       url:      'https://topohawk.com/api/v1/search.php',
       dataType: 'json',
       data:     search_data,
       success:  function(response) {
            if (response.result_code > 0) {
                create_search_result_html(response.search_results);
            } else {
                console.log("Error " + response.result);
            }
       },
       error: function (req, status, error) {
           $("#search_results").html("Error performing seach: " + error);
       }
    });
}

function do_sign_up() {

    var data = {
        username:        $("#signup_username").val(),
        email:           $("#signup_email").val(),
        password:        $("#signup_password").val(),
        verification_id: (window.verification_id),
        answer:          parseInt($("#captcha_answer").val())
    };

    $.ajax({
       type:     'POST',
       url:      'https://topohawk.com/api/v1/user_signup.php',
       dataType: 'json',
       data:     data,
       success:  function(response) {
            if (response.result_code > 0) {
                $("#signup_message").removeClass("red_text");
                $("#signup_message").html(response.result);
            } else {
                if (response.result_code == -5) {
                    $("#captcha_answer").val("");
                    check_for_human();
                }

                $("#signup_message").addClass("red_text");
                $("#signup_message").html(response.result);
            }
       },
       error: function (req, status, error) {
           console.log("Error performing seach: " + error);
       }
    });
}

function download_selected_destination() {
    /* Start download animation */
    $(".download_icon").attr("id","destination_downloading");
    /* TODO: Set as animation if switching between destinations */

    TH.util.offline.add_offline_destination(map.selected_destination, function() {
        /* Change Downloaded Image */
        $(".download_icon").attr("id","destination_downloaded");

        /* Set download as completed */
        var local_store_item = "offline_destination_id" + map.selected_destination.destination_id;
        localStorage.setItem(local_store_item, "downloaded");
    });
}

function edit_route_tick(tick_id, send_type, comment, date, public) {
    var sel = "#tick_send_type option[value='" + send_type + "']";
    $(sel).prop("selected", true)
    $("#tick_send_comment").val(comment);
    $("#tick_date").datepicker("setDate", new Date(date));
    $("#tick_public_visible").prop('checked', public);
    $("#edit_tick_id").val(tick_id);
    $("#new_tick_route_id").val(0);

    buttons_reset();
    $("#screen_tick_edit").css('visibility','visible');
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

        $(".filter_rating_dd").msDropDown({
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

function get_edit_area_data() {
    var area_data = {};
    var area_name = $("#area_name_txt").val();
    var area_desc = $("#area_desc").val();
    var area_lat  = $("#area_latitude").val();
    var area_lng  = $("#area_longitude").val();
    var sliderVal = $("#noUiSlider_area").val();
    var min_zoom  = parseInt(sliderVal[0]);
    var max_zoom  = parseInt(sliderVal[1]);
    var dest_id   = $("#area_destination").val();

    if (edit_new_object === true) {
        area_data = {
             'destination_id':  dest_id,
             'name':            area_name,
             'description':     area_desc,
             'lat':             area_lat,
             'lng':             area_lng,
             'min_zoom':        min_zoom,
             'max_zoom':        max_zoom,
             'user_id':         user_id,
             'key':             api_key_th
        };
    } else {
        area_data = {
             'area_id':         map.selected_area.properties.area_id,
             'destination_id':  dest_id,
             'name':            area_name,
             'description':     area_desc,
             'lat':             area_lat,
             'lng':             area_lng,
             'min_zoom':        min_zoom,
             'max_zoom':        max_zoom,
             'user_id':         user_id,
             'key':             api_key_th
        };
    }

    return area_data;
}

function get_edit_destination_data() {
    var destination_data = {};
    var dest_name = document.getElementById("dest_name").value;
    var dest_loc = document.getElementById("dest_loc").value;
    var dest_desc = document.getElementById("dest_desc").value;
    var dest_lat = $("#dest_lat").val();
    var dest_lng = $("#dest_lng").val();

    if (edit_new_object === true) {
        destination_data = {
            'dest_name':    dest_name,
            'dest_loc':     dest_loc,
            'dest_desc':    dest_desc,
            'dest_lat':     dest_lat,
            'dest_lng':     dest_lng,
            'user_id' :     user_id,
            'key':          api_key_th
        };
    } else {
        destination_data = {
            'destination_id':   map.selected_destination.properties.route_id,
            'dest_name':        dest_name,
            'dest_loc':         dest_loc,
            'dest_desc':        dest_desc,
            'dest_lat':         dest_lat,
            'dest_lng':         dest_lng,
            'user_id' :         user_id,
            'key':              api_key_th
        };
    }

    return destination_data;
}

function get_edit_route_data() {
    var route_data;
    var route_type = $('input[name="route_type"]:checked').val();
    var route_name = document.getElementById("route_name").value;
    var route_diff = document.getElementById("route_difficulty").value;
    var route_pitches = document.getElementById("route_pitches").value;
    var route_desc = document.getElementById("route_description").value;
    var route_lat = $("#route_latitude").val();
    var route_lng = $("#route_longitude").val();
    var new_area_id = $("#area_name_select").val();

    /* Convert Grade */
    var grade_type        = $('#difficulty_grade option:selected').val();
    var difficulty_obj    = TH.util.grades.convert_to_common(grade_type, route_diff);
    var difficulty_common = difficulty_obj.difficulty;
    var protection_rating = difficulty_obj.protection;

    /* Backwards compatibility */
    route_diff = TH.util.grades.convert_common_to('USA-YDS', difficulty_obj);

    if (edit_new_object === true) {
        route_data = {
           'area_id':           new_area_id,
           'route_name':        route_name,
           'route_diff':        route_diff,
           'route_difficulty':  difficulty_common,
           'route_protection':  protection_rating,
           'route_pitches':     route_pitches,
           'route_desc':        route_desc,
           'route_type':        route_type,
           'route_lat':         route_lat,
           'route_lng':         route_lng,
           'key':               api_key_th
         };
    } else {
        route_data = {
           'area_id':           new_area_id,
           'route_name':        route_name,
           'route_diff':        route_diff,
           'route_difficulty':  difficulty_common,
           'route_protection':  protection_rating,
           'route_pitches':     route_pitches,
           'route_desc':        route_desc,
           'route_type':        route_type,
           'route_lat':         route_lat,
           'route_lng':         route_lng,
           'route_id':          map.selected_route.properties.route_id,
           'key':               api_key_th
         };
    }

    return route_data;
}

function get_photo_ids() {
    var data;
    var make_request = true;

    if (current_mode == MODE_DESTINATION) {
        data = { destination_id: map.selected_destination.destination_id };
    } else if (current_mode == MODE_AREA) {
        data = { area_id: map.selected_area.properties.area_id };
    } else if (current_mode == MODE_ROUTE) {
        if (map.selected_route.hasOwnProperty('properties')) {
            data = { route_id: map.selected_route.properties.route_id };
        } else {
            data = { area_id: map.selected_area.properties.area_id };
        }
    } else {
        make_request = false;
    }

    if (make_request === true && photos_loaded === false) {
        $.ajax({
           type:     'POST',
           url:      'https://topohawk.com/api/v1/get_photos.php',
           dataType: 'json',
           data:     data,
           success:  function(response) {
                if (response.result_code > 0) {
                    photos_loaded = true;
                    create_photo_canvas(response.photo_ids);
                } else {
                    create_photo_canvas([0]);
                    console.log("Error " + response.result);
                }
           },
           error: function (req, status, error) {
               console.log("Error retrieving photo_ids.");
           }
        });
    } else {
        if (photos_loaded === false) {
            console.log("Function get_photo_ids has incorrect parameters.");
        }
    }
}

function get_route_ticks(user_id, route_id, callback) {
    data = {
        key:        api_key_th,
        route_id:   route_id,
        user_id:    user_id
    }

    $.ajax({
       type:     'GET',
       url:      'https://topohawk.com/api/v1/get_route_ticks.php',
       dataType: 'json',
       data:     data,
       success:  function(response) {
            if (response.result_code > 0) {
                callback(response.result);
            } else {
                console.log("Error " + response.result);
            }
       },
       error: function (req, status, error) {
           console.log("Error retrieving route ticks.");
       }
    });
}

function get_route_ticks_html(user_id, route_id, html_element) {
    get_route_ticks(user_id, route_id, function (result) {
        var html = "";

        for (var i=0; i<result.length; i++) {
            var args = "edit_route_tick(" + result[i].tick_id + ", '" + result[i].send_type + "', '" + result[i].send_comment + "', '" + result[i].send_date + "', " + result[i].send_public + ")";

            if (i % 2 == 0) {
                html += "<div class='route_tick_colored' onclick=\"" + args + "\">";
            } else {
                html += "<div class='route_tick' onclick=\"" + args + "\">";
            }

            html += "<div class='route_tick_name'>";
            html += "<a nohref>" + result[i].route_name + "</a>";
            html += "<div class='route_tick_comment'>" + result[i].send_comment + "</div>";
            html += "</div>";

            html += "<div class='route_tick_type'>";
            html += "<div>" + result[i].send_type + "</div>";
            html += "<div class='route_tick_date'>" + result[i].send_date + "</div>";
            html += "</div>";

            if (user_id = window.user_id) {
                //html += "<div style='text-align:center;'>Edit" + "</div>";
            }

            html += "</div>";
        }

        $(html_element).html(html);
    });
}

function get_user_info() {
    if (user_id >= 0) {
        map.set_user_id(user_id);
    } else {
        if (typeof(localStorage.settings_sport_grade) !== "undefined") {
            this.perform_grade_update = false;

            map._options.grade_aid = localStorage.settings_aid_grade;
            map._options.grade_boulder = localStorage.settings_boulder_grade;
            map._options.grade_sport = localStorage.settings_sport_grade;
            map._options.grade_mixed = localStorage.settings_sport_grade;
            map._options.grade_top = localStorage.settings_sport_grade;
            map._options.grade_trad = localStorage.settings_trad_grade;

            $("#settings_aid_grade").val(localStorage.settings_aid_grade);
            $("#settings_boulder_grade").val(localStorage.settings_boulder_grade);
            $("#settings_sport_grade").val(localStorage.settings_sport_grade);
            $("#settings_trad_grade").val(localStorage.settings_trad_grade);

            this.perform_grade_update = true;
        } else {
            map.set_localization();
        }
    }
}

function hide_help_comment() {
    $("#help_comment").css('visibility','hidden');
}

function hide_image_upload_info() {
    show_upload_photo();
    return false;
}

function map_area_clicked(area_obj) {
    change_area(area_obj.properties.area_id, true);
}

function map_route_clicked(route_obj) {
    change_route(route_obj.properties.route_id, false, false);
}

function on_load() {
    if (navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry)/)) {
        document.addEventListener("deviceready", onDeviceReady, false);
    } else {
        onDeviceReady();
    }
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

function proccess_destination_callback(destination_callback_change_obj) {
    /* Finishes the destination callback action after the new destination has been loaded */
    if (destination_callback_change_obj.route_id > 0) {
        change_area(destination_callback_change_obj.area_id, true);
        change_route(destination_callback_change_obj.route_id, destination_callback_change_obj.change_screen, true);
    } else if (destination_callback_change_obj.area_id > 0) {
        change_area(destination_callback_change_obj.area_id);

        if (destination_callback_change_obj.change_screen === true) {
            button1_click();
        }
    } else if (destination_callback_change_obj.destination_id > 0) {
        if (destination_callback_change_obj.change_screen === true) {
            button1_click();
        }
    }

    /* Hide any loading screens */
    $("#search_loading_screen").css('visibility','hidden');
}

function remove_offline_destination(destination_id) {
    TH.util.offline.remove_offline_destination(destination_id);
    button_menu_offline_content();
}

function resize_window() {
    var max_crumb_width = ($(window).width() - 45)
    $("#breadcrumbs_div").css({"max-width": max_crumb_width});

    $("#screen_map").height($(window).height()-80).width($(window).width());
    var search_box_width = ($(window).width() - 48);

    $("#search_box").css({"width": search_box_width});
    map.invalidate_size();

    var load_center_top  = ($(window).height() / 2.0) - 75;
    var load_center_left = ($(window).width() / 2.0) - 75;
    $(".loading_screen_center").css({"margin-top": load_center_top});
    $(".loading_screen_center").css({"margin-left": load_center_left});
}

function save_map_edit() {
    buttons_reset();

    if (edit_step == 1) {
        /* Just transitioned from the target/map screen */
        var map_center = map.get_center();

        $("#target_overlay").css('visibility','hidden')
        $(".latitude").val(map_center.lat);
        $(".longitude").val(map_center.lng);

        if (current_edit_mode == EDIT_MODE_ROUTE) {
            show_edit_route_screen();
        } else if (current_edit_mode == EDIT_MODE_AREA) {
            show_edit_areas_screen();
        } else if (current_edit_mode == EDIT_MODE_DESTINATION) {
            show_edit_destination_screen();
        }

        edit_step = 2;
    } else if (edit_step == 2) {
        /* Just transitioned from the information screen */
        if (current_edit_mode == EDIT_MODE_ROUTE) {
            if (edit_new_object === true) {
                var route_data = get_edit_route_data();

                /* Add new Route */
                $.ajax({
                     dataType: 'json',
                     type: 'POST',
                     url: 'https://topohawk.com/api/v1.1/add_route.php',
                     data: route_data,
                     success: function(response) {
                        if (response.result_code > 0) {
                            map.set_destination(map.selected_destination.destination_id);
                            button1_click();
                            show_main_buttons();
                            show_help_comment("Route Added");
                            setTimeout(function() { hide_help_comment(); }, 2000);
                        } else {
                            show_help_comment(response.result);
                            setTimeout(function() { hide_help_comment(); }, 2000);
                            console.log(response.result);
                        }
                    },
                    error: function (req, status, error) {
                        show_help_comment("Could Not Add Route");
                        setTimeout(function() { hide_help_comment(); }, 2000);
                       console.log("Error adding route: " + error);
                       /* TODO: Handle errors */
                    }
                });
            } else {
                /* Update existing route */

            }
        } else if (current_edit_mode == EDIT_MODE_AREA) {
            var area_data = get_edit_area_data();

            if (edit_new_object === true) {
                $.ajax({
                    type:       'POST',
                    dataType:   'json',
                    url:        'https://topohawk.com/api/v1.1/add_area.php',
                    data:       area_data,
                    success: function(response) {
                        if (response.result_code > 0) {
                            map.set_destination(map.selected_destination.destination_id);
                            button1_click();
                            show_main_buttons();
                            show_help_comment("Area Added");
                            setTimeout(function() { hide_help_comment(); }, 2000);
                        } else {
                            show_help_comment(response.result);
                            setTimeout(function() { hide_help_comment(); }, 2000);
                            console.log(response.result);
                        }
                    },
                    error: function (req, status, error) {
                        console.log("Error adding area: " + error);
                        /* TODO: Handle errors */
                    }
                });
            } else {

            }
        } else if (current_edit_mode == EDIT_MODE_DESTINATION) {
            var destination_data = get_edit_destination_data();

            if (edit_new_object === true) {
                $.ajax({
                    type:       'POST',
                    dataType:   'json',
                    url:        'https://topohawk.com/api/v1.1/add_destination.php',
                    data:       destination_data,
                    success: function(response) {
                        if (response.result_code > 0) {
                            /* TODO update destination lists */
                            button1_click();
                            show_main_buttons();
                            show_help_comment("Destination Added");
                            setTimeout(function() { hide_help_comment(); }, 2000);
                        } else {
                            show_help_comment(response.result);
                            setTimeout(function() { hide_help_comment(); }, 2000);
                            console.log(response.result);
                        }
                    },
                    error: function (req, status, error) {
                        console.log("Error adding destination: " + error);
                        /* TODO: Handle errors */
                    }
                });
            } else {

            }
        }
    }
}

function set_area_slider_val(min, max) {
    $("#noUiSlider_area").val([min, max]);
    $("#noUiSlider_area").find(".noUi-handle-lower").html('<div style="background: white; margin-left: 7px; margin-top: 4px;">' + min + '</div>');
    $("#noUiSlider_area").find(".noUi-handle-upper").html('<div style="background: white; margin-left: 7px; margin-top: 4px;">' + max + '</div>');
}

function settings_load() {
    var use_high_res_photos = false;

    if(typeof(Storage) !== "undefined") {
        if (typeof(localStorage.use_high_res_photos) !== "undefined") {
            use_high_res_photos = (localStorage.use_high_res_photos == "true") ? true : false;
        }

        photo_topo.show_high_res_photos = use_high_res_photos;

        if (use_high_res_photos === true) {
            $("#settings_high_res_photos").prop('checked', "checked");
        } else {
            $("#settings_high_res_photos").prop('checked', false);
        }

        /* load key and user_id */
        if (localStorage.getItem("key") !== null ) {
            api_key_th = localStorage.getItem("key");

            if (api_key_th.length > 0) {
                $("#welcome_account_links").css('visibility','hidden');
                $("#menu_login_logout").html("Logout");
            }
        } else {
            api_key_th = "";
        }

        if (localStorage.getItem("user_id") !== null ) {
            user_id = localStorage.getItem("user_id");
        } else {
            user_id = -1;
        }
    }
}

function setting_save() {
    if(typeof(Storage) !== "undefined") {
        var use_high_res_photos = Boolean($("#settings_high_res_photos").is(":checked"));

        localStorage.setItem("use_high_res_photos",     use_high_res_photos);
        localStorage.setItem("settings_aid_grade",      $("#settings_aid_grade").val());
        localStorage.setItem("settings_boulder_grade",  $("#settings_boulder_grade").val());
        localStorage.setItem("settings_sport_grade",    $("#settings_sport_grade").val());
        localStorage.setItem("settings_trad_grade",     $("#settings_trad_grade").val());
    } else {
        console.log("Error: no local storage.");
    }
}

function settings_update_photo_res() {
    photo_topo.show_high_res_photos = $("#settings_high_res_photos").is(":checked");
    photos_loaded = false;
    setting_save();
}

function settings_update_grades(callback) {
    if (this.perform_grade_update === true) {
        setting_save();

        if (this.user_id >= 0) {
            data = {
                key:                        api_key_th,
                user_id:                    this.user_id,
                aid_grade_preference:       $("#settings_aid_grade").val(),
                boulder_grade_preference:   $("#settings_boulder_grade").val(),
                sport_grade_preference:     $("#settings_sport_grade").val(),
                trad_grade_preference:      $("#settings_trad_grade").val()
            }

            $.ajax({
               type:     'POST',
               url:      'https://topohawk.com/api/v1.1/update_user_prefs.php',
               dataType: 'json',
               data:     data,
               success:  function(response) {
                    if (response.result_code > 0) {
                        if (callback) {
                            callback(response.result);
                        }
                    } else {
                        console.log("Error " + response.result);
                    }
               },
               error: function (req, status, error) {
                   console.log("Error updating grade preferences.");
               }
            });
        } else {
            /* User not logged in */
        }
    }
}

function show_help_comment(comment_text) {
    var comment_top = (($(window).height() - 105)) + "px";

    $("#help_comment").css({'top': comment_top});
    $("#help_comment_inner").html(comment_text);
    $("#help_comment").css('visibility','visible');
}

function show_login() {
    buttons_reset();
    $("#breadcrumbs_div_2").html("• Login");
    $("#screen_login").css('visibility','visible');
}

function show_edit_areas_screen() {
    $("#screen_edit_area").css('visibility','visible');
    $("#area_destination").empty();
    set_area_slider_val(14, 18);

    for (var i=0; i < map.destinations.features.length; i++) {
        $("#area_destination").append($('<option>', {
            value: map.destinations.features[i].properties.destination_id,
            text:  map.destinations.features[i].properties.name
        }));

        if (map.selected_destination.destination_id == map.destinations.features[i].properties.destination_id) {
            $("#area_destination").val(map.destinations.features[i].properties.destination_id);
        }
    }
}

function show_edit_destination_screen() {
    $("#screen_edit_destination").css('visibility','visible');
}

function show_edit_route_screen() {
    var areas = map.selected_destination.areas.features;
    var grade_systems = map.get_grade_systems();

    $("#screen_edit_route").css('visibility','visible');
    $("#area_name_select").empty();

    for (var i=0; i < areas.length; i++) {
        $("#area_name_select").append($('<option>', {
            value: areas[i].properties.area_id,
            text: areas[i].properties.name
        }));

        if (areas[i] == map.selected_area) {
            $("#area_name_select").val(areas[i].properties.area_id);
        }
    }
}

function show_map_edit_buttons(is_new) {
    edit_step = 1;
    edit_new_object = is_new;

    $("#button_group_right_main").css('visibility','hidden');
    $("#button_group_left_main").css('visibility','hidden');
    $("#button_group_right_main").width(0);
    $("#button_group_left_main").width(0)

    $("#button_group_right_secondary").css('visibility','visible');
    $("#button_group_left_secondary").css('visibility','visible');
    button4_click();

    $("#target_overlay").css('visibility','visible');
    var target_top = (($(window).height() - 80) / 2) - 20 + "px";
    var target_left = (($(window).width() / 2) - 20) + "px";
    $("#target_overlay").css({'top':  target_top});
    $("#target_overlay").css({'left':  target_left});

    if (current_mode == MODE_AREA) {
        current_edit_mode = EDIT_MODE_ROUTE;
        show_help_comment("Drag the map to position the target over the new route's location.");
    } else if (current_mode == MODE_DESTINATION) {
        current_edit_mode = EDIT_MODE_AREA;
        show_help_comment("Drag the map to position the target over the new area's location.");
    } else if (current_mode == MODE_NONE) {
        current_edit_mode = EDIT_MODE_DESTINATION;
        show_help_comment("Drag the map to position the target over the new destination's location.");
    }
}

function show_main_buttons() {
    $("#button_group_right_secondary").css('visibility','hidden');
    $("#button_group_left_secondary").css('visibility','hidden');

    $("#button_group_right_main").width('100%;');
    $("#button_group_left_main").width('100%;');
    $("#button_group_right_main").css('visibility','visible');
    $("#button_group_left_main").css('visibility','visible');

    $("#target_overlay").css('visibility','hidden');
    hide_help_comment();
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

function show_signup() {
    buttons_reset();
    $("#breadcrumbs_div_2").html("• Sign Up");
    $("#screen_signup").css('visibility','visible');

    if ($(".captcha_check_div").css('visibility') == 'hidden') {
        $(".captcha_question_div").css('visibility','visible');
    }
}

function show_upload_photo() {
    var window_obj = this;
    buttons_reset();

    /* Initiate Photo Uploader, if nessasary. */
    if (photo_uploader.init === false) {
        var max_uploader_width  = $('#screen_add_photo').width() - 16;
        var max_uploader_height = $('#screen_add_photo').height() - 90;

        photo_uploader.obj = new UPLOAD_PREVIEW();
        photo_uploader.obj.init('upload_photo_preview', max_uploader_height, max_uploader_width);
        photo_uploader.obj.resize_canvas();
        photo_uploader.obj.upload_photo = function(img_dataurl) { window_obj.show_upload_photo_info(img_dataurl); };
        photo_uploader.init = true;
    }

    $('#upload_photo_message').hide();
    $('#upload_photo_preview').show();
    $('#upload_photo_info').hide();
    $("#screen_add_photo").css('visibility','visible');
}

function show_upload_photo_info(img_dataurl) {
    photo_uploader.dataurl = img_dataurl;
    $('#upload_photo_preview').hide();
    $('#upload_photo_info').show();
}

function update_current_route_tick() {
    var tick_comment = $("#tick_send_comment").val();
    var tick_id      = parseInt($("#edit_tick_id").val());
    var tick_public  = $("#tick_public_visible").is(":checked");
    var tick_type    = $("#tick_send_type").val();
    var route_id     = $("#new_tick_route_id").val();

    //Get Send Date
    var day1   = $("#tick_date").datepicker('getDate').getDate();
    var month1 = $("#tick_date").datepicker('getDate').getMonth() + 1;
    var year1  = $("#tick_date").datepicker('getDate').getFullYear();
    var tick_date = year1 + "-" + month1 + "-" + day1;

    if ($("#edit_tick_id").val(0) > 0) {
        //Update existing tick
        var data = {
            'user_id':       user_id,
            'key':           api_key_th,
            'tick_id':       tick_id,
            'tick_type':     tick_type,
            'tick_date':     tick_date,
            'tick_comment':  tick_comment,
            'is_public':     tick_public
        };

        $.ajax({
           type:     'POST',
           url:      'https://topohawk.com/api/v1/edit_route_tick.php',
           dataType: 'json',
           data:     data,
           success:  function(response) {
                if (response.result_code > 0) {
                    console.log(response.result);
                    button_menu_ticks();
                } else {
                    console.log(response.result);
                }
           },
           error: function (req, status, error) {
               console.log("Error updating tick: " + error);
           }
        });
    } else {
        //Create a new tick
        var data = {
            'user_id':       user_id,
            'key':           api_key_th,
            'route_id':      route_id,
            'tick_type':     tick_type,
            'tick_date':     tick_date,
            'tick_comment':  tick_comment,
            'is_public':     tick_public
        };

        $.ajax({
           type:     'POST',
           url:      'https://topohawk.com/api/v1/add_route_tick.php',
           dataType: 'json',
           data:     data,
           success:  function(response) {
                if (response.result_code > 0) {
                    console.log(response.result);
                } else {
                    console.log(response.result);
                }
           },
           error: function (req, status, error) {
               console.log("Error updating tick: " + error);
           }
        });
    }

    //TODO: Handle Errors
}

function update_route_edit_grade() {
    var route_type = $('input[name="route_type"]:checked').val();
    $("#difficulty_grade").val(map.get_grade_systems()[route_type]);
}

function upload_photo() {
    $('#upload_photo_message').html('Uploading Photo...');
    $('#upload_photo_info').hide();
    $('#upload_photo_message').show();

    var post_data = {
        'area_id':       map.selected_area.properties.area_id,
        'dest_id':       map.selected_destination.destination_id,
        'route_id':      map.selected_route.properties.route_id,
        'photo_name':    $("#photo_name").val(),
        'photo_caption': $("#photo_upload_caption").val(),
        'photo_type':    $("#photo_type").val(),
        'photo_data':    photo_uploader.dataurl,
        'key':           api_key_th,
        'user_id':       user_id
    };

    $.ajax({
        type:       'POST',
        dataType:   'json',
        url:        'https://topohawk.com/api/v1/add_photo.php',
        data:       post_data,
        success: function(response) {
            if (response.result_code > 0) {
                $('#upload_photo_message').html('Photo Uploaded.');

                setTimeout(function(){
                    button1_click();
                }, 1200);
            } else {
                $('#upload_photo_message').html('Photo Upload Failed: ' + response.result);
            }
        },
        error: function (req, status, error) {
            $('#upload_photo_message').html('Photo Upload Failed.');
        }
    });

    return false;
}

function user_info_loaded() {
    /* Update Filter Max Value */
    finish_map_setup(TH.util.grades.get_grade_count(map._options.grade_sport));
    photo_topo.grade_system = map.get_grade_systems();

    /* Update User Settings Screen */
    $("#settings_aid_grade").val(map._options.grade_aid);
    $("#settings_boulder_grade").val(map._options.grade_boulder);
    $("#settings_sport_grade").val(map._options.grade_sport);
    $("#settings_trad_grade").val(map._options.grade_trad);
}

window.onresize = function () {
    resize_window();
}

document.onreadystatechange = function(e) {
    /* Various key bindings */
    $("#destination_search_filter").keyup(function() { filter_list() });

    $(document).on('backbutton',
        function(e){
            e.preventDefault();
            button_back_click();
    });

    $("#search_box").keypress(function(e) {
        if(e.which == 13) {
            do_search();
        }
    });

    bind_swipes();

    /* Setup Area UI Slider */
    $('#noUiSlider_area').noUiSlider(
        {
            range: [12, 20],
            start: [12, 17],
            step:  1,
            slide: function() {
                sliderVal = $("#noUiSlider_area").val();
                set_area_slider_val(parseInt(sliderVal[0]), parseInt(sliderVal[1]))
            }
        }, true
    );

    $("#noUiSlider_area").find(".noUi-handle").addClass("noUi-handle_text");
    $("#noUiSlider_area").find(".noUi-handle").removeClass("noUi-handle");
    $("#tick_date").datepicker({dateFormat: "yy-mm-dd"});

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

    map.on_first_gps_fix = function (lat, lng) {
        do_checkin();
    };

    //TH.util.storage.delete_indexedDB();
};

function onDeviceReady() {
    if (navigator.splashscreen) {
        navigator.splashscreen.show();
    }

    map.enable_device_location(true);
    settings_load();
    get_user_info();
    TH.util.storage.check_offline_statuses();

    document.addEventListener("backbutton", button_back_click, false);
    document.addEventListener("menubutton", button_menu_click, false);

    if (navigator.splashscreen) {
        navigator.splashscreen.hide();
    }

    if (window.StatusBar) {
      StatusBar.styleDefault();
    }

    resize_window();
    button1_click();
}
