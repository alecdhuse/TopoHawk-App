(function (window, document, undefined) {
    var TH = {};
    window.TH = TH;

    TH.extend = L.Util.extend;
    TH.Class = function () {};
    TH.Class.extend = L.Class.extend;

    TH.Map = TH.Class.extend({
        initialize: function (id, options) {
            this._destination_color     = "#000";
            this._first_load            = true;
            this._first_location_fix    = true;
            this._id                    = id;
            this._gps_location          = L.latLng(0, 0);
            this._gps_orientation       = 0;
            this._gps_orientation_init  = false;
            this._location_icon         = L.icon({ iconUrl: '//topohawk.com/images/loc-ort.svg', iconSize: [16, 16] });
            this._map_layers_control;
            this._map_name              = 'map';
            this._options               = options;
            this._user_id               = -1;

            this.amenities              = {'features': new Array()};
            this.areas                  = {'features': new Array()};
            this.destinations           = {'features': new Array()};
            this.paths                  = {'features': new Array()};
            this.polygons               = {'features': new Array()};
            this.routes                 = {'features': new Array()};
            this.selected_area          = {};
            this.selected_route         = {};
            this.selected_destination   = {destination_id: 0};
            this.visible_routes         = [];
            this.local_db               = {db_type: "none"};

            this.route_filter = {
                difficulty_max:   34,
                difficulty_min:    0,
                min_rating:        0,

                route_types: {
                    'Aid':      true,
                    'Alpine':   true,
                    'Boulder':  true,
                    'Ice':      true,
                    'Mixed':    true,
                    'Sport':    true,
                    'Top Rope': true,
                    'Trad':     true
                }
            };

            /* Adjustments for running in offline or app mode */
            if (this._options.offline === true) {
                this._location_icon = L.icon({ iconUrl: 'images/loc-ort.svg', iconSize: [16, 16] });

                /* Init local db */
                var map_obj = this;
                TH.util.storage.init(function(db_init) {
                    map_obj.local_db = db_init;
                });
            }

            /* Overridable Functions */
            this.on_area_change              = function () {};
            this.on_area_click               = function (area_obj) {};
            this.on_destination_click        = function (destination_obj) {};
            this.destination_info_loaded     = function (destination_obj) {};
            this.on_first_gps_fix            = function (lat, lng) {};
            this.on_route_click              = function (route_obj) {};
            this.on_user_info_loaded         = function () {};
            this.on_destinations_info_loaded = function () {};
            this.on_localization_complete    = function () {};

            this._initialize_map_layers();
            this._create_leaflet_map();

            if (this._options.load_destinations) {
                this._get_destinations();
            }

            if (this._options.destination !== null) {
                this.selected_destination = this._options.destination;
                this.amenities   = this.selected_destination.amenities;
                this.areas       = this.selected_destination.areas;
                this.paths       = this.selected_destination.paths;
                this.polygons    = this.selected_destination.polygons;
                this.routes      = this.selected_destination.routes;

                this._draw_map_objects();

                if (this._options.area_id > 0) {
                    for (var i = 0; i < this.areas.features.length; i++) {
                        if (this.areas.features[i].properties.area_id == this._options.area_id) {
                            var latlng = L.latLng(this.areas.features[i].geometry.coordinates[1], this.areas.features[i].geometry.coordinates[0]);
                            var zoom   = this.areas.features[i].properties.click_zoom_to;

                            this.selected_area = this.areas.features[i];
                            this.set_view(latlng, zoom);
                            break;
                        }
                    }
                }
            }
        },

        add_marker: function (lat, lng, marker_type) {
            var marker_latLng = L.latLng(lat,lng);
            var new_marker = L.marker(marker_latLng, {icon: marker_icon});
            this._leaflet_map.addLayer(new_marker);
        },

        enable_device_location: function (enabled) {
            if (enabled === true) {
                /* Start GPS location */
                this._leaflet_map.locate({setView: false, maxZoom: 20, watch: true, maximumAge: 4000, enableHighAccuracy: true});

                if (this._gps_orientation_init === false) {
                    this._initialize_device_orientation(this);
                }
            } else {
                /* Stop GPS location */
                this._leaflet_map.stopLocate();
            }
        },

        get_center: function () {
            return this._leaflet_map.getCenter();
        },

        get_feature_by_name: function (features, name) {
            for (var i = 0; i < features.length; i++) {
                if (features[i].properties.name.toLowerCase() == name.toLowerCase()) {
                    return features[i];
                }
            }

            return false;
        },

        get_bounds: function () {
            return this._leaflet_map.getBounds();
        },

        get_grade_systems: function () {
            var grade_system = {
                'Aid':      this._options.grade_aid,
                'Boulder':  this._options.grade_boulder,
                'Mixed':    this._options.grade_mixed,
                'Sport':    this._options.grade_sport,
                'Top Rope': this._options.grade_top,
                'Trad':     this._options.grade_trad
            };

            return grade_system;
        },

        get_location: function () {
            return this._gps_location;
        },

        get_zoom: function () {
            return this._leaflet_map.getZoom();
        },

        hide_cluster_label: function () {
            if (this._options.cluster) {
                this._cluster_labels.clearLayers();
            }
        },

        invalidate_size: function () {
            this._leaflet_map.invalidateSize();
        },

        redraw_map: function () {
            this._draw_map_objects();
        },

        set_area: function (area_id, zoom_to) {
            zoom_to = (typeof zoom_to !== 'undefined' && zoom_to !== null) ? zoom_to : true;

            for (var i=0; i<this.areas.features.length; i++) {
                if (this.areas.features[i].properties.area_id == area_id) {
                    this.set_area_object(this.areas.features[i], zoom_to);
                    break;
                }
            }
        },

        set_area_object: function (area_obj, zoom_to) {
            this.selected_area = area_obj;

            if (zoom_to === true) {
                var area_zoom = this.selected_area.properties.click_zoom_to;
                var latlng = L.latLng(this.selected_area.geometry.coordinates[1], this.selected_area.geometry.coordinates[0]);
                this.set_view(latlng, area_zoom);
            }

            /* Call overidable call back function */
            this.on_area_change();
        },

        set_destination: function (destination_id, fail_callback) {
            this._get_destination_data(destination_id, fail_callback, true);
        },

        set_localization: function (change_view) {
            var iso_country_code = "US";
            var map_obj = this;
            var change_map_view = true;

            if (typeof change_view !== 'undefined') {
                change_map_view = change_view;
            }

            if (navigator && navigator.language) {
                iso_country_code = navigator.language.slice(-2);
            } else {
                change_map_view = false;
            }

            $.ajax({
                type:     'POST',
                url:      'https://topohawk.com/api/v1.1/get_localization.php',
                dataType: 'json',
                data: {
                     'country_code': iso_country_code
                },
                success: function(response) {
                    map_obj._update_route_grades(response, map_obj);
                    map_obj.on_localization_complete();

                    if (map_obj._options.mobile === false) {
                        if (change_view === true) {
                            map_obj.set_view(L.latLng(response.info.lat, response.info.lng), response.info.zoom);
                        }
                    }
                },
                error: function (req, status, error) {
                    TH.util.logging.log("Error retrieving localization info.");
                }
            });
        },

        set_locked: function (is_locked) {
            if (is_locked) {
                this._leaflet_map.dragging.disable();
                this._leaflet_map.touchZoom.disable();
                this._leaflet_map.doubleClickZoom.disable();
                this._leaflet_map.scrollWheelZoom.disable();
                this._leaflet_map.boxZoom.disable();
                this._leaflet_map.keyboard.disable();
                this._leaflet_map.removeControl(this._map_layers_control);
                this._leaflet_map.removeControl(this._filter_control);
            } else {
                this._leaflet_map.dragging.enable();
                this._leaflet_map.touchZoom.enable();
                this._leaflet_map.doubleClickZoom.enable();
                this._leaflet_map.scrollWheelZoom.enable();
                this._leaflet_map.boxZoom.enable();
                this._leaflet_map.keyboard.enable();
                this._map_layers_control.addTo(this._leaflet_map);
                this._filter_control.addTo(this._leaflet_map);
            }

            this.invalidate_size();
        },

        set_route: function (route_id) {
            for (var i=0; i<this.routes.features.length; i++) {
                if (this.routes.features[i].properties.route_id == route_id) {
                    this.selected_route = this.routes.features[i];
                    break;
                }
            }
        },

        set_user_id: function (new_user_id) {
            this._user_id = new_user_id;
            var map_obj = this;

            if (this._user_id >= 0) {
                $.ajax({
                   type:     'POST',
                   url:      'https://topohawk.com/api/v1.1/get_user_info.php',
                   dataType: 'json',
                   data: {
                        'user_id': new_user_id
                   },
                   success: function(response) {
                        if (response.result_code > 0) {
                            map_obj._options.grade_aid       = response.info.grade_preferences.Aid;
                            map_obj._options.grade_boulder   = response.info.grade_preferences.Boulder;
                            map_obj._options.grade_mixed     = response.info.grade_preferences.Mixed;
                            map_obj._options.grade_sport     = response.info.grade_preferences.Sport;
                            map_obj._options.grade_top       = response.info.grade_preferences['Top Rope'];
                            map_obj._options.grade_trad      = response.info.grade_preferences.Trad;

                            map_obj.user_info_loaded();
                        } else {
                            TH.util.logging.log("Error retrieving user info.");
                        }
                   },
                   error: function (req, status, error) {
                       TH.util.logging.log("Error retrieving user info.");
                   }
                });
            }
        },

        set_view: function (latlng, zoom) {
            this._leaflet_map.setView(latlng, zoom);
        },

        show_destination: function (destination) {
            this._get_destination_data(destination.properties.destination_id, null, true);
        },

        show_area_popup: function (feature) {
            this.on_area_click(feature);
        },

        show_cluster_label: function (lat, lng, label_text) {
            this.hide_cluster_label();
            var cluster_label = new L.Label({ className: "leaflet-label" });

            cluster_label.setLatLng(new L.latLng(lat, lng));
            cluster_label.setContent(label_text);
            cluster_label._isOpen = true;
            cluster_label._zIndex = 1000;
            this._cluster_labels.addLayer(cluster_label);
        },

        show_destination_popup: function (feature) {
            this.on_destination_click(feature);
        },

        show_route_popup: function (feature) {
            this.on_route_click(feature);
        },

        user_info_loaded: function () {
            this.on_user_info_loaded();
        },

        _add_filter_control: function () {
            this._filter_control = new TH.control.filter(this).addTo(this._leaflet_map);
        },

        _bind_amenities_popup: function (destination, layer) {
            var popupContent = "";

            popupContent = popupContent + "<a href='" + destination.properties.amenity_link + "'>";
            popupContent = popupContent + destination.properties.name + "</a><br />";
            popupContent = popupContent + destination.properties.description;

            layer.bindPopup(popupContent);
        },

        _create_destination_cluster_layer: function () {
            var map_obj = this;
            var destination_clusters = new L.MarkerClusterGroup({
                maxClusterRadius: 20,
                showCoverageOnHover: false,
                iconCreateFunction: function(cluster) {
                    var label   = "";
                    var markers = cluster.getAllChildMarkers();

                    for (var i = 0; i < markers.length; i++) {
                        label = label + TH.util.fix_strings(markers[i].feature.properties.name);

                        if ((i + 1) < markers.length) {
                            label = label + "<br />";
                        }
                    }

                    var mouseover_text = map_obj._map_name + ".show_cluster_label(" + cluster._latlng.lat + ", " + cluster._latlng.lng + ", &quot;" + label + "&quot;)";
                    var marker_html = "<div onmouseover=\"" + mouseover_text + "\" onmouseout='" + map_obj._map_name + ".hide_cluster_label()'><span>" + cluster.getChildCount() + "</span></div>";

                    var div_icon = new L.DivIcon({
                        html: marker_html,
                        className: 'marker-cluster marker-cluster-small',
                        iconSize: new L.Point(16, 16)
                    });

                    return div_icon;
                }
            });

            return destination_clusters;
        },

        _create_leaflet_map: function () {
            var map_obj = this;

            this._leaflet_map = L.map(this._id, {
                center:         new L.LatLng(this._options.lat, this._options.lng),
                tapTolerance:   30,
                zoom:           this._options.zoom,
                layers:         this._topo_tiles
            });

            this._map_layers_control.addTo(this._leaflet_map);

            this._leaflet_map.on('baselayerchange', function(layer_event) {
                if (layer_event.layer == this._sat_tiles) {
                    this._destination_color = "#FFF";
                } else {
                    this._destination_color = "#000";
                }

                map_obj._draw_map_objects();
            });

            this._leaflet_map.on('zoomend', function(e) {
                map_obj._draw_map_objects();
                map_obj.hide_cluster_label();
            });

            /*Add Layers to Leaflet Map */
            this._leaflet_map.addLayer(this._objects_layer);
            this._leaflet_map.addLayer(this._user_location_layer);

            if (this._options.cluster) {
                this._leaflet_map.addLayer(this._cluster_labels);
                this._leaflet_map.addLayer(this._destination_cluster_layer);
            }

            /* Geo Location */
            this._leaflet_map.on('locationerror', function(e) {
                console.log("Error finding location.");
            });

            this._leaflet_map.on('locationfound', function(e) {
                map_obj._update_location(e, map_obj);
            });

            if (this._options.show_location) {
                this._leaflet_map.locate({setView: false, watch: false, enableHighAccuracy: true});
                this._initialize_device_orientation(map_obj);
                this._gps_orientation_init = true;
            }

            if (this._options.locked === false) {
                this._add_filter_control();
            }
        },

        _draw_amenities_markers: function (zoom, mapFeature, layer_group) {
            var map_obj = this;
            var max_zoom = 25;
            var min_zoom = 0;

            for(var i=0; i < mapFeature.features.length; i++){
                max_zoom = 25;
                min_zoom = 0;

                if (mapFeature.features[i].properties.min_zoom !== null) {
                    min_zoom = mapFeature.features[i].properties.min_zoom;
                }

                if (mapFeature.features[i].properties.max_zoom !== null) {
                    max_zoom = mapFeature.features[i].properties.max_zoom;
                }

                if (this.get_zoom() <= max_zoom && this.get_zoom() >= min_zoom) {
                    layer_group.addLayer(L.geoJson(mapFeature.features[i], {
                        onEachFeature: this._bind_amenities_popup,
                        pointToLayer: function (feature, latlng) {
                            var amen_type = mapFeature.features[i].properties.amenity_type;
                            var amen_icon;

                            if (amen_type == 'Cafe') {
                                amen_icon = cafe_icon;
                            } else if (amen_type == 'Camping') {
                                amen_icon = camping_icon;
                            } else if (amen_type == 'Fuel') {
                                amen_icon = fuel_icon;
                            } else if (amen_type == 'Grocery') {
                                amen_icon = grocery_icon;
                            } else if (amen_type == 'Hospital') {
                                amen_icon = hospital_icon;
                            } else if (amen_type == 'Laundry') {
                                amen_icon = laundry_icon;
                            } else if (amen_type == 'Lodging') {
                                amen_icon = lodging_icon;
                            } else if (amen_type == 'Other') {
                                amen_icon = other_icon;
                            } else if (amen_type == 'Parking') {
                                amen_icon = parking_icon;
                            } else if (amen_type == 'Restaurant') {
                                amen_icon = restaurant_icon;
                            } else if (amen_type == 'Shop') {
                                amen_icon = shop_icon;
                            } else if (amen_type == 'Toilets') {
                                amen_icon = toilets_icon;
                            } else if (amen_type == 'Water') {
                                amen_icon = water_icon;
                            } else {
                                amen_icon = other_icon;
                            }

                            var iconMarker = L.marker(latlng, {icon: amen_icon});

                            iconMarker.bindLabel(feature.properties.name, { noHide: false, labelClassName: "leaflet-label", mobile: map_obj._options.mobile});

                            return iconMarker;
                        }
                    }));
                }
            }
        },

        _draw_area_markers: function (zoom, mapFeature, layer_group, fill_color) {
            var max_zoom     = 25;
            var min_zoom     = 0;
            var map_bounds   = this.get_bounds();
            var map_obj      = this;
            var topbar_html  = "";
            var vis_markers  = 0;
            var last_feature;
            var marker_latlng;

            for (var i=0; i < mapFeature.features.length; i++){
                if (mapFeature.features[i].properties.max_zoom !== null) {
                    max_zoom = mapFeature.features[i].properties.max_zoom;
                }

                if (mapFeature.features[i].properties.min_zoom !== null) {
                    min_zoom = mapFeature.features[i].properties.min_zoom;
                }

                if (this.get_zoom() <= max_zoom && this.get_zoom() >= min_zoom) {
                    var marker = L.geoJson(mapFeature.features[i], {
                        pointToLayer: function (feature, latlng) {
                            var newCircle = L.circleMarker(latlng, {
                                radius: 5,
                                fillColor: fill_color,
                                color: "#000",
                                weight: 1,
                                opacity: 1,
                                fillOpacity: 0.5
                            });

                            marker_latlng = latlng;
                            newCircle.bindLabel(feature.properties.name, { noHide: true, labelClassName: "leaflet-static-label", mobile: true, direction: feature.properties.label_position});

                            if (map_obj._options.mobile === false) {
                                newCircle.on("click", function () {
                                    if (map_obj._leaflet_map.getZoom() < feature.properties.click_zoom_to) {
                                        map_obj.set_view(latlng, feature.properties.click_zoom_to);
                                    }

                                    map_obj.show_area_popup(feature);
                                });
                            } else {
                                newCircle.on("click", function () {
                                    map_obj.on_area_click(feature);
                                });
                            }

                            return newCircle;
                        }
                    });

                    layer_group.addLayer(marker);
                }
            }
        },

        _draw_destination_markers: function (mapFeature, layer_group, fill_color) {
            var last_dest;
            var map_obj  = this;
            var max_zoom = 25;
            var min_zoom = 0;
            var radius   = 5;
            var vis_markers  = 0;

            if (this._options.mobile) {
                radius = 7;
            }

            for (var i = (mapFeature.features.length - 1); i >= 0; i--){
                if (mapFeature.features[i].properties.max_zoom !== null) {
                    max_zoom = mapFeature.features[i].properties.max_zoom;
                }

                if (this.get_zoom() <= max_zoom && this.get_zoom() >= min_zoom) {
                    layer_group.addLayer(
                        L.geoJson(mapFeature.features[i], {
                            pointToLayer: function (feature, latlng) {
                                var newCircle = L.circleMarker(latlng, {
                                    radius:      radius,
                                    fillColor:   fill_color,
                                    color:       "#000",
                                    weight:      1,
                                    opacity:     1,
                                    fillOpacity: 0.5
                                });

                                if (map_obj._options.mobile === false) {
                                    newCircle.bindLabel(feature.properties.name, { noHide: false, labelClassName: "leaflet-label", mobile: map_obj._options.mobile});

                                    newCircle.on("click", function () {
                                        map_obj._get_destination_data(feature.properties.destination_id, null, true);
                                        map_obj.show_destination_popup(feature);
                                        map_obj.set_view(latlng, (feature.properties.click_zoom_to));
                                        map_obj.selected_destination = feature;
                                    });
                                } else {
                                    newCircle.on("click", function () {
                                        map_obj._get_destination_data(feature.properties.destination_id, null, true);
                                    });
                                }

                                if (map_obj.get_bounds().contains(latlng)) {
                                    vis_markers = vis_markers + 1;
                                    last_dest = feature;
                                }

                                return newCircle;
                             }

                         }
                     ));
                }
            }

            if (vis_markers == 1) {
                if (last_dest.properties.destination_id != this.selected_destination.destination_id) {
                    this._get_destination_data(last_dest.properties.destination_id, null, false);
                    this.selected_destination = last_dest;
                }
            }
        },

        _draw_location_marker: function (map_obj) {
            this._user_location_layer.clearLayers();

            if (window.DeviceOrientationEvent) {
                /* Device has orientation info */
                var marker = L.rotatedMarker(this._gps_location, {
                    icon:       this._location_icon,
                    draggable:  true
                });

                marker.options.angle = this._gps_orientation;
            } else {
                var marker = L.circleMarker(this._gps_location, {
                    radius: 4,
                    fillColor: "#2E83FF",
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.6
                });
            }

            this._user_location_layer.addLayer(marker);

            if (this._first_location_fix === true) {
                if (map_obj._gps_location.lat != 0 && map_obj._gps_location.lng != 0) {
                    this.set_view(map_obj._gps_location);
                    this._first_location_fix = false;
                    this.on_first_gps_fix(map_obj._gps_location.lat, map_obj._gps_location.lng);
                }
            }
        },

        _draw_map_objects: function () {
            this._objects_layer.clearLayers();

            if (this._options.cluster) {
                this._destination_cluster_layer.clearLayers();
                this.hide_cluster_label();
            }

            if (this._options.cluster) {
                this._draw_destination_markers(this.destinations, this._destination_cluster_layer, this._destination_color);
            } else {
                this._draw_destination_markers(this.destinations, this._objects_layer, this._destination_color);
            }

            this._draw_path_objects(       this.get_zoom(), this.paths,         this._objects_layer);
            this._draw_polyons_objects(    this.get_zoom(), this.polygons,      this._objects_layer);
            this._draw_amenities_markers(  this.get_zoom(), this.amenities,     this._objects_layer);
            this._draw_area_markers(       this.get_zoom(), this.areas,         this._objects_layer, "#ff7800");
            this._draw_route_markers(      this.get_zoom(), this.routes,        this._objects_layer, this.route_filter);
        },

        _draw_path_objects: function (zoom, mapFeature, layer_group) {
            var max_zoom = 25;
            var min_zoom = 0;

            for (var i=0; i < mapFeature.features.length; i++) {
                if (mapFeature.features[i].properties.max_zoom !== null) {
                    max_zoom = mapFeature.features[i].properties.max_zoom;
                }

                if (mapFeature.features[i].properties.min_zoom !== null) {
                    min_zoom = mapFeature.features[i].properties.min_zoom;
                }

                if (this.get_zoom() <= max_zoom && zoom >= this.get_zoom()) {
                    /* add outline first */
                    var path_outline = L.geoJson(mapFeature.features[i], {
                        style: function (feature) {
                            return {color: "#444444", weight: 2};
                        }
                    });

                    var path_inline = L.geoJson(mapFeature.features[i], {
                            style: function (feature) {
                                return {color: "#fff", opacity: 1, weight: 4};
                            }
                    });

                    layerGroup.addLayer(path_outline);
                    layerGroup.addLayer(path_inline);
                }
            }
        },

        _draw_polyons_objects: function (zoom, mapFeature, layer_group) {
            var max_zoom = 25;
            var min_zoom = 0;

            for (var i=0; i < mapFeature.features.length; i++) {
                if (mapFeature.features[i].properties.max_zoom !== null) {
                    max_zoom = mapFeature.features[i].properties.max_zoom;
                }

                if (mapFeature.features[i].properties.min_zoom !== null) {
                    min_zoom = mapFeature.features[i].properties.min_zoom;
                }

                if (this.get_zoom() <= max_zoom && this.get_zoom() >= min_zoom) {
                    layer_group.addLayer(
                        L.geoJson(mapFeature.features[i], {
                            style: function (feature) {
                                return {color: "#444444", weight: 5};
                            }
                        })
                    );
                }
            }
        },

        _draw_route_markers: function (zoom, mapFeature, layer_group) {
            var common_diff    = 0;
            var div_class_name = '';
            var difficulty;
            var fill_color  = '#000';
            var map_obj     = this;
            var max_zoom    = 25;
            var min_zoom    = 0;
            var rating;
            var route_grade = '';
            var route_is_selected = false;
            var route_type;
            var show_marker = true;

            for (var i=0; i < mapFeature.features.length; i++) {
                route_is_selected = false;

                if (typeof this.selected_route !== 'undefined') {
                    if (this.selected_route.hasOwnProperty('properties')) {
                        if (this.selected_route.properties.route_id == parseInt(mapFeature.features[i].properties.route_id)) {
                            route_is_selected = true;
                        }
                    }
                }

                max_zoom    = mapFeature.features[i].properties.max_zoom;
                min_zoom    = mapFeature.features[i].properties.min_zoom;
                route_type  = mapFeature.features[i].properties.route_type;
                show_marker = this.route_filter.route_types[route_type];
                difficulty  = mapFeature.features[i].properties.difficulty;
                rating      = mapFeature.features[i].properties.rating;

                if (show_marker === true) {
                    common_diff = mapFeature.features[i].properties.route_grade;

                    if (route_type == 'Aid') {
                        div_class_name = 'marker-cluster marker-cluster-aid';
                        fill_color = "#d3d3d3";
                        route_grade = this._options.grade_aid;
                    } else if (route_type == 'Alpine') {
                        div_class_name = 'marker-cluster marker-cluster-alpine';
                        fill_color = "#ffffff";
                        route_grade = this._options.grade_sport;
                    } else if (route_type == 'Boulder') {
                        div_class_name = 'marker-cluster marker-cluster-boulder';
                        fill_color = "#00f000";
                        route_grade = this._options.grade_boulder;
                    } else if (route_type == 'Ice') {
                        div_class_name = 'marker-cluster marker-cluster-ice';
                        fill_color = "#5edafe";
                        route_grade = this._options.grade_sport;
                    } else if (route_type == 'Mixed') {
                        div_class_name = 'marker-cluster marker-cluster-mixed';
                        fill_color = "#800080";
                        route_grade = this._options.grade_sport;
                    } else if (route_type == 'Sport') {
                        div_class_name = 'marker-cluster marker-cluster-sport';
                        fill_color = "#0000ff";
                        route_grade = this._options.grade_sport;
                    } else if (route_type == 'Top Rope') {
                        div_class_name = 'marker-cluster marker-cluster-toprope';
                        fill_color = "#ffd700";
                        route_grade = this._options.grade_sport;
                    } else if (route_type == 'Trad') {
                        div_class_name = 'marker-cluster marker-cluster-trad';
                        fill_color = "#ff0000";
                        route_grade = this._options.grade_trad;
                    }

                    show_marker = ((common_diff.difficulty >= this.route_filter.difficulty_min) &&
                                   (common_diff.difficulty <= this.route_filter.difficulty_max) &&
                                   (rating >= this.route_filter.min_rating));

                    difficulty = TH.util.grades.convert_common_to(route_grade, common_diff);
                }

                if (this.get_zoom() <= max_zoom && this.get_zoom() >= min_zoom && show_marker || (route_is_selected === true)) {
                    layer_group.addLayer(
                        L.geoJson(mapFeature.features[i], {
                            pointToLayer: function (feature, latlng) {
                                var selected_area = (map_obj.selected_area.hasOwnProperty('properties') === true) ? map_obj.selected_area.properties.area_id : 0;

                                if (route_is_selected === true) {
                                    var new_marker = L.marker(latlng, {icon: marker_icon});
                                } else if (map_obj._options.show_numberings === true && feature.properties.display_order > 0 && feature.properties.area_id == selected_area) {
                                    var c_feature     = mapFeature.features[i];
                                    var marker_latLng = L.latLng(c_feature.geometry.coordinates[1], c_feature.geometry.coordinates[0]);

                                    if (c_feature.properties.display_order > 0) {
                                        var marker_html = "<div><span>" + c_feature.properties.display_order + "</span></div>";
                                    }

                                    var new_div_icon = new L.DivIcon({
                                        html: marker_html,
                                        className: div_class_name,
                                        iconSize: new L.Point(16, 16)
                                    });

                                    var new_marker = L.marker(marker_latLng, {icon: new_div_icon});
                                } else {
                                    var new_marker = L.circleMarker(latlng, {
                                        radius: 5,
                                        fillColor: fill_color,
                                        color: "#000",
                                        weight: 1,
                                        opacity: 1,
                                        fillOpacity: 0.5
                                    });
                                }

                                var lable_text = "<b>" + feature.properties.name + "</b><br/>" + difficulty + " " + route_type + "<br/>" + TH.util.get_star_html(rating, true, map_obj._options.offline);
                                new_marker.bindLabel(lable_text, { noHide: false, labelClassName: "leaflet-label", mobile: map_obj._options.mobile});

                                if (map_obj._options.mobile === false) {
                                    new_marker.on("click", function () {
                                        map_obj.set_area(feature.properties.area_id, false);
                                        map_obj.show_route_popup(feature);
                                    });
                                } else {
                                    new_marker.on("click", function () {
                                        map_obj.set_area(feature.properties.area_id, false);
                                        map_obj.on_route_click(feature);
                                    });
                                }

                                return new_marker;
                            }
                        }
                    ));
                }
            }
        },

        _get_destination_data: function (destination_id, fail_callback, auto_zoom) {
            var map_obj = this;
            var offline_destination_found = false;

            $.ajax({
               type:     'POST',
               url:      'https://topohawk.com/api/v1.1/get_destination_data.php',
               dataType: 'json',
               data: {
                   'destination_id': destination_id,
                   'user_id':        this._user_id
               },
               success: function(response) {
                   map_obj._update_destination_data(response.result, auto_zoom);
               },
               error: function (req, status, error) {
                    if (status  == "timeout" || status == "error") {
                        /* Check local cache if there is no connection */
                        if (TH.util.storage.get_destination_status(destination_id) != "none") {
                            TH.util.storage.get_destination(
                                destination_id,
                                function (destination_obj) {
                                    map_obj._update_destination_data(destination_obj, auto_zoom);
                                },
                                db);
                        } else {
                            TH.util.logging.log('No connection and destination was not found in offline cache: ' + error);

                            if (typeof fail_callback !== 'undefined' && fail_callback !== null) {
                                fail_callback(status);
                            }
                        }
                    } else {
                        TH.util.logging.log('Error getting destination data: ' + error);
                    }
               }
            });
        },

        _get_destinations: function () {
            var map_obj = this;

            $.ajax({
                type:     'POST',
                url:      'https://topohawk.com/api/v1/get_destinations.php',
                dataType: 'json',
                success: function(response) {
                    map_obj._update_destinations(response, map_obj);
                },
                error: function (req, status, error) {
                    if (status  == "timeout" || status == "error") {
                        /* Check local cache if there is no connection */
                        TH.util.storage.get_all_destinations(function (offline_destinations) {
                            var offline_response = {
                                features: []
                            };

                            /* Change JSON Format */
                            for (var i=0; i<offline_destinations.length; i++) {
                                var destination = {
                                    "type": "Feature",
                                    geometry: {
                                        type:        "Point",
                                        coordinates: [offline_destinations[i].destination_lng, offline_destinations[i].destination_lat]
                                    },
                                    properties: {
                                        click_zoom_to:  offline_destinations[i].destination_zoom,
                                        description:    offline_destinations[i].description,
                                        destination_id: offline_destinations[i].destination_id,
                                        location:       offline_destinations[i].destination_location,
                                        max_zoom:       offline_destinations[i].destination_zoom,
                                        name:           offline_destinations[i].destination_name
                                    }
                                };

                                offline_response.features.push(destination);
                            }

                            map_obj._update_destinations(offline_response, map_obj);
                        });
                    } else {
                        TH.util.logging.log('Error getting destinations: ' + error);
                    }
                }
            });
        },


        _get_topo_tile: function (layer, canvas, tilePoint, zoom, err_count) {
            //Gets the Topo Layer tile if exists or gets MapBox tile.
            var map_obj = this;
            var url = '';

            if ((typeof canvas !== 'undefined') && (typeof tilePoint !== 'undefined')) {
                var ctx = canvas.getContext('2d');
                var x = tilePoint.x;
                var max_tiles = Math.pow(2, zoom);
                var img = new Image;

                img.onload = function() {
                    ctx.drawImage(img,0,0);
                    layer.tileDrawn(canvas);
                };

                //mod to make sure requests are in range
                x = ((x % max_tiles) + max_tiles) % max_tiles;

                var tile = '{z}/{x}/{y}.png'
                .replace('{z}', zoom)
                .replace('{x}', x)
                .replace('{y}', tilePoint.y);

                if ((this._options.offline === true) && (zoom < 6)) {
                    url = 'images/tiles/' + tile;
                    img.src = url;
                } else if (err_count == 1 || (zoom < 13)) {
                    TH.util.storage.get_tile(x, tilePoint.y, zoom, function(tile_data_url) {
                        if (tile_data_url === null) {
                            url = 'http://a.tiles.mapbox.com/v3/scarletshark.h69c7n2p/' + tile;

                            img.onerror = function() {
                                map_obj._get_topo_tile(layer, canvas, tilePoint, zoom, 2);
                            };

                            img.src = url;
                        } else {
                            img.src = tile_data_url;
                        }
                    });
                } else if (err_count >= 2) {
                    /* Tile cannot be loaded */
                    layer.tileDrawn(canvas);
                } else {
                    TH.util.storage.get_tile(x, tilePoint.y, zoom, function(tile_data_url) {
                        if (tile_data_url === null) {
                            //Look for custom topo tile first
                            if (err_count == 0) {
                                var url = 'http://foldingmap.co/map/' + tile;

                                img.onerror = function() {
                                    map_obj._get_topo_tile(layer, canvas, tilePoint, zoom, 1);
                                };

                                img.src = url;
                            }
                        } else {
                            img.src = tile_data_url;
                        }
                    }, this.local_db);
                }
            }
        },

        _initialize_device_orientation: function (map_obj) {
            if (window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientation', function(event) {
                    if(event.webkitCompassHeading) {
                        map_obj._gps_orientation = event.webkitCompassHeading;
                    } else {
                        map_obj._gps_orientation = event.alpha;
                        if(!window.chrome) {
                            map_obj._gps_orientation = map_obj._gps_orientation - 270;
                        }
                    }

                    if (navigator.userAgent.match(/(iPad|iPhone|iPod)/g) ? true : false) {
                        map_obj._gps_orientation = (map_obj._gps_orientation);
                    } else {
                        map_obj._gps_orientation = (map_obj._gps_orientation - 180);
                    }

                    map_obj._draw_location_marker(map_obj);
                });

                // MIT-licensed code by Benjamin Becquet
                // https://github.com/bbecquet/Leaflet.PolylineDecorator
                L.RotatedMarker = L.Marker.extend({
                  options: { angle: 0 },
                  _setPos: function(pos) {
                    L.Marker.prototype._setPos.call(this, pos);
                    if (L.DomUtil.TRANSFORM) {
                       this._icon.style[L.DomUtil.TRANSFORM] += ' rotate(' + this.options.angle + 'deg)';
                    }
                  }
                });

                L.rotatedMarker = function(pos, options) {
                    return new L.RotatedMarker(pos, options);
                };
            }

            this._gps_orientation_init = true;
        },

        _initialize_map_layers: function () {
            var map_obj = this;

            this._sat_tiles = L.tileLayer(
                'http://{s}.tiles.mapbox.com/v3/scarletshark.h68kpm4j/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="http://www.mapbox.com/about/maps/" target="_blank">Mapbox</a>',
                    maxZoom: 19
                }
            );

            this._topo_tiles = L.tileLayer.canvas({
                async: true,
                attribution: "&copy; <a href='http://openstreetmap.org'>OSM</a>",
                maxZoom: 20
            });

            this._topo_tiles.drawTile = function(canvas, tilePoint, zoom) {
                map_obj._get_topo_tile(map_obj._topo_tiles, canvas, tilePoint, zoom, 0);
            };

            this._base_maps = {
                'Satellite': this._sat_tiles,
                'Topo':      this._topo_tiles
            };

            if (this._options.cluster) {
                this._destination_cluster_layer = this._create_destination_cluster_layer();
                this._cluster_labels            = new L.LayerGroup();
            }

            this._objects_layer       = new L.LayerGroup();
            this._user_location_layer = new L.LayerGroup();

            this._map_layers_control  = L.control.layers(this._base_maps, null, {collapsed: false});
        },

        _update_destination_data: function (data, auto_zoom) {
            this.amenities   = data.amenities;
            this.areas       = data.areas;
            this.paths       = data.paths;
            this.polygons    = data.polygons;
            this.routes      = data.routes;

            auto_zoom = (typeof auto_zoom === undefined) ? true : auto_zoom;

            if (this._first_location_fix === true) {
                if (this._options.area_id > 0) {
                    this.set_area(this._options.area_id);
                }

                if (this._options.route_id > 0) {
                    this.set_route(this._options.route_id);
                }
            }

            /* Set selected destination and clear out selected area and route. */
            this.selected_area          = {};
            this.selected_route         = {};
            this.selected_destination   = data;

            /* Zoom into destination location */
            var latlng = L.latLng(data.destination_lat, data.destination_lng);
            var zoom   = data.destination_zoom;

            /* Don't zoom if this is the first destination */
            if (this._first_load === true) {
                if ((this._options.route_id > 0) || (this._options.area_id > 0)) {
                    zoom = this._options.zoom;
                    latlng = L.latLng(this._options.lat, this._options.lng);
                }

                this._first_load = false;
            }

            if (auto_zoom) {
                this.set_view(latlng, zoom);
            }

            this.destination_info_loaded(data);
            this._draw_map_objects();
        },

        _update_destinations: function (new_destinations, map_obj) {
            this.destinations = new_destinations;

            /* Check to see if a destination name has been specified */
            if (this._options.destination_name > 2) {
                for (var i=0; i < this.destinations['features'].length; i++) {
                    var current_dest = this.destinations['features'][i];
                    var name = current_dest.properties.name.toLowerCase();

                    if (name == dest_name) {
                        show_destination_on_map(current_dest);
                        break;
                    }
                }
            }

            map_obj._draw_map_objects();
            map_obj.on_destinations_info_loaded();
        },

        _update_location: function (e, map_obj) {
            map_obj._gps_location = e.latlng;
            map_obj._draw_location_marker(map_obj);
        },

        _update_route_grades: function (response, map_obj) {
            if (response.result_code > 0) {
                map_obj._options.grade_aid       = response.info.grade_preferences.Aid;
                map_obj._options.grade_boulder   = response.info.grade_preferences.Boulder;
                map_obj._options.grade_mixed     = response.info.grade_preferences.Mixed;
                map_obj._options.grade_sport     = response.info.grade_preferences.Sport;
                map_obj._options.grade_top       = response.info.grade_preferences['Top Rope'];
                map_obj._options.grade_trad      = response.info.grade_preferences.Trad;

                map_obj.user_info_loaded();
            } else {
                TH.util.logging.log("Error getting route grading.");
            }
        }
    });

    TH.map = function (id, options) {
        /* Default options for the TopoHawk map  */
        options                   = options || {};
        options.area_id           = options.hasOwnProperty('area_id') ? options.area_id : -1;
        options.lat               = options.hasOwnProperty('lat')  ? options.lat : 0;
        options.lng               = options.hasOwnProperty('lng')  ? options.lng : 0;
        options.zoom              = options.hasOwnProperty('zoom') ? options.zoom : 2;
        options.cluster           = options.hasOwnProperty('cluster') ? options.cluster : true;
        options.destination       = options.hasOwnProperty('destination') ? options.destination : null;
        options.destination_name  = options.hasOwnProperty('destination_name') ? options.destination_name : '';
        options.load_destinations = options.hasOwnProperty('load_destinations') ? options.load_destinations : true;
        options.locked            = options.hasOwnProperty('locked') ? options.locked : false;
        options.mobile            = options.hasOwnProperty('mobile') ? options.mobile : false;
        options.offline           = options.hasOwnProperty('offline') ? options.offline : false;
        options.route_id          = options.hasOwnProperty('route_id') ? options.route_id : -1;
        options.show_description_popups = options.hasOwnProperty('show_description_popups') ? options.show_description_popups : false;
        options.show_location   = options.hasOwnProperty('show_location')   ? options.show_location : false;
        options.show_numberings = options.hasOwnProperty('show_numberings') ? options.show_numberings : false;
        options.grade_aid       = options.hasOwnProperty('grade_aid')       ? options.grade_aid     : 'USA-YDS';
        options.grade_boulder   = options.hasOwnProperty('grade_boulder')   ? options.grade_boulder : 'USA-VScale';
        options.grade_mixed     = options.hasOwnProperty('grade_mixed')     ? options.grade_mixed   : 'USA-YDS';
        options.grade_sport     = options.hasOwnProperty('grade_sport')     ? options.grade_sport   : 'USA-YDS';
        options.grade_top       = options.hasOwnProperty('grade_top')       ? options.grade_top     : 'USA-YDS';
        options.grade_trad      = options.hasOwnProperty('grade_trad')      ? options.grade_trad    : 'USA-YDS';

        var new_map = new TH.Map(id, options);

        if (options.hasOwnProperty('destination_id')) {
            new_map._get_destination_data(options.destination_id, null, true);
        }

        return new_map;
    };

    TH.control = {};

    TH.control.filter = L.Control.extend({
        options: {
            position: 'topright'
        },

        initialize: function (th_map) {
            this._th_map = th_map;
            this._button = {};
            this._expanded = false;
            this.setButton();
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'filter_control');

            this._map = map;
            this._container = container;
            this._update();
            return this._container;
        },

        onRemove: function (map) {},

        setButton: function () {
            var button = {
              'text':           '',
              'onClick':        this._clicked,
              'hideText':       'true',
              'maxWidth':       26
            };

            this._button = button;
            this._update();
        },

        destroy: function () {
            this._button = {};
            this._update();
        },

        _clicked: function (e) {
            if (this._expanded === false) {
                L.DomUtil.addClass(this._container, 'filter_control-expanded');
                this._filter_image.hidden = true;
                this._filter_div.hidden   = false;
            }

            this._expanded = !this._expanded;
            L.DomEvent.stopPropagation(e);

            if (this._th_map._options.mobile === true) {
                $(".leaflet-control-attribution").css('visibility','hidden');
            }

            return;
        },

        _close_filter: function () {
            L.DomUtil.removeClass(this._container, 'filter_control-expanded');
            this._filter_image.hidden = false;
            this._filter_div.hidden   = true;
            this._expanded            = false;

            if (this._th_map._options.mobile === true) {
                $(".leaflet-control-attribution").css('visibility','visible');
            }

            return;
        },

        _proccess_filter_checkboxes: function (e) {
            this._th_map.route_filter.route_types.Aid         = this._filter_chk_aid.checked;
            this._th_map.route_filter.route_types.Sport       = this._filter_chk_sport.checked;
            this._th_map.route_filter.route_types.Trad        = this._filter_chk_trad.checked;
            this._th_map.route_filter.route_types.Mixed       = this._filter_chk_mixed.checked;
            this._th_map.route_filter.route_types.Boulder     = this._filter_chk_boulder.checked;
            this._th_map.route_filter.route_types['Top Rope'] = this._filter_chk_toprope.checked;
            this._th_map.redraw_map();

            L.DomEvent.stopPropagation(e);
            return;
        },

        _proccess_rating_change: function () {
            this._th_map.route_filter.min_rating = parseInt(this._filter_select_rating.value);
            this._th_map.redraw_map();
        },

        _update: function () {
            if (!this._map) {
                return;
            }

            this._make_filter_control(this._button);
        },

        _update_filter_labels: function (th_map) {
            var sport_min = TH.util.grades.convert_common_to(th_map._options.grade_sport, th_map.route_filter.difficulty_min);
            var sport_max = TH.util.grades.convert_common_to(th_map._options.grade_sport, th_map.route_filter.difficulty_max);

            this._filter_div_min_sport.innerHTML   = sport_min;
            this._filter_div_max_sport.innerHTML   = sport_max;
            this._filter_div_min_boulder.innerHTML = TH.util.grades.convert_common_to(th_map._options.grade_boulder, th_map.route_filter.difficulty_min);
            this._filter_div_max_boulder.innerHTML = TH.util.grades.convert_common_to(th_map._options.grade_boulder, th_map.route_filter.difficulty_max);
        },

        _make_filter_control: function (button) {
            var newButton = L.DomUtil.create('div', 'leaflet-buttons-control-button', this._container);
            var image     = L.DomUtil.create('img', 'filter-image', newButton);

            var filter_div   = L.DomUtil.create('div', 'filter_div',         this._container);
            var filter_chks  = L.DomUtil.create('div', 'filter-checks-div',  filter_div);
            var filter_close = L.DomUtil.create('div', 'filter_popup_close', filter_div);

            var filter_div_boulder   = L.DomUtil.create('div',   'filter_check_div', filter_chks);
            var filter_chk_boulder   = L.DomUtil.create('input', 'filter_check', filter_div_boulder);
            var filter_span_boulder  = L.DomUtil.create('span',  'filter_check_span', filter_div_boulder);
            var filter_div_sport     = L.DomUtil.create('div',   'filter_check_div', filter_chks);
            var filter_chk_sport     = L.DomUtil.create('input', 'filter_check', filter_div_sport);
            var filter_span_sport    = L.DomUtil.create('span',  'filter_check_span', filter_div_sport);
            var filter_div_trad      = L.DomUtil.create('div',   'filter_check_div', filter_chks);
            var filter_chk_trad      = L.DomUtil.create('input', 'filter_check', filter_div_trad);
            var filter_span_trad     = L.DomUtil.create('span',  'filter_check_span', filter_div_trad);
            var filter_div_mixed     = L.DomUtil.create('div',   'filter_check_div', filter_chks);
            var filter_chk_mixed     = L.DomUtil.create('input', 'filter_check', filter_div_mixed);
            var filter_span_mixed    = L.DomUtil.create('span',  'filter_check_span', filter_div_mixed);
            var filter_div_toprope   = L.DomUtil.create('div',   'filter_check_div', filter_chks);
            var filter_chk_toprope   = L.DomUtil.create('input', 'filter_check', filter_div_toprope);
            var filter_span_toprope  = L.DomUtil.create('span',  'filter_check_span', filter_div_toprope);
            var filter_div_aid       = L.DomUtil.create('div',   'filter_check_div', filter_chks);
            var filter_chk_aid       = L.DomUtil.create('input', 'filter_check', filter_div_aid);
            var filter_span_aid      = L.DomUtil.create('span',  'filter_check_span', filter_div_aid);

            var filter_div_rating    = L.DomUtil.create('div',   'filter_rating_div',  filter_div);
            var filter_span_rating   = L.DomUtil.create('span',  'filter_rating_span', filter_div_rating);
            var filter_select_rating = L.DomUtil.create('select','filter_rating_dd',   filter_div_rating);
            var filter_select_opt0   = L.DomUtil.create('option','filter_rating_opt',  filter_select_rating);
            var filter_select_opt1   = L.DomUtil.create('option','filter_rating_opt',  filter_select_rating);
            var filter_select_opt2   = L.DomUtil.create('option','filter_rating_opt',  filter_select_rating);
            var filter_select_opt3   = L.DomUtil.create('option','filter_rating_opt',  filter_select_rating);
            var filter_select_opt4   = L.DomUtil.create('option','filter_rating_opt',  filter_select_rating);

            var filter_div_difficulty   = L.DomUtil.create('div','filter_difficulty_div', filter_div);
            var filter_div_min_sport    = L.DomUtil.create('div','filter_difficulty_min', filter_div_difficulty);
            var filter_div_max_sport    = L.DomUtil.create('div','filter_difficulty_max', filter_div_difficulty);
            var filter_div_min_boulder  = L.DomUtil.create('div','filter_difficulty_min', filter_div_difficulty);
            var filter_div_max_boulder  = L.DomUtil.create('div','filter_difficulty_max', filter_div_difficulty);
            var filter_div_slider       = L.DomUtil.create('div','filter_div_slider',     filter_div_difficulty);
            var filter_slide_difficulty = L.DomUtil.create('div','noUiSlider',            filter_div_slider);

            filter_close.innerHTML        = '✖';
            filter_span_boulder.innerHTML = 'Boulder Problems';
            filter_span_sport.innerHTML   = 'Sport Routes';
            filter_span_trad.innerHTML    = 'Trad Routes';
            filter_span_mixed.innerHTML   = 'Mixed Routes';
            filter_span_toprope.innerHTML = 'Top Rope Routes';
            filter_span_aid.innerHTML     = 'Aid Routes';
            filter_span_rating.innerHTML  = 'Minimum Rating<br />';

            filter_chk_boulder.type = 'checkbox';
            filter_chk_sport.type   = 'checkbox';
            filter_chk_trad.type    = 'checkbox';
            filter_chk_mixed.type   = 'checkbox';
            filter_chk_toprope.type = 'checkbox';
            filter_chk_aid.type     = 'checkbox';

            filter_chk_boulder.checked  = true;
            filter_chk_sport.checked    = true;
            filter_chk_trad.checked     = true;
            filter_chk_mixed.checked    = true;
            filter_chk_toprope.checked  = true;
            filter_chk_aid.checked      = true;

            filter_chk_boulder.value = 'Boulder';
            filter_chk_sport.value   = 'Sport';
            filter_chk_trad.value    = 'Trad';
            filter_chk_mixed.value   = 'Mixed';
            filter_chk_toprope.value = 'Top Rope';
            filter_chk_aid.value     = 'Aid';

            this._filter_select_rating = filter_select_rating;
            this._filter_chk_boulder   = filter_chk_boulder;
            this._filter_chk_sport     = filter_chk_sport;
            this._filter_chk_trad      = filter_chk_trad;
            this._filter_chk_mixed     = filter_chk_mixed;
            this._filter_chk_toprope   = filter_chk_toprope;
            this._filter_chk_aid       = filter_chk_aid;

            filter_select_opt0.value = 0;
            filter_select_opt1.value = 1;
            filter_select_opt2.value = 2;
            filter_select_opt3.value = 3;
            filter_select_opt4.value = 4;

            if (this._th_map._options.offline === true) {
                filter_select_opt0.title = ('images/rating-zero.svg');
                filter_select_opt1.title = ('images/rating-one.svg');
                filter_select_opt2.title = ('images/rating-two.svg');
                filter_select_opt3.title = ('images/rating-three.svg');
                filter_select_opt4.title = ('images/rating-four.svg');
                image.setAttribute('src','images/filter.svg');
            } else {
                filter_select_opt0.title = ('//topohawk.com/images/rating-zero.svg');
                filter_select_opt1.title = ('//topohawk.com/images/rating-one.svg');
                filter_select_opt2.title = ('//topohawk.com/images/rating-two.svg');
                filter_select_opt3.title = ('//topohawk.com/images/rating-three.svg');
                filter_select_opt4.title = ('//topohawk.com/images/rating-four.svg');
                image.setAttribute('src','//topohawk.com/images/filter.svg');
            }

            filter_div_min_sport.innerHTML   = '5.0';
            filter_div_max_sport.innerHTML   = '5.15d';
            filter_div_min_boulder.innerHTML = 'VB-';
            filter_div_max_boulder.innerHTML = 'V16';

            filter_div.hidden = true;

            this._filter_div   = filter_div;
            this._filter_image = image;
            this._filter_div_min_sport   = filter_div_min_sport;
            this._filter_div_max_sport   = filter_div_max_sport;
            this._filter_div_min_boulder = filter_div_min_boulder;
            this._filter_div_max_boulder = filter_div_max_boulder;

            L.DomEvent.addListener(newButton,            'click', L.DomEvent.stop);
            L.DomEvent.addListener(filter_close,         'click', this._close_filter, this);
            L.DomEvent.addListener(newButton,            'click', this._clicked,      this);
            L.DomEvent.addListener(filter_chk_boulder,   'click', this._proccess_filter_checkboxes, this);
            L.DomEvent.addListener(filter_chk_sport,     'click', this._proccess_filter_checkboxes, this);
            L.DomEvent.addListener(filter_chk_trad,      'click', this._proccess_filter_checkboxes, this);
            L.DomEvent.addListener(filter_chk_mixed,     'click', this._proccess_filter_checkboxes, this);
            L.DomEvent.addListener(filter_chk_toprope,   'click', this._proccess_filter_checkboxes, this);
            L.DomEvent.addListener(filter_chk_aid,       'click', this._proccess_filter_checkboxes, this);

            L.DomEvent.disableClickPropagation(newButton);

            return newButton;
        }
    });

    TH.util = {};
    TH.util.logging = {};
    TH.util.offline = {};
    TH.util.storage = {};

    TH.util.logging.log = function (message) {
        if (message !== 'undefined') {
            console.log(message);
        } else {
            console.log("Unknown Error");
        }
    };

    TH.util.offline.add_offline_destination = function (destination_obj, callback) {
        TH.util.storage.init(function(db_init) {
            /* Set offline status to downloading */
            localStorage.setItem("offline_destination_id" + destination_obj.destination_id, "downloading");

            /* Save Destination Data */
            TH.util.storage.add_destination(destination_obj, db_init);

            /* Download Photos */
            TH.util.storage.download_destination_photos(destination_obj.destination_id, db_init);

            /* Download Map Tiles */
            TH.util.storage.download_destination_tiles(destination_obj.destination_id, callback, db_init);
        });
    };

    TH.util.offline.remove_offline_destination = function (destination_id) {
        /* Remove destination */
        TH.util.storage.remove_destination(destination_id);

        /* Remove Map Tiles */
        TH.util.storage.remove_destination_tiles(destination_id);

        /* Remove Photos for this destination */
        TH.util.storage.remove_offline_photos(destination_id);

        /* Remove local store data */
        var local_store_item = "offline_destination_id" + destination_id;
        localStorage.removeItem(local_store_item);

        return true;
    };

    /* Storage Utils */
    TH.util.storage.add_change = function (change_type, change_json, db) {
        if (typeof db !== 'undefined') {
            if (db.db_type == "indexedDB") {
                var tx    = db.db.transaction("changes", "readwrite");
                var store = tx.objectStore("changes");

                store.put({
                    change_type: change_type,
                    change_json: JSON.stringify(change_json)
                });

                tx.oncomplete = function() {
                    TH.util.logging.log("Change saved.");
                };

                tx.onerror = function() {
                    TH.util.logging.log("Change could not be saved.");
                }
            } else if (db.db_type == "SQLite") {
                db.db.transaction(function(tx){
                    tx.executeSql("INSERT OR REPLACE into chnages values (NULL, ?, ?);",
                    [change_type, JSON.stringify(change_json)],
                    function(tx, response) {
                        TH.util.logging.log("Change saved.");
                    },
                    function(e) {
                        TH.util.logging.log("Change could not be saved.");
                    });
                });
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.add_change(change_type, change_json, db_init);
            });
        }
    }

    TH.util.storage.add_destination = function (destination_obj, db) {
        destination_obj['timestamp'] = Date.now();

        if (typeof db !== 'undefined') {
            if (db.db_type == "indexedDB") {
                var tx    = db.db.transaction("destinations", "readwrite");
                var store = tx.objectStore("destinations");

                /* Add download timestamp */
                destination_obj.timestamp = new Date().getTime();

                store.put({
                    destination_id: destination_obj.destination_id,
                    timestamp: Math.floor(Date.now() / 1000),
                    json: JSON.stringify(destination_obj)
                });

                var local_store_item = "offline_destination_id" + destination_obj.destination_id;

                tx.oncomplete = function() {
                    TH.util.logging.log("Destination info downloaded for desintation_id: " + destination_obj.destination_id);
                };

                tx.onerror = function() {
                    TH.util.logging.log("Destination info NOT downloaded for desintation_id: " + destination_obj.destination_id);
                };
            } else if (db.db_type == "SQLite") {
                db.db.transaction(function(tx){
                    tx.executeSql("INSERT OR REPLACE into destinations values (?, ?);",
                    [destination_obj.destination_id, JSON.stringify(destination_obj)],
                    function(tx, response) {
                        TH.util.logging.log("Destination info downloaded for desintation_id: " + destination_obj.destination_id);
                    },
                    function(e) {
                        TH.util.logging.log("Destination info NOT downloaded for desintation_id: " + destination_obj.destination_id);
                    });
                });
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.add_destination(destination_obj, db_init);
            });
        }
    };

    TH.util.storage.add_photo = function (photo_obj, db) {
        if (typeof db !== 'undefined') {
            var image_file = "t" + photo_obj.photo_file;

            $.ajax({
                type:     'GET',
                url:      'https://topohawk.com/api/v1/get_route_image_data_url.php',
                data:     { file_name: image_file },
                success:  function(response) {
                    if (db.db_type == "indexedDB") {
                        var tx = db.db.transaction("photos", "readwrite");
                        var store = tx.objectStore("photos");

                        photo_obj.photo_file = response;
                        store.put({photo_id: photo_obj.photo_id, destination_id: photo_obj.dest_id, json: JSON.stringify(photo_obj)});

                        tx.oncomplete = function() {
                            TH.util.logging.log("Photo downloaded: " + photo_obj.photo_id);
                        };
                    } else if (db.db_type == "SQLite") {
                        db.db.transaction(function(tx){
                            tx.executeSql("INSERT OR REPLACE into photos values (?, ?, ?, ?, ?);",
                                [photo_obj.photo_id, photo_obj.dest_id, photo_obj.area_id, photo_obj.route_id, JSON.stringify(photo_obj)],
                                function(tx, response) {
                                    TH.util.logging.log("Photo downloaded: " + photo_obj.photo_id);
                                },
                                function(e) {
                                    /* Error */
                                    TH.util.logging.log("Photo NOT downloaded: " + photo_obj.photo_id);
                                });
                        });
                    }
                },
                error: function (req, status, error) {
                   TH.util.logging.log("Error retrieving photo_ids.");
                }
            });
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.add_photo(photo_obj, db_init);
            });
        }
    };

    TH.util.storage.add_tile = function (x, y, z, destination_id, db, callback) {
        if (typeof db !== 'undefined') {
             $.ajax({
                url: "http://foldingmap.co/map/get_tile.php",
                type: 'POST',
                data: {
                    'x': x,
                    'y': y,
                    'z': z
                },
                success: function (data) {
                    if (db.db_type == "indexedDB") {
                        var tx = db.db.transaction("map_tiles", "readwrite");
                        var store = tx.objectStore("map_tiles");
                        var tile_key = x + "," + y + "," + z;

                        var result = store.put({
                            tile_id: tile_key,
                            tile: data,
                            x: x,
                            y: y,
                            z: z
                        });

                        result.onsuccess = function(ev) {
                            TH.util.logging.log("Stored tile: " + tile_key);

                            if (typeof callback !== 'undefined') {
                                callback();
                            }
                        };

                        result.onerror = function(ev) {
                            TH.util.logging.log("Failed to stored tile: " + tile_key + " - " + ev.srcElement.error.message);

                            if (typeof callback !== 'undefined') {
                                callback();
                            }
                        };
                    } else if (db.db_type == "SQLite") {
                        db.db.transaction(function(tx){
                            tx.executeSql("INSERT OR REPLACE into map_tiles values (?, ?, ?, ?, ?);",
                                [z, x, y, destination_id, data],
                                function(tx, response) {
                                    TH.util.logging.log("Tile: z: " + z + ", x: " + x + ", y: " + y + " downloaded");

                                    if (typeof callback !== 'undefined') {
                                        callback();
                                    }
                                },
                                function(e) {
                                    /* Error */
                                    TH.util.logging.log("Error retrieving map tile: " + x + ", " + y + ", " + z + " error.");
                                });
                        });
                    } else {
                        if (typeof callback !== 'undefined') {
                            callback();
                        }
                    }
                },
                error: function (req, status, error) {
                   TH.util.logging.log("Error retrieving map tile: " + x + ", " + y + ", " + z + " error: "+ error);
                }
            });
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.add_tile(x, y, z, destination_id, db_init, callback);
            });
        }
     };

    TH.util.storage.check_offline_statuses = function () {
        /* Checks to see if any downloads are stuck */
        for (var key in localStorage){
            if (key.substring(0, 22) == "offline_destination_id") {
                if (localStorage.getItem(key) == "downloading") {
                    localStorage.removeItem(key);
                }
            }
        }
    };

    TH.util.storage.get_all_changes = function (callback, db) {
        var changes = [];
        var current_change = {};

        if (typeof db !== 'undefined') {
            if (db.db_type == "indexedDB") {
                var transaction  = db.db.transaction("changes", "readonly");
                var store        = transaction.objectStore("changes");

                store.openCursor().onsuccess = function(event) {
                    var cursor = event.target.result;

                    if (cursor) {
                        current_change = {
                            change_type: cursor.value.change_type,
                            change_json: JSON.parse(cursor.value.change_json)
                        };

                        changes.push(current_change);
                        cursor.continue();
                    } else {
                        callback(changes);
                    }
                };
            } else if (db.db_type == "SQLite") {
                db.db.transaction(function(tx) {
                    tx.executeSql("SELECT * FROM changes;",
                    [],
                    function(tx, response) {
                        for (var i=0; i < response.rows.length; i++) {
                            current_change = {
                                change_type: response.rows.item(i).change_type,
                                change_json: JSON.parse(response.rows.item(i).change_json)
                            };

                            changes.push(current_change);
                        }

                        callback(changes);
                    },
                    function(e) {
                        callback(changes);
                    });
                });
            } else {
                callback(changes);
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.get_all_changes(callback, db_init);
            });
        }
    }

    TH.util.storage.get_all_destinations = function (callback, db) {
        var destinations = [];

        if (typeof db !== 'undefined') {
            if (db.db_type == "indexedDB") {
                var transaction  = db.db.transaction("destinations", "readonly");
                var store        = transaction.objectStore("destinations");

                store.openCursor().onsuccess = function(event) {
                    var cursor = event.target.result;

                    if (cursor) {
                        destinations.push(JSON.parse(cursor.value.json));
                        cursor.continue();
                    } else {
                        callback(destinations);
                    }
                };
            } else if (db.db_type == "SQLite") {
                db.db.transaction(function(tx) {
                    tx.executeSql("SELECT * FROM destinations;",
                    [],
                    function(tx, response) {
                        for (var i=0; i < response.rows.length; i++) {
                            destinations.push(JSON.parse(response.rows.item(i).destination_json));
                        }

                        callback(destinations);
                    },
                    function(e) {
                        callback(destinations);
                    });
                });
            } else {
                callback(destinations);
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.get_all_destinations(callback, db_init);
            });
        }
     };

     TH.util.storage.get_destination = function (destination_id, callback, db) {
        if (typeof db !== 'undefined') {
            if (db.db_type == "indexedDB") {
                var transaction = db.db.transaction("destinations", "readwrite");
                var store       = transaction.objectStore("destinations");
                var index       = store.index("by_destination_id");
                var request     = index.openCursor(IDBKeyRange.only(destination_id.toString()));

                request.onsuccess = function() {
                    var cursor = request.result;

                    if (cursor) {
                        callback(JSON.parse(cursor.value.json));
                    }
                };
            } else {
                callback(null);
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.get_destination(destination_id, callback, db_init);
            });
        }
     };

     TH.util.storage.get_destination_status = function (destination_id) {
        var local_store_item = "offline_destination_id" + destination_id;
        var local_val = localStorage.getItem(local_store_item);

        if (local_val !== null && local_val !== 'undefined') {
            return local_val;
        } else {
            return "none";
        }
     };

     TH.util.storage.remove_destination = function (destination_id, db) {
        if (typeof db !== 'undefined') {
            if (db.db_type == "indexedDB") {
                var transaction = db.db.transaction("destinations", "readwrite");
                var store       = transaction.objectStore("destinations");
                var index       = store.index("by_destination_id");
                var request     = index.openCursor(IDBKeyRange.only(destination_id));

                request.onsuccess = function() {
                    var cursor = request.result;

                    if (cursor) {
                        cursor.delete();
                        cursor.continue();

                        var local_store_item = "offline_destination_id" + destination_id;
                        localStorage.removeItem(local_store_item);

                        TH.util.logging.log("Destination data deleted: " + cursor.value.destination_id);
                    }
                };
            } else if (db.db_type == "SQLite") {
                db.db.transaction(function(tx) {
                    tx.executeSql("DELETE FROM destinations WHERE destination_id =?;",
                    [destination_id],
                    function(tx, response) {
                        if (response.rowsAffected > 0) {
                            TH.util.logging.log("Destination data deleted: " + destination_id);
                        } else {
                            TH.util.logging.log("Destination data NOT deleted: " + destination_id);
                        }
                    },
                    function(e) {
                        TH.util.logging.log("Destination data NOT deleted: " + destination_id);
                    });
                });
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.remove_destination(destination_id, db_init);
            });
        }
     };

     TH.util.storage.remove_changes = function (db) {
         if (typeof db !== 'undefined') {
             if (db.db_type == "indexedDB") {
                 var transaction = db.db.transaction("changes", "readwrite");
                 var store       = transaction.objectStore("changes");

                 transaction.oncomplete = function(event) {
                     TH.util.logging.log("Pending local symc items removed.");
                 };

                 transaction.onerror = function(event) {
                   TH.util.logging.log("Error removing local sync items.");
                 };

                 store.clear();
             } else if (db.db_type == "SQLite") {
                 db.db.transaction(function(tx) {
                     tx.executeSql("DELETE FROM changes;",
                     [],
                     function(tx, response) {
                         if (response.rowsAffected > 0) {
                             TH.util.logging.log("Pending local sync items removed.");
                         } else {
                             TH.util.logging.log("No local pending sync items.");
                         }
                     },
                     function(e) {
                         TH.util.logging.log("Error removing pending local sync items.");
                     });
                 });
             }
         } else {
             /* DB is not given, get it */
             TH.util.storage.init(function(db_init) {
                 TH.util.storage.remove_changes(db_init);
             });
         }
     }

     TH.util.storage.remove_destination_tiles = function (destination_id, db) {
        if (typeof db !== 'undefined') {
            /* Remove the tiles */
            if (db.db_type == "indexedDB") {
                TH.util.storage.get_destination_tiles(destination_id, function(data) {
                    for (var i=0; i<(data.result.length - 1); i++) {
                        if (parseInt(data.result[i][2]) > 12) {
                            /* If zoom level is greater than 12 then remove it */
                            var transaction = db.db.transaction("map_tiles", "readwrite");
                            var store       = transaction.objectStore("map_tiles");
                            var index       = store.index("by_tile_id");
                            var tile_key    = data.result[i][0].toString() + "," + data.result[i][1].toString() + "," + data.result[i][2].toString();
                            var request     = index.openCursor(IDBKeyRange.only(tile_key));

                            request.onsuccess = function() {
                                var cursor = this.result;

                                if (cursor) {
                                    TH.util.logging.log("Tile deleted: " + cursor.value.tile_key);
                                    cursor.delete();
                                    cursor.continue();
                                }
                            };
                        }
                    }
                });
            } else if (db.db_type == "SQLite") {
                db.db.transaction(function(tx) {
                    tx.executeSql("DELETE FROM map_tiles WHERE destination_id =?;",
                    [destination_id],
                    function(tx, response) {
                        if (response.rowsAffected > 0) {
                            TH.util.logging.log("Destination tiles deleted: " + destination_id);
                        } else {
                            TH.util.logging.log("Destination tiles NOT deleted: " + destination_id);
                        }
                    },
                    function(e) {
                        TH.util.logging.log("Destination tiles NOT deleted: " + destination_id);
                    });
                });
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.remove_destination_tiles(destination_id, db_init);
            });
        }
     };

     TH.util.storage.remove_offline_photos = function (destination_id, db) {
         if (typeof db !== 'undefined') {
             if (db.db_type == "indexedDB") {
                var transaction = db.db.transaction("photos", "readwrite");
                var store       = transaction.objectStore("photos");
                var index       = store.index("by_destination_id");
                var request     = index.openCursor(IDBKeyRange.only(destination_id.toString()));

                request.onsuccess = function() {
                    var cursor = request.result;

                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                        TH.util.logging.log("Photo deleted: " + cursor.value.photo_id);
                    }
                };
            } else if (db.db_type == "SQLite") {
                db.db.transaction(function(tx) {
                    tx.executeSql("DELETE FROM photos WHERE destination_id =?;",
                    [destination_id],
                    function(tx, response) {
                        if (response.rowsAffected > 0) {
                            TH.util.logging.log("Destination photos deleted: " + destination_id);
                        } else {
                            TH.util.logging.log("Destination photos NOT deleted: " + destination_id);
                        }
                    },
                    function(e) {
                        TH.util.logging.log("Destination photos NOT deleted: " + destination_id);
                    });
                });
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.remove_offline_photos(destination_id, db_init);
            });
        }
    };

     TH.util.storage.download_destination_photos = function (destination_id, db) {
        if (typeof db !== 'undefined') {
            $.ajax({
               type:     'POST',
               url:      'https://topohawk.com/api/v1/get_photos.php',
               dataType: 'json',
               data:     { destination_id: destination_id },
               success:  function(response) {
                    if (response.result_code > 0) {
                        for (var i=0; i<response.photo_ids.length; i++) {
                            TH.util.get_photo_info(response.photo_ids[i], function (photo_obj) {
                                TH.util.storage.add_photo(photo_obj, db);
                            });
                        }
                    } else {
                        TH.util.logging.log("Error " + response.result);
                    }
               },
               error: function (req, status, error) {
                   TH.util.logging.log("Error retrieving photo_ids.");
               }
            });
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.download_destination_photos(destination_id, db_init);
            });
        }
    };

    TH.util.storage.download_destination_tiles = function (destination_id, callback, db) {
        if (typeof db !== 'undefined') {
            TH.util.storage.get_destination_tiles(destination_id, function(data) {
                for (var i=0; i<(data.result.length - 1); i++) {
                    TH.util.storage.add_tile(data.result[i][0], data.result[i][1], data.result[i][2], destination_id, db);
                }

                /* Special case for last tile so we can know if this operation is complete */
                var i = (data.result.length - 1);
                TH.util.storage.add_tile(data.result[i][0], data.result[i][1], data.result[i][2], destination_id, db, callback);
            });
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.download_destination_tiles(destination_id, callback, db_init);
            });
        }
    };

    TH.util.storage.get_destination_tiles = function (destination_id, callback) {
         $.ajax({
            url:        'https://topohawk.com/api/v1/get_destination_tiles.php',
            dataType:   'json',
            type:       'GET',
            data: {
                destination_id: destination_id
            },
            success: function (data) {
                if (data.result_code > 0) {
                    callback(data);
                } else {
                    TH.util.logging.log("Error: " + data.result);
                }
            },
            error: function (req, status, error) {
               TH.util.logging.log("Error: " + error);
            }
        });
    };

    TH.util.storage.get_photo = function (photo_id, callback, db) {
        if (typeof db !== 'undefined') {
            if (db.db_type == "indexedDB") {
                var transaction = db.db.transaction("photos", "readonly");
                var store       = transaction.objectStore("photos");
                var index       = store.index("by_photo_id");
                var request     = index.get(photo_id);

                request.onsuccess = function() {
                    var matching = request.result;

                    if (typeof(matching) !== 'undefined' && matching !== null) {
                        var photo_obj = JSON.parse(matching.json);
                        callback(photo_id, photo_obj);
                    } else {
                        TH.util.logging.log("Photo_id not in local db. " + photo_id);
                        callback(photo_id, null);
                    }
                };

                request.onerror = function() {
                    TH.util.logging.log("Error getting photo_id from local db. " + photo_id);
                };
            } else if (db.db_type == "SQLite") {
                db.db.transaction(function(tx) {
                    tx.executeSql("SELECT * FROM photos WHERE photo_id =?",
                    [photo_id],
                    function(tx, response) {
                        if (response.rows.length > 0) {
                            callback(photo_id, JSON.parse(response.rows.item(0).photo_json));
                        } else {
                            callback(photo_id, null);
                        }
                    },
                    function(e) {
                        callback(photo_id, null);
                    });
                });
            } else {
                callback(photo_id, null);
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.get_photo(photo_id, callback, db_init);
            });
        }
    };

    TH.util.storage.get_photo_by_area = function (area_id, callback, db) {
        var photo_array = [];

        if (typeof db !== 'undefined') {
            if (db.db_type == "SQLite") {
                db.db.transaction(function(tx) {
                    tx.executeSql("SELECT * FROM photos WHERE area_id =?",
                    [area_id],
                    function(tx, response) {
                        if (response.rows.length > 0) {
                            for (var i=0; i<response.rows.length; i++) {
                                photo_array.push(response.rows.item(i).photo_id);
                            }
                        }

                        callback(photo_array);
                    },
                    function(e) {
                        callback(photo_array);
                    });
                });
            } else {
                callback(photo_array);
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.get_photo_by_area(area_id, callback, db_init);
            });
        }
    }

    TH.util.storage.get_photo_by_destination = function (destination_id, callback, db) {
        var photo_array = [];

        if (typeof db !== 'undefined') {
            if (db.db_type == "SQLite") {
                db.db.transaction(function(tx) {
                    tx.executeSql("SELECT * FROM photos WHERE destination_id =?",
                    [destination_id],
                    function(tx, response) {
                        if (response.rows.length > 0) {
                            for (var i=0; i<response.rows.length; i++) {
                                photo_array.push(response.rows.item(i).photo_id);
                            }
                        }

                        callback(photo_array);
                    },
                    function(e) {
                        callback(photo_array);
                    });
                });
            } else {
                callback(photo_array);
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.get_photo_by_destination(destination_id, callback, db_init);
            });
        }
    }

    TH.util.storage.get_photo_by_route = function (route_id, callback, db) {
        var photo_array = [];

        if (typeof db !== 'undefined') {
            if (db.db_type == "SQLite") {
                db.db.transaction(function(tx) {
                    tx.executeSql("SELECT * FROM photos WHERE route_id =?",
                    [route_id],
                    function(tx, response) {
                        if (response.rows.length > 0) {
                            for (var i=0; i<response.rows.length; i++) {
                                photo_array.push(response.rows.item(i).photo_id);
                            }
                        }

                        callback(photo_array);
                    },
                    function(e) {
                        callback(photo_array);
                    });
                });
            } else {
                callback(photo_array);
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.get_photo_by_route(route_id, callback, db_init);
            });
        }
    }

    TH.util.storage.get_tile = function (x, y, z, callback, db) {
        if (typeof db !== 'undefined') {
            if (db.db_type == "indexedDB") {
                var transaction = db.db.transaction("map_tiles", "readonly");
                var store       = transaction.objectStore("map_tiles");
                var index       = store.index("by_tile_id");
                var tile_key    = x + "," + y + "," + z;
                var request     = index.get(tile_key);

                request.onsuccess = function() {
                    var matching = request.result

                    if (typeof(matching) !== 'undefined' && matching !== null) {
                        var map_tile = matching.tile;
                        callback(map_tile);
                    } else {
                        //TH.util.logging.log("Tile not in local db. " + tile_key);
                        callback(null);
                    }
                };

                request.onerror = function() {
                    TH.util.logging.log("Error getting map tile from local db. " + tile_key);
                };
            } else if (db.db_type == "SQLite") {
                db.db.transaction(function(tx) {
                    tx.executeSql("SELECT * FROM map_tiles WHERE zoom_level =? AND tile_column =? AND tile_row =?",
                    [z, x, y],
                    function(tx, response) {
                        if (response.rows.length > 0) {
                            var data_url = response.rows.item(0).data_url;
                            callback(data_url);
                        } else {
                            callback(null);
                        }
                    },
                    function(e) {
                        callback(null);
                    });
                });
            } else {
                callback(null);
            }
        } else {
            /* DB is not given, get it */
            TH.util.storage.init(function(db_init) {
                TH.util.storage.get_tile(x, y, z, callback, db_init);
            });
        }
    };

    TH.util.storage.delete_indexedDB = function (callback) {
        var req = indexedDB.deleteDatabase("TopoHawk-Cache");

        req.onsuccess = function () {
            TH.util.logging.log("Deleted database successfully");

            if (typeof db !== 'undefined') {
                callback();
            }
        };

        req.onerror = function () {
            TH.util.logging.log("Couldn't delete database");
        };

        req.onblocked = function () {
            TH.util.logging.log("Couldn't delete database due to the operation being blocked");
        };
    };

    TH.util.storage.init = function (callback) {
        if (window.openDatabase) {
            var db_obj = {
                db_type: "SQLite",
                db:      openDatabase("TopoHawk-Cache", "1.0", "TopoHawk Local Cache", 10485760)
            }

            /* Create Tiles Table */
            db_obj.db.transaction(function(tx) {
               tx.executeSql("CREATE TABLE IF NOT EXISTS map_tiles (zoom_level integer, tile_column integer, tile_row integer, destination_id, data_url text);", []);
               tx.executeSql("CREATE UNIQUE INDEX IF NOT EXISTS map_index ON map_tiles (zoom_level, tile_column, tile_row);");
            });

            db_obj.db.transaction(function(tx) {
               tx.executeSql("CREATE TABLE IF NOT EXISTS photos (photo_id integer, destination_id integer, area_id integer, route_id integer, photo_json text);", []);
               tx.executeSql("CREATE UNIQUE INDEX IF NOT EXISTS photo_id_index ON photos (photo_id);");
            });

            db_obj.db.transaction(function(tx) {
               tx.executeSql("CREATE TABLE IF NOT EXISTS destinations (destination_id integer, destination_json text);", []);
               tx.executeSql("CREATE UNIQUE INDEX IF NOT EXISTS destination_id_index ON destinations (destination_id);");
            });

            db_obj.db.transaction(function(tx) {
               tx.executeSql("CREATE TABLE IF NOT EXISTS changes (change_id INTEGER PRIMARY KEY, change_type text, change_json text);", []);
            });

            callback(db_obj);
        } else if (window.indexedDB || window.webkitIndexedDB || window.msIndexedDB) {
            var indexedDB = window.indexedDB || window.webkitIndexedDB || window.msIndexedDB;
            var request = indexedDB.open("TopoHawk-Cache", 11);

            request.onupgradeneeded = function(event) {
                var db_obj = {
                    db_type: "indexedDB",
                    db:      event.target.result
                }

                var changes_db_created  = false;
                var dest_db_created     = false;
                var photo_db_created    = false;
                var tiles_db_created    = false;
                var callback_made       = false;

                if (!db_obj.db.objectStoreNames.contains("destinations")) {
                    // Create destination db
                    var destination_store = db_obj.db.createObjectStore("destinations", {keyPath: "destination_id"});
                    var destination_id_index = destination_store.createIndex("by_destination_id", "destination_id", {unique: true});

                    destination_store.transaction.oncomplete = function(event) {
                        dest_db_created = true;

                        if (dest_db_created && photo_db_created && tiles_db_created && changes_db_created && callback_made === false) {
                            callback_made = true;
                            callback(db_obj);
                        }
                    };
                } else {
                    dest_db_created = true;
                }

                // Create photo db
                if (!db_obj.db.objectStoreNames.contains("photos")) {
                    var photo_store = db_obj.db.createObjectStore("photos", {keyPath: "photo_id"});
                    var photo_id_index = photo_store.createIndex("by_photo_id",        "photo_id", {unique: true});
                    var dest_id_index  = photo_store.createIndex("by_destination_id",  "destination_id");

                    photo_store.transaction.oncomplete = function(event) {
                        photo_db_created = true;

                        if (dest_db_created && photo_db_created && tiles_db_created && changes_db_created && callback_made === false) {
                            callback_made = true;
                            callback(db_obj);
                        }
                    };
                } else {
                    photo_db_created = true;
                }

                if (!db_obj.db.objectStoreNames.contains("map_tiles")) {
                    // Create Map Tiles db
                    var tiles_store = db_obj.db.createObjectStore("map_tiles", {keyPath: "tile_id"});
                    var tile_id_index = tiles_store.createIndex("by_tile_id", "tile_id", {unique: true});

                    tiles_store.transaction.oncomplete = function(event) {
                        tiles_db_created = true;

                        if (dest_db_created && photo_db_created && tiles_db_created && changes_db_created && callback_made === false) {
                            callback_made = true;
                            callback(db_obj);
                        }
                    };
                } else {
                    tiles_db_created = true;
                }

                /* Create Changes DB */
                if (!db_obj.db.objectStoreNames.contains("changes")) {
                    var changes_store = db_obj.db.createObjectStore("changes", {autoIncrement : true});

                    tiles_store.transaction.oncomplete = function(event) {
                        changes_db_created = true;

                        if (dest_db_created && photo_db_created && tiles_db_created && changes_db_created && callback_made === false) {
                            callback_made = true;
                            callback(db_obj);
                        }
                    };
                }

                if (dest_db_created && photo_db_created && tiles_db_created && changes_db_created && callback_made === false) {
                    callback_made = true;
                    callback(db_obj);
                }
            };

            request.onsuccess = function(event) {
                var db_obj = {
                    db_type: "indexedDB",
                    db:      event.target.result
                }

                callback(db_obj);
            };

            request.onerror = function(event) {
                TH.util.logging.log("error: " + event.target.errorCode);
            };
        }
    };

    /* Other Utils */

    TH.util.convert_lat_lngs_to_string = function (latLngs) {
        var returnString = " ";

        for (var i = 0; i < latLngs.length; i++) {
            var lat = latLngs[i].lat.toString();
            var lng = latLngs[i].lng.toString();

            returnString += (lng + "," + lat + ",");
        }

        return returnString;
    };

    TH.util.fix_strings = function (s) {
        var fixed = s;

        fixed = fixed.replace("&#039;" ,"’");
        fixed = fixed.replace("&#8217;","’");

        return fixed;
    };

    TH.util.get_photo_info = function (photo_id, callback) {
        $.ajax({
           type:        'GET',
           dataType:    'json',
           url:         'https://topohawk.com/api/v1.1/get_photo_info.php',
           data: {
               'photo_id': photo_id
           },
           success: function(response) {
                if (response.result_code > 0) {
                    callback(response.result);
                } else {
                    TH.util.logging.log("Error getting photo info: " + response.result);
                }
            },
            error: function (req, status, error) {
                TH.util.logging.log("Error getting photo info: " + error);
            }
        });
    };

    TH.util.get_star_html = function (rating, small, offline) {
        var star_html = '<div>';

        if (typeof offline === 'undefined') {
            if (small == true) {
                var star_empty = '/images/star-empty-small.svg';
                var star_half  = '/images/star-half-small.svg';
                var star_full  = '/images/star-full-small.svg'
            } else {
                var star_empty = '/images/star-empty.svg';
                var star_half  = '/images/star-half.svg';
                var star_full  = '/images/star-full.svg'
            }
        } else {
             if (small == true) {
                var star_empty = 'images/star-empty-small.svg';
                var star_half  = 'images/star-half-small.svg';
                var star_full  = 'images/star-full-small.svg'
            } else {
                var star_empty = 'images/star-empty.svg';
                var star_half  = 'images/star-half.svg';
                var star_full  = 'images/star-full.svg'
            }
        }

        if (rating < 0.5) {
            star_html = star_html + "<img src='" + star_empty + "' id='star1' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star2' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star3' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star4' class='star'/>";
        } else if (rating < 1) {
            star_html = star_html + "<img src='" + star_half  + "' id='star1' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star2' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star3' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star4' class='star'/>";
        } else if (rating < 1.5) {
            star_html = star_html + "<img src='" + star_full  + "' id='star1' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star2' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star3' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star4' class='star'/>";
        } else if (rating < 2) {
            star_html = star_html + "<img src='" + star_full  + "' id='star1' class='star'/>";
            star_html = star_html + "<img src='" + star_half  + "' id='star2' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star3' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star4' class='star'/>";
        } else if (rating < 2.5) {
            star_html = star_html + "<img src='" + star_full  + "' id='star1' class='star'/>";
            star_html = star_html + "<img src='" + star_full  + "' id='star2' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star3' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star4' class='star'/>";
        } else if (rating < 3) {
            star_html = star_html + "<img src='" + star_full  + "' id='star1' class='star'/>";
            star_html = star_html + "<img src='" + star_full  + "' id='star2' class='star'/>";
            star_html = star_html + "<img src='" + star_half  + "' id='star3' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star4' class='star'/>";
        } else if (rating < 3.5) {
            star_html = star_html + "<img src='" + star_full  + "' id='star1' class='star'/>";
            star_html = star_html + "<img src='" + star_full  + "' id='star2' class='star'/>";
            star_html = star_html + "<img src='" + star_full  + "' id='star3' class='star'/>";
            star_html = star_html + "<img src='" + star_empty + "' id='star4' class='star'/>";
        } else if (rating < 4) {
            star_html = star_html + "<img src='" + star_full  + "' id='star1' class='star'/>";
            star_html = star_html + "<img src='" + star_full  + "' id='star2' class='star'/>";
            star_html = star_html + "<img src='" + star_full  + "' id='star3' class='star'/>";
            star_html = star_html + "<img src='" + star_half  + "' id='star4' class='star'/>";
        } else if (rating > 3.8) {
            star_html = star_html + "<img src='" + star_full  + "' id='star1' class='star'/>";
            star_html = star_html + "<img src='" + star_full  + "' id='star2' class='star'/>";
            star_html = star_html + "<img src='" + star_full  + "' id='star3' class='star'/>";
            star_html = star_html + "<img src='" + star_full  + "' id='star4' class='star'/>";
        }

        star_html = star_html + '</div>';

        return star_html;
    };

    TH.util.grades = {
        systems : ['Aid-A','Ewbanks', 'Finnish', 'Fontainebleau', 'French', 'UIAA', 'USA-VScale', 'USA-YDS', 'ZA-New'],

         'common_aid_a': [
            'A0',
            'A0',
            'A0',
            'A0+',
            'A0+',
            'A0+',
            'A1',
            'A1',
            'A1+',
            'A1+',
            'A2',
            'A2',
            'A2',
            'A2+',
            'A2+',
            'A2+',
            'A2+',
            'A3',
            'A3',
            'A3',
            'A3',
            'A3+',
            'A3+',
            'A3+',
            'A3+',
            'A4',
            'A4',
            'A4',
            'A4',
            'A4+',
            'A4+',
            'A4+',
            'A4+',
            'A5',
            'A5',
            'A5+',
            'A5+',
            'A6',
            'A6',
            'A6',
            'A6',
        ],

        'common_finnish': [
            '1-',
            '1-',
            '1',
            '1+',
            '2-',
            '2',
            '2+',
            '3-',
            '3',
            '3+',
            '4-',
            '4',
            '4+',
            '5-',
            '5',
            '5',
            '5+',
            '6-',
            '6',
            '6+',
            '7-',
            '7',
            '7+',
            '8-',
            '8',
            '8+',
            '9-',
            '9-',
            '9',
            '9+',
            '10-',
            '10',
            '10',
            '10+',
            '11-',
            '11',
            '11',
            '11+',
            '12-',
            '12',
            '12+'
        ],

        'common_fontainebleau': [
            '1',
            '1',
            '1',
            '1',
            '1',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '3',
            '3',
            '3',
            '3',
            '3',
            '4',
            '4',
            '4+',
            '4+',
            '5',
            '5+',
            '6a',
            '6a+',
            '6b',
            '6b+',
            '6c',
            '6c+',
            '7a',
            '7a+',
            '7b',
            '7b+',
            '7b+',
            '7c',
            '7c+',
            '8a',
            '8a+',
            '8b',
            '8b+',
            '8c',
            '8c+',
        ],

        'common_french': [
            '1a',
            '1a',
            '1b',
            '1b+',
            '1c+',
            '2a+',
            '2b',
            '2b+',
            '2c+',
            '3a',
            '3b',
            '3b+',
            '3c+',
            '4a+',
            '4b+',
            '4c+',
            '5a+',
            '5b+',
            '5c+',
            '6a+',
            '6b',
            '6b+',
            '6c',
            '6c+',
            '7a',
            '7a+',
            '7b',
            '7b+',
            '7c',
            '7c+',
            '8a',
            '8a+',
            '8b',
            '8b+',
            '8c',
            '8c+',
            '9a',
            '9a+',
            '9b',
            '9b+',
            '9c'
        ],

        'common_uiaa': [
            'I',
            'I',
            'I',
            'II',
            'II',
            'III',
            'IV',
            'V-',
            'V',
            'V+',
            'V+',
            'VI-',
            'VI-',
            'VI-',
            'VI',
            'VI',
            'VI+',
            'VII-',
            'VII',
            'VII+',
            'VII+',
            'VIII-',
            'VIII-',
            'VIII',
            'VIII+',
            'IX-',
            'IX-',
            'IX',
            'IX+',
            'X-',
            'X-',
            'X',
            'X+',
            'X+',
            'XI-',
            'XI',
            'XI+',
            'XII-',
            'XII',
            'XII+',
        ],

        'common_v': [
            'VB-',
            'VB-',
            'VB-',
            'VB-',
            'VB-',
            'VB',
            'VB',
            'VB',
            'VB',
            'VB',
            'VB+',
            'VB+',
            'VB+',
            'VB+',
            'V0-',
            'V0-',
            'V0',
            'V0',
            'V0+',
            'V0+',
            'V1',
            'V1+',
            'V2',
            'V3',
            'V3+',
            'V4',
            'V5',
            'V6',
            'V6',
            'V7',
            'V8',
            'V9',
            'V9',
            'V10',
            'V10',
            'V11',
            'V12',
            'V13',
            'V14',
            'V15',
            'V16'
        ],

        'common_yds': [
            '5.0',
            '5.0',
            '5.0',
            '5.0',
            '5.1',
            '5.2',
            '5.3',
            '5.4',
            '5.5',
            '5.6',
            '5.7',
            '5.8-',
            '5.8',
            '5.8+',
            '5.9-',
            '5.9',
            '5.9+',
            '5.10a',
            '5.10b',
            '5.10c',
            '5.10d',
            '5.11a',
            '5.11b',
            '5.11c',
            '5.11d',
            '5.12a',
            '5.12b',
            '5.12c',
            '5.12d',
            '5.13a',
            '5.13b',
            '5.13c',
            '5.13d',
            '5.14a',
            '5.14b',
            '5.14c',
            '5.14d',
            '5.15a',
            '5.15b',
            '5.15c',
            '5.15d',
        ],

        'common_yds_protection': [
            'X',
            'X',
            'X',
            'R',
            'R',
            'PG-13',
            'PG-13',
            'PG',
            'PG',
            'G'
        ],

        'aid_a_common': {
            'A0'    :  2,
            'A0+'   :  6,
            'A1'    :  8,
            'A1+'   : 10,
            'A2'    : 13,
            'A2+'   : 16,
            'A3'    : 21,
            'A3+'   : 25,
            'A4'    : 29,
            'A4+'   : 33,
            'A5'    : 35,
            'A5+'   : 37,
            'A6'    : 39,
            'count' : 12,
            key: function (n) {
                return this[Object.keys(this)[n]];
            }
        },

        'finnish_common': {
            '1-'    : 1,
            '1'     : 2,
            '1+'    : 3,
            '2-'    : 4,
            '2'     : 5,
            '2+'    : 6,
            '3-'    : 7,
            '3'     : 8,
            '3+'    : 9,
            '4-'    : 10,
            '4'     : 11,
            '4+'    : 12,
            '5-'    : 13,
            '5'     : 14,
            '5+'    : 16,
            '6-'    : 17,
            '6'     : 18,
            '6+'    : 19,
            '7-'    : 20,
            '7'     : 21,
            '7+'    : 22,
            '8-'    : 23,
            '8'     : 24,
            '8+'    : 25,
            '9-'    : 26,
            '9'     : 28,
            '9+'    : 29,
            '10-'   : 30,
            '10'    : 31,
            '10+'   : 33,
            '11-'   : 34,
            '11'    : 35,
            '11+'   : 37,
            '12-'   : 38,
            '12'    : 39,
            '12+'   : 40,
            'count' : 35,
            key: function (n) {
                return this[Object.keys(this)[n]];
            }
        },

        'fontainebleau_common': {
            '1'     :  2,
            '2'     :  6,
            '3'     : 15,
            '4'     : 17,
            '4+'    : 19,
            '5'     : 20,
            '5+'    : 21,
            '6a'    : 22,
            '6a+'   : 23,
            '6b'    : 24,
            '6b+'   : 25,
            '6c'    : 26,
            '6c+'   : 27,
            '7a'    : 28,
            '7a+'   : 29,
            '7b'    : 30,
            '7b+'   : 31,
            '7c'    : 33,
            '7c+'   : 34,
            '8a'    : 35,
            '8a+'   : 36,
            '8b'    : 37,
            '8b+'   : 38,
            '8c'    : 39,
            '8c+'   : 40,
            'count' : 24,
            key: function (n) {
                return this[Object.keys(this)[n]];
            }
        },

        'french_common': {
            '1a'    :  1,
            '1a+'   :  1,
            '1b'    :  2,
            '1b+'   :  3,
            '1c'    :  4,
            '1c+'   :  4,
            '2a'    :  5,
            '2a+'   :  5,
            '2b'    :  6,
            '2b+'   :  7,
            '2c'    :  8,
            '2c+'   :  8,
            '3a'    :  9,
            '3a+'   : 10,
            '3b'    : 10,
            '3b+'   : 11,
            '3c'    : 12,
            '3c+'   : 12,
            '4a'    : 13,
            '4a+'   : 13,
            '4b'    : 14,
            '4b+'   : 14,
            '4c'    : 15,
            '4c+'   : 15,
            '5a'    : 16,
            '5a+'   : 16,
            '5b'    : 16,
            '5b+'   : 17,
            '5c'    : 17,
            '5c+'   : 18,
            '6a'    : 18,
            '6a+'   : 19,
            '6b'    : 20,
            '6b+'   : 21,
            '6c'    : 22,
            '6c+'   : 23,
            '7a'    : 24,
            '7a+'   : 25,
            '7b'    : 26,
            '7b+'   : 27,
            '7c'    : 28,
            '7c+'   : 29,
            '8a'    : 30,
            '8a+'   : 31,
            '8b'    : 32,
            '8b+'   : 33,
            '8c'    : 34,
            '8c+'   : 35,
            '9a'    : 36,
            '9a+'   : 37,
            '9b'    : 38,
            '9b+'   : 39,
            '9c'    : 40,
            'count' : 52,
            key: function (n) {
                return this[Object.keys(this)[n]];
            }
        },

        'uiaa_common': {
            'I'     : 3,
            'II'    : 5,
            'III'   : 6,
            'IV'    : 7,
            'V-'    : 8,
            'V'     : 9,
            'V+'    : 10,
            'VI-'   : 12,
            'VI'    : 15,
            'VI+'   : 17,
            'VII-'  : 18,
            'VII'   : 19,
            'VII+'  : 20,
            'VIII-' : 22,
            'VIII'  : 24,
            'VIII+' : 25,
            'IX-'   : 26,
            'IX'    : 28,
            'IX+'   : 29,
            'X-'    : 30,
            'X'     : 32,
            'X+'    : 33,
            'XI-'   : 35,
            'XI'    : 36,
            'XI+'   : 37,
            'XII-'  : 38,
            'XII'   : 39,
            'XII+'  : 40,
            'count' : 27,
            key: function (n) {
                return this[Object.keys(this)[n]];
            }
        },

        'v_common': {
            'VB-'   : 3,
            'VB'    : 6,
            'VB+'   : 12,
            'V0-'   : 15,
            'V0'    : 17,
            'V0+'   : 19,
            'V1'    : 20,
            'V1+'   : 21,
            'V2'    : 22,
            'V3'    : 23,
            'V4'    : 25,
            'V5'    : 26,
            'V6'    : 27,
            'V7'    : 29,
            'V8'    : 30,
            'V9'    : 31,
            'V10'   : 33,
            'V11'   : 35,
            'V12'   : 36,
            'V13'   : 37,
            'V14'   : 38,
            'V15'   : 39,
            'V16'   : 40,
            'count' : 22,
            key: function (n) {
                return this[Object.keys(this)[n]];
            }
        },

        'yds_common': {
            '5.0'   : 3,
            '5.1'   : 4,
            '5.2'   : 5,
            '5.3'   : 6,
            '5.4'   : 7,
            '5.5'   : 8,
            '5.6'   : 9,
            '5.7'   : 10,
            '5.8-'  : 11,
            '5.8'   : 12,
            '5.8+'  : 13,
            '5.9-'  : 14,
            '5.9'   : 15,
            '5.9+'  : 16,
            '5.10a' : 17,
            '5.10b' : 18,
            '5.10c' : 19,
            '5.10d' : 20,
            '5.11a' : 21,
            '5.11b' : 22,
            '5.11c' : 23,
            '5.11d' : 24,
            '5.12a' : 25,
            '5.12b' : 26,
            '5.12c' : 27,
            '5.12d' : 28,
            '5.13a' : 29,
            '5.13b' : 30,
            '5.13c' : 31,
            '5.13d' : 32,
            '5.14a' : 33,
            '5.14b' : 34,
            '5.14c' : 35,
            '5.14d' : 36,
            '5.15a' : 37,
            '5.15b' : 38,
            '5.15c' : 39,
            '5.15d' : 40,
            'count' : 37,
            key: function (n) {
                return this[Object.keys(this)[n]];
            }
        },

        'convert_common_to': function (grade_system, difficulty_obj) {
            if (typeof difficulty_obj != 'undefined') {
                /* For future when protection ratings are used as part of the conversion */
                if (difficulty_obj.hasOwnProperty('difficulty')) {
                    /* Is difficulty object */
                    var difficulty = difficulty_obj.difficulty;
                } else {
                    /* Just a plain integer */
                    var difficulty = difficulty_obj;
                }

                if (grade_system == 'Aid-A') {
                    return TH.util.grades.common_aid_a[difficulty];
                } else if (grade_system == 'Ewbanks') {
                     /* Ewbanks is very similar to the common, so for this we just subtract 1 from the common difficulty. */
                    if (difficulty > 1) {
                        return (difficulty - 1);
                    } else {
                        return 1;
                    }
                } else if (grade_system == 'Fontainebleau') {
                    return TH.util.grades.common_fontainebleau[difficulty];
                } else if (grade_system == 'Finnish') {
                    return TH.util.grades.common_finnish[difficulty];
                } else if (grade_system == 'French') {
                    return TH.util.grades.common_french[difficulty];
                } else if (grade_system == 'UIAA') {
                    return TH.util.grades.common_uiaa[difficulty];
                } else if (grade_system == 'USA-VScale') {
                    var convert_grade = TH.util.grades.common_v[difficulty];

                    if (difficulty_obj.protection < 5) {
                        convert_grade = convert_grade + " " + TH.util.grades.common_yds_protection[difficulty_obj.protection];
                    }

                    return convert_grade;
                } else if (grade_system == 'USA-YDS') {
                    var convert_grade = TH.util.grades.common_yds[difficulty];

                    if (difficulty_obj.protection < 5) {
                        convert_grade = convert_grade + " " + TH.util.grades.common_yds_protection[difficulty_obj.protection];
                    }

                    return convert_grade;
                } else if (grade_system == 'ZA-New') {
                    /* South African is the same as the common system */
                    return difficulty;
                } else {
                    /* Default to YDS */
                    return TH.util.grades.yds_common[difficulty];
                }
            } else {
                return '(Unknown Grade)';
            }
        },

        'convert_to_common': function (grade_system, difficulty) {
            if (grade_system == 'Aid-A') {
                return TH.util.grades.common_aid_a[difficulty];
            } else if (grade_system == 'Ewbanks') {
                return TH.util.grades.yds_to_common(difficulty);
            } else if (grade_system == 'Finnish') {
                return TH.util.grades.yds_to_common(difficulty);
            } else if (grade_system == 'Fontainebleau') {
                return TH.util.grades.yds_to_common(difficulty);
            } else if (grade_system == 'French') {
                return TH.util.grades.french_to_common(difficulty);
            } else if (grade_system == 'UIAA') {
                return TH.util.grades.uiaa_to_common(difficulty.toUpperCase());
            } else if (grade_system == 'USA-VScale') {
                return TH.util.grades.v_to_common(difficulty);
            } else if (grade_system == 'USA-YDS') {
                return TH.util.grades.yds_to_common(difficulty);
            } else if (grade_system == 'ZA-New') {
                return TH.util.grades.yds_to_common(difficulty);
            } else {
                /* Default to YDS */
                return TH.util.grades.yds_to_common(difficulty);
            }
        },


        'get_grade_count': function (grade_system) {
            if (grade_system == 'Aid-A') {
                return TH.util.grades.common_aid_a.count;
            } else if (grade_system == 'Ewbanks') {
                return 39;
            } else if (grade_system == 'Finnish') {
                return TH.util.grades.finnish_common.count;
            } else if (grade_system == 'Fontainebleau') {
                return TH.util.grades.fontainebleau_common.count;
            } else if (grade_system == 'French') {
                return TH.util.grades.french_common.count;
            } else if (grade_system == 'UIAA') {
                return TH.util.grades.uiaa_common.count;
            } else if (grade_system == 'USA-VScale') {
                return TH.util.grades.v_common.count;
            } else if (grade_system == 'USA-YDS') {
                return TH.util.grades.yds_common.count;
            } else if (grade_system == 'ZA-New') {
                /* South African is the same as the common system */
                return 40;
            } else {
                /* Default to YDS */
                return TH.util.grades.yds_common.count;
            }
        },

        'get_grade_by_index': function (grade_system, i) {
            /* For use on the by the grade filter slider */
            if (grade_system == 'Aid-A') {
                return TH.util.grades.common_aid_a[TH.util.grades.aid_a_common.key(i)];
            } else if (grade_system == 'Ewbanks') {
                /* Ewbanks is very similar to the common, so for this we just return the index value. */
                return i;
            } else if (grade_system == 'Finnish') {
                return TH.util.grades.common_fontainebleau[TH.util.grades.finnish_common.key(i)];
            } else if (grade_system == 'Fontainebleau') {
                return TH.util.grades.common_fontainebleau[TH.util.grades.fontainebleau_common.key(i)];
            } else if (grade_system == 'French') {
                return TH.util.grades.common_french[TH.util.grades.french_common.key(i)];
            } else if (grade_system == 'UIAA') {
                return TH.util.grades.common_uiaa[TH.util.grades.uiaa_common.key(i)];
            } else if (grade_system == 'USA-VScale') {
                return TH.util.grades.common_v[TH.util.grades.v_common.key(i)];
            } else if (grade_system == 'USA-YDS') {
                var common_val = TH.util.grades.yds_common.key(i);
                return TH.util.grades.common_yds[TH.util.grades.yds_common.key(i)];
            } else if (grade_system == 'ZA-New') {
                /* South African is the same as the common system */
                return i;
            } else {
                /* Default to YDS */
                return TH.util.grades.yds_common.key(i);
            }
        },

        'french_to_common': function (rating) {
            var difficulty = 0;
            var protection = 5;

            /* Clean up input */
            rating = rating.trim();
            rating = rating.toLowerCase();
            rating = rating.replace(' ', '');

            /* Convert to common grading value */
            difficulty = TH.util.grades.french_common[rating];

            var common_grade = {
                difficulty: difficulty,
                protection: protection,
                type:       'common_grading'
            };

            return common_grade;
        },

        'uiaa_to_common': function (rating) {
            var difficulty = 0;
            var protection = 5;

            /* Clean up input */
            rating = rating.trim();
            rating = rating.toUpperCase();
            rating = rating.replace(' ', '');

            /* Convert to common grading value */
            difficulty = TH.util.grades.uiaa_common[rating];

            var common_grade = {
                difficulty: difficulty,
                protection: protection,
                type:       'common_grading'
            };

            return common_grade;
        },

        'v_to_common': function (rating) {
            var difficulty = 0;
            var protection = 5;

            /* Clean up input */
            rating = rating.trim();
            rating = rating.toUpperCase();
            rating = rating.replace(' ', '');

            /* Convert to common grading value */
            difficulty = TH.util.grades.v_common[rating];

            var common_grade = {
                difficulty: difficulty,
                protection: protection,
                type:       'common_grading'
            };

            return common_grade;
        },

        'yds_to_common': function (rating) {
            var difficulty = 0;
            var protection = 5;

            /* Clean up input */
            rating = rating.trim();
            rating = rating.replace(' ', '');

             /* If 5.10 or greater change - to b and + to d */
            if (parseInt(rating.substring(2,4)) >= '10') {
                rating = rating.replace('+', 'd');
                rating = rating.replace('-', 'b');

                /* Append a 'b' ratting if no a,b,c or d is pressent */
                if (rating.length < 5) {
                    rating = rating + 'b';
                }
            }

             /* If 5.7 or less change remove + and - */
            if (parseInt(rating.substring(2,3)) < 8) {
                rating = rating.replace('+', '');
                rating = rating.replace('-', '');
            }

            /* Check for a Protection rating */
            /* Protection ratinges go from 0 - 9, with 9 being the best protected */
            if (rating.toLowerCase().indexOf('x') != -1) {
                protection = 1;
                rating = rating.replace('x', '');
                rating = rating.replace('X', '');
            } else if (rating.toLowerCase().indexOf('r') != -1) {
                protection = 3;
                rating = rating.replace('r', '');
                rating = rating.replace('R', '');
            } else if (rating.toLowerCase().indexOf('pg13') != -1) {
                protection = 5;
                rating = rating.replace('pg13', '');
                rating = rating.replace('PG13', '');
            } else if (rating.toLowerCase().indexOf('pg-13') != -1) {
                protection = 5;
                rating = rating.replace('pg-13', '');
                rating = rating.replace('PG-13', '');
            } else if (rating.toLowerCase().indexOf('pg') != -1) {
                protection = 7;
                rating = rating.replace('pg', '');
                rating = rating.replace('PG', '');
            } else if (rating.toLowerCase().indexOf('g') != -1) {
                protection = 9;
                rating = rating.replace('g', '');
                rating = rating.replace('G', '');
            }

            /* Convert to common grading value */
            difficulty = TH.util.grades.yds_common[rating];

            var common_grade = {
                difficulty: difficulty,
                protection: protection,
                type:       'common_grading'
            };

            return common_grade;
        }
    };

}(window, document));
