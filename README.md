BoundaryCanvas is a plugin for [Leaflet](http://leaflet.cloudmade.com/) mapping library to draw tiled raster layers with arbitrary boundary. HTML5 Canvas is used for rendering.

Demos
--------

* [Draw boundary of a raster layer yourself] (http://aparshin.github.com/leaflet-boundary-canvas/examples/canvas-boundary-edit.html)
* [A multipolygon with holes as a border] (http://aparshin.github.com/leaflet-boundary-canvas/examples/canvas-boundary.html)

Usage
-----

```javascript
var osm = new L.TileLayer.BoundaryCanvas(tileLayerUrl, options);
map.addLayer(osm);
```
where 
 * `tileLayerUrl` - URL similar to `L.TileLayer`
 * `options` - all `L.TileLayer` options and `boundary` option.
        
`boundary` option can be
 * `LatLng[]` - simple polygon
 * `LatLng[][]` - polygon with holes
 * `LatLng[][][]` - multipolygon

All rings of boundary should be without self-intersections or intersections with other rings. Zero-winding fill 
algorithm is used in HTML5 Canvas, so holes should have opposite direction to exterior ring.
 
Code Example
-------

```javascript
var latLngGeom = ...; //Define real geometry here
var map = L.map('map').setView([55.7, 38], 7),
    osmUrl = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
    osmAttribution = 'Map data &copy; 2012 OpenStreetMap contributors';

var osm = L.TileLayer.boundaryCanvas(osmUrl, {
    boundary: latLngGeom, 
    attribution: osmAttribution
}).addTo(map);
```