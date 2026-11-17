var p = require('./physics');

var CollisionLayer = Class.extend({

    name: null,
    bodies: [],

    init: function(data) {
        this.name = data.name;
        // Per-instance list; the prototype array was shared by every level ever
        // loaded and kept all old Box2D bodies alive.
        this.bodies = [];

        data = data.data;
        for (var i = 0; i < data.length; i++) {
            var obj = data[i];

            if (obj.polygon) {
                this.bodies.push(p.createCollisionPolygon(obj.polygon, obj.x, obj.y, obj.properties));
            } else if (obj.polyline) {
                this.addPolyLine(obj);
            } else if (obj.ellipse) {

            } else {
                this.bodies.push(p.createCollisionBox(obj.x, obj.y, obj.width, obj.height, obj.properties));
            }
        }
    },

    addPolyLine: function(obj) {
        var sy = obj.y,
            points = [];
        for (var i = 0, n = obj.polyline.length; i < n; i++) {
            var y = obj.polyline[i].y,
                ty = sy + y,
                s = 0,
                m = ty % 15;

            if (m === 13 || m === 5) s = -1;
            if (m === 11 || m === 3) s = 1;

            // Copy the point instead of snapping the shared level data in place.
            points.push({
                x: obj.polyline[i].x,
                y: y + s
            });
        }

        this.bodies.push(p.createCollisionPolyline(points, obj.x, obj.y, obj.properties));
    },

    update: function() {},

    draw: function() {}

})

module.exports = CollisionLayer;
