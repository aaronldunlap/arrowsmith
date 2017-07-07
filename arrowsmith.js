var arrowsmith = function () {

  var GMaps = window.GMaps,
    maps = google.maps,
    $ = jQuery,
    self = this;

  this.container = false;
  this.map = false;
  this.arguments = arguments;
  this.locations = [];
  this.filters = {};
  this._activeFilters = [];


  // Default coords for when the map first opens (Chicago right now)
  this.location = {
    lat: 41.884851,
    lng: -87.619915
  };

  // Paths to the values inside the target file or API (defaults:)
  this.locationObjectPaths = {
    locationList: 'objects',
    lat: 'latitude',
    lng: 'longitude',
    title: 'name'
  };
  this.regionObjectPaths = {
    regionList: 'objects',
    lat: 'latitude',
    lng: 'longitude',
    title: 'name'
  };

  // Default template for location details
  this.locationTemplate = '<h4><%= name %></h4>';

  // Default marker pin ('' defaults to google's default red pin)
  this.locationMarker = '';

  this.init = function () {
    if (typeof self.arguments[0] !== 'undefined') {
      self.container = self.arguments[0];

      var $mapHolder = $('<div class="map-holder"></div>').css({
        width: '100%',
        height: '100%'
      });

      $mapHolder.appendTo(self.container);

      self.map = new GMaps({
        div: $mapHolder.get(0),
        lat: 41.884851,
        lng: -87.619915,
        zoom: 11,
        mapTypeControl: false
      });
    }
    trigger('initialized');
    return self;
  }

  this.style = function (styles) {
    self.map.addStyle({
      mapTypeId: "custom_style",
      styles: styles
    });
    self.map.setStyle("custom_style");
    trigger('style-changed', styles);
    return self;
  }

  this.loadLocations = function (url) {
    trigger('load-locations-start');
    self.locations = [];
    $.getJSON(url, function (response) {
      /*	Clear markers	*/
      self.map.removeMarkers();
      trigger('load-locations-response');

      // Get locations from the response using locationObjectPaths
      var locations = _.get(response, self.locationObjectPaths.locationList);

      _.each(locations, function (item) {

        var infoHTML = _compileInfoBox(item);

        var location = {
          lat: _.get(item, self.locationObjectPaths.lat),
          lng: _.get(item, self.locationObjectPaths.lng),
          title: _.get(item, self.locationObjectPaths.title),
          content: infoHTML,
          data: item
        }

        self.addLocation(location);
      });
      self.plotLocations();
      trigger('load-locations-finished');
    });
  }

  this.registerFilter = function (name, filter) {
    this.filters[name] = filter;
  }

  this.filterOn = function (name) {
    if (typeof self.filters[name] === 'undefined') {
      throw new Error("That filter isn't registered")
    }
    self._activeFilters = _.without(self._activeFilters, name);
    self._activeFilters.push(name);
    self.plotLocations();
  }

  this.filterOff = function (name) {
    if (typeof self.filters[name] === 'undefined') {
      throw new Error("That filter isn't registered")
    }
    self._activeFilters = _.without(self._activeFilters, name);
    self.plotLocations();
  }

  this.filterToggle = function (name) {
    trigger('filter-toggle', name);
    if (_.find(self._activeFilters, function (i) { return i === name; })) self.filterOff(name)
    else self.filterOn(name);
  }

  function _getMarker(location) {
    if (typeof self.locationMarker === 'function') {
      return self.locationMarker.call(location);
    }

    // See if the location marker is set to a color code
    if (/^#/.test(self.locationMarker)) {
      return self.colorPin(self.locationMarker);
    }
    // Otherwise go with the url given
    return self.locationMarker;
  }

  this.colorPin = function (str) {
      return 'https://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|' + str.replace('#', '');
    }
    // Add a location to the map
  this.addLocation = function (location) {
      // Make sure all options are set
      location = _.extend({
        lat: 100,
        lng: 100,
        title: '',
        content: '',
        icon: _getMarker(location)
      }, location);

      if (location.lat === null || location.lng === null) return;

      self.locations.push(location);
      trigger('location-added');
    }
    // Internal template to generate html for map marker infobox using lodash template
  var _compileInfoBox = function (data) {
    var template = _.template(self.locationTemplate);
    return template(data);
  }

  this.plotLocations = function () {
    self.map.removeMarkers();

    var filteredLocations = _.clone(self.locations);
    _.each(self._activeFilters, function (name) {
      filteredLocations = _.filter(filteredLocations, self.filters[name]);
      console.log('filtered:', filteredLocations);
    });

    _.each(filteredLocations, function (location) {
      self.map.addMarker({
        lat: location.lat,
        lng: location.lng,
        title: location.title,
        infoWindow: {
          content: location.content,
          disableAutoPan: false
        },
        icon: location.icon
      });
    });

  }

  // Return coordinates of center
  this.getCenterCoords = function () {
    var coords = self.map.getCenter();
    return coords.H + ', ' + coords.L;

  }

  // Regions
  this.regions = null;

  this.loadRegions = function (url) {
    trigger('load-regions-start');
    $.getJSON(url, function (response) {
      self.regions = _.get(response, self.regionObjectPaths.regionList);
      self.buildRegions();
      trigger('load-regions-finished');
    });
  }
  var $select;

  this.buildRegions = function () {
    $(self.container).find('select.regions').remove();

    $select = $('<select class="regions"></select>');

    // Build a select option for every region
    _.each(self.regions, function (region, i) {
      var regionObject = {
        lat: _.get(region, self.regionObjectPaths.lat),
        lng: _.get(region, self.regionObjectPaths.lng),
        title: _.get(region, self.regionObjectPaths.title)
      };

      var $option = $('<option value="' + i + '">' + regionObject.title + '</option>');
      $option.data('coords', {
        lat: regionObject.lat,
        lng: regionObject.lng
      });

      $select.append($option);
    });

    // Add select box to container
    $(self.container).append($select);

    // Event listener to center the map on the selected region
    $select.on('change', function () {
      var coords = $(this).find(':selected').data('coords');
      self.map.setCenter(coords.lat, coords.lng);
      self.map.setZoom(11);
      trigger('region-changed');
    });
    trigger('regions-built', {
      element: $select
    });
  }

  this.selectRegion = function (regionName) {
    $select.children('option').removeAttr('selected').filter(':contains("' + regionName + '")').attr('selected', 'selected').trigger('change');
  }

  // Event handling
  var eventDelegate = {};
  this.on = function (token, callback) {
    $(eventDelegate).on(token, callback);
  }
  this.off = function (token, callback) {
    $(eventDelegate).off(token, callback);
  }
  var trigger = function (token, data) {
    $(eventDelegate).trigger(token, data);
  }




  this.init();
  return self;
};
