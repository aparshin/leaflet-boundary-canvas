BoundaryCanvas is a plugin for [Leaflet](http://leaflet.cloudmade.com/) mapping library to draw tiled raster layers with arbitrary boundary.
HTML5 Canvas is used for rendering. Works with both Leaflet 0.7.x and 1.0beta versions.

## Demos

* [Draw boundary of a raster layer yourself](http://aparshin.github.com/leaflet-boundary-canvas/examples/canvas-boundary-edit.html)
* [Add boundary to popular base layers](http://aparshin.github.com/leaflet-boundary-canvas/examples/canvas-boundary-providers.html)
* [A multipolygon with holes as a border](http://aparshin.github.com/leaflet-boundary-canvas/examples/canvas-boundary.html)

## Usage

```javascript
var osm = new L.TileLayer.BoundaryCanvas(tileLayerUrl, options);
map.addLayer(osm);
```

where
 * `tileLayerUrl` - URL similar to `L.TileLayer`
 * `options` - all `L.TileLayer` options and additional options described below.

## Options
 
`boundary` option can be
 * GeoJSON object (only `Polygon` and `MultiPolygon` geometries will be used)
 * `LatLng[]` - simple polygon (depricated)
 * `LatLng[][]` - polygon with holes (depricated)
 * `LatLng[][][]` - multipolygon (depricated)

All rings of boundary should be without self-intersections or intersections with other rings. Zero-winding fill algorithm is used in HTML5 Canvas, so holes should have opposite direction to exterior ring.

`crossOrigin` option (Boolean) should be set if you want to request CORS enabled images. It is not required for the plugin itself, but can be usefull for potential plugin extensions.

`trackAttribution` option (Boolean) can be set to show layer's attribution only when map boundary intersects layer's geometry. Additional calculations are required after each map movement (critical for complex boundaries).

## Contruction from Other Layers

There is a helper function to construct `L.TileLayer.BoundaryCanvas` based on already created `L.TileLayer` layer:

```javascript
var boundaryLayer = L.TileLayer.BoundaryCanvas.createFromLayer(tileLayer, options);
```

where
 * `tileLayer` - instance of `L.TileLayer`
 * `options` - `L.TileLayer.BoundaryCanvas` options (including `boundary`)
 
This helper returns new `L.TileLayer.BoundaryCanvas` layer. It is based only on options of original layer and doesn't work for all the `L.TileLayer` descendant classes.

## Code Example

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
