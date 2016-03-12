(function() {

var isRingBbox = function (ring, bbox) {
    if (ring.length !== 4) {
        return false;
    }

    var p, sumX = 0, sumY = 0;

    for (p = 0; p < 4; p++) {
        if ((ring[p].x !== bbox.min.x && ring[p].x !== bbox.max.x) ||
            (ring[p].y !== bbox.min.y && ring[p].y !== bbox.max.y)) {
            return false;
        }

        sumX += ring[p].x;
        sumY += ring[p].y;
        
        //bins[Number(ring[p].x === bbox.min.x) + 2 * Number(ring[p].y === bbox.min.y)] = 1;
    }

    //check that we have all 4 vertex of bbox in our geometry
    return sumX === 2*(bbox.min.x + bbox.max.x) && sumY === 2*(bbox.min.y + bbox.max.y);
};

var ExtendMethods = {
    _toMercGeometry: function(b, isGeoJSON) {
        var res = [];
        var c, r, p,
            mercComponent,
            mercRing,
            coords;

        if (!isGeoJSON) {
            if (!(b[0] instanceof Array)) {
                b = [[b]];
            } else if (!(b[0][0] instanceof Array)) {
                b = [b];
            }
        }

        for (c = 0; c < b.length; c++) {
            mercComponent = [];
            for (r = 0; r < b[c].length; r++) {
                mercRing = [];
                for (p = 0; p < b[c][r].length; p++) {
                    coords = isGeoJSON ? L.latLng(b[c][r][p][1], b[c][r][p][0]) : b[c][r][p];
                    mercRing.push(this._map.project(coords, 0));
                }
                mercComponent.push(mercRing);
            }
            res.push(mercComponent);
        }
        
        return res;
    },
    
    //lazy calculation of layer's boundary in map's projection. Bounding box is also calculated
    _getOriginalMercBoundary: function () {
        if (this._mercBoundary) {
            return this._mercBoundary;
        }

        var compomentBbox;
            
        if (L.Util.isArray(this.options.boundary)) { //Depricated: just array of coordinates
            this._mercBoundary = this._toMercGeometry(this.options.boundary);
        } else { //GeoJSON
            this._mercBoundary = [];
            var processGeoJSONObject = function(obj) {
                if (obj.type === 'GeometryCollection') {
                    obj.geometries.forEach(processGeoJSONObject);
                } else if (obj.type === 'Feature') {
                    processGeoJSONObject(obj.geometry);
                } else if (obj.type === 'FeatureCollection') {
                    obj.features.forEach(processGeoJSONObject);
                } else if (obj.type === 'Polygon') {
                    this._mercBoundary = this._mercBoundary.concat(this._toMercGeometry([obj.coordinates], true));
                } else if (obj.type === 'MultiPolygon') {
                    this._mercBoundary = this._mercBoundary.concat(this._toMercGeometry(obj.coordinates, true));
                }
            }.bind(this);
            processGeoJSONObject(this.options.boundary);
        }
        
        this._mercBbox = new L.Bounds();
        for (c = 0; c < this._mercBoundary.length; c++) {
            compomentBbox = new L.Bounds(this._mercBoundary[c][0]);
            this._mercBbox.extend(compomentBbox.min);
            this._mercBbox.extend(compomentBbox.max);
        }

        return this._mercBoundary;
    },

    // Calculates intersection of original boundary geometry and tile boundary.
    // Uses quadtree as cache to speed-up intersection.
    // Return 
    //   {isOut: true} if no intersection,  
    //   {isIn: true} if tile is fully inside layer's boundary
    //   {geometry: <LatLng[][][]>} otherwise
    _getTileGeometry: function (x, y, z, skipIntersectionCheck) {
        if ( !this.options.boundary) {
            return {isIn: true};
        }
    
        var cacheID = x + ":" + y + ":" + z,
            zCoeff = Math.pow(2, z),
            parentState,
            clippedGeom = [],
            iC, iR,
            clippedComponent,
            clippedExternalRing,
            clippedHoleRing,
            cache = this._boundaryCache;

        if (cache[cacheID]) {
            return cache[cacheID];
        }

        var mercBoundary = this._getOriginalMercBoundary(),
            ts = this.options.tileSize,
            tileBbox = new L.Bounds(new L.Point(x * ts / zCoeff, y * ts / zCoeff), new L.Point((x + 1) * ts / zCoeff, (y + 1) * ts / zCoeff));

        //fast check intersection
        if (!skipIntersectionCheck && !tileBbox.intersects(this._mercBbox)) {
            return {isOut: true};
        }

        if (z === 0) {
            cache[cacheID] = {geometry: mercBoundary};
            return cache[cacheID];
        }

        parentState = this._getTileGeometry(Math.floor(x / 2), Math.floor(y / 2), z - 1, true);

        if (parentState.isOut || parentState.isIn) {
            return parentState;
        }

        for (iC = 0; iC < parentState.geometry.length; iC++) {
            clippedComponent = [];
            clippedExternalRing = L.PolyUtil.clipPolygon(parentState.geometry[iC][0], tileBbox);
            if (clippedExternalRing.length === 0) {
                continue;
            }

            clippedComponent.push(clippedExternalRing);

            for (iR = 1; iR < parentState.geometry[iC].length; iR++) {
                clippedHoleRing = L.PolyUtil.clipPolygon(parentState.geometry[iC][iR], tileBbox);
                if (clippedHoleRing.length > 0) {
                    clippedComponent.push(clippedHoleRing);
                }
            }
            clippedGeom.push(clippedComponent);
        }
        
        if (clippedGeom.length === 0) { //we are outside of all multipolygon components
            cache[cacheID] = {isOut: true};
            return cache[cacheID];
        }

        for (iC = 0; iC < clippedGeom.length; iC++) {
            if (isRingBbox(clippedGeom[iC][0], tileBbox)) {
                //inside exterior rings and no holes
                if (clippedGeom[iC].length === 1) {
                    cache[cacheID] = {isIn: true};
                    return cache[cacheID];
                }
            } else { //intersect exterior ring
                cache[cacheID] = {geometry: clippedGeom};
                return cache[cacheID];
            }

            for (iR = 1; iR < clippedGeom[iC].length; iR++) {
                if (!isRingBbox(clippedGeom[iC][iR], tileBbox)) { //inside exterior ring, but have intersection with hole
                    cache[cacheID] = {geometry: clippedGeom};
                    return cache[cacheID];
                }
            }
        }

        //we are inside all holes in geometry
        cache[cacheID] = {isOut: true};
        return cache[cacheID];
    },

    _drawTileInternal: function (canvas, tilePoint, url, callback) {
        var zoom = this._getZoomForUrl(),
            state = this._getTileGeometry(tilePoint.x, tilePoint.y, zoom);

        if (state.isOut) {
            callback();
            return;
        }

        var ts = this.options.tileSize,
            tileX = ts * tilePoint.x,
            tileY = ts * tilePoint.y,
            zCoeff = Math.pow(2, zoom),
            ctx = canvas.getContext('2d'),
            imageObj = new Image(),
            _this = this;
            
        var setPattern = function () {
            var c, r, p,
                pattern,
                geom;

            if (!state.isIn) {
                geom = state.geometry;
                ctx.beginPath();

                for (c = 0; c < geom.length; c++) {
                    for (r = 0; r < geom[c].length; r++) {
                        if (geom[c][r].length === 0) {
                            continue;
                        }

                        ctx.moveTo(geom[c][r][0].x * zCoeff - tileX, geom[c][r][0].y * zCoeff - tileY);
                        for (p = 1; p < geom[c][r].length; p++) {
                            ctx.lineTo(geom[c][r][p].x * zCoeff - tileX, geom[c][r][p].y * zCoeff - tileY);
                        }
                    }
                }
                ctx.clip();
            }

            pattern = ctx.createPattern(imageObj, "repeat");
            ctx.beginPath();
            ctx.rect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = pattern;
            ctx.fill();
            callback();
        };
        
        if (this.options.crossOrigin) {
            imageObj.crossOrigin = '';
        }
        
        imageObj.onload = function () {
            //TODO: implement correct image loading cancelation
            canvas.complete = true; //HACK: emulate HTMLImageElement property to make happy L.TileLayer
            setTimeout(setPattern, 0); //IE9 bug - black tiles appear randomly if call setPattern() without timeout
        }
        
        imageObj.src = url;
    }
};

if (L.version >= '0.8') {
    L.TileLayer.BoundaryCanvas = L.TileLayer.extend({
        options: {
            // all rings of boundary should be without self-intersections or intersections with other rings
            // zero-winding fill algorithm is used in canvas, so holes should have opposite direction to exterior ring
            // boundary can be
            // LatLng[] - simple polygon
            // LatLng[][] - polygon with holes
            // LatLng[][][] - multipolygon
            boundary: null
        },
        includes: ExtendMethods,
        initialize: function(url, options) {
            L.TileLayer.prototype.initialize.call(this, url, options);
            this._boundaryCache = {}; //cache index "x:y:z"
            this._mercBoundary = null;
            this._mercBbox = null;
        },
        createTile: function(coords, done){
            var tile = document.createElement('canvas'),
                url = this.getTileUrl(coords);
            tile.width = tile.height = this.options.tileSize;
            this._drawTileInternal(tile, coords, url, L.bind(done, null, null, tile));

            return tile;
        }
    })
} else {
    L.TileLayer.BoundaryCanvas = L.TileLayer.Canvas.extend({
        options: {
            // all rings of boundary should be without self-intersections or intersections with other rings
            // zero-winding fill algorithm is used in canvas, so holes should have opposite direction to exterior ring
            // boundary can be
            // LatLng[] - simple polygon
            // LatLng[][] - polygon with holes
            // LatLng[][][] - multipolygon
            boundary: null
        },
        includes: ExtendMethods,
        initialize: function (url, options) {
            L.Util.setOptions(this, options);
            L.Util.setOptions(this, {async: true}); //image loading is always async
            this._url = url;
            this._boundaryCache = {}; //cache index "x:y:z"
            this._mercBoundary = null;
            this._mercBbox = null;
        },
        drawTile: function(canvas, tilePoint) {
            var adjustedTilePoint = L.extend({}, tilePoint),
                url;

            this._adjustTilePoint(adjustedTilePoint);
            url = this.getTileUrl(adjustedTilePoint);
            this._drawTileInternal(canvas, tilePoint, url, L.bind(this.tileDrawn, this, canvas));
        }
    });
}

L.TileLayer.boundaryCanvas = function (url, options) {
    return new L.TileLayer.BoundaryCanvas(url, options);
};

L.TileLayer.BoundaryCanvas.createFromLayer = function (layer, options) {
    return new L.TileLayer.BoundaryCanvas(layer._url, L.extend({}, layer.options, options));
};

})();
