window.Box2D = require('../lib/box2dweb');
var b2Vec2 = Box2D.Common.Math.b2Vec2,
    b2BodyDef = Box2D.Dynamics.b2BodyDef,
    b2Body = Box2D.Dynamics.b2Body,
    b2FixtureDef = Box2D.Dynamics.b2FixtureDef,
    b2Fixture = Box2D.Dynamics.b2Fixture,
    b2World = Box2D.Dynamics.b2World,
    b2MassData = Box2D.Collision.Shapes.b2MassData,
    b2EdgeShape = Box2D.Collision.Shapes.b2EdgeShape,
    b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape,
    b2CircleShape = Box2D.Collision.Shapes.b2CircleShape,
    b2DebugDraw = Box2D.Dynamics.b2DebugDraw,
    b2Listener = Box2D.Dynamics.b2ContactListener,
    b2PrismaticJoint = Box2D.Dynamics.Joints.b2PrismaticJoint,
    b2PrismaticJointDef = Box2D.Dynamics.Joints.b2PrismaticJointDef;

var b2Sep = require('../lib/box_2d_separator');
var config = require('../config');

var b2AABB = Box2D.Collision.b2AABB,
    b2Shape = Box2D.Collision.Shapes.b2Shape,
    b2Transform = Box2D.Common.Math.b2Transform;

function removeCollision(list, ent) {
    var i = list.indexOf(ent);
    if (i !== -1) list.splice(i, 1);
}

var listener = new b2Listener;

listener.BeginContact = function(contact) {
    var fixtureDataA = contact.GetFixtureA().GetUserData();
    var fixtureDataB = contact.GetFixtureB().GetUserData();
    var bodyDataA = contact.GetFixtureA().m_body.m_userData;
    var bodyDataB = contact.GetFixtureB().m_body.m_userData;
    if (fixtureDataA) {
        if (fixtureDataA.id == 'foot' && (!bodyDataB || !bodyDataB.sensor)) {
            bodyDataA.footContacts++;
        }
        if (fixtureDataA.id == 'player') {
            if (bodyDataB) {
                bodyDataB.playerCollision = true;
            }
        } else {
            if (bodyDataA) {
                if(bodyDataA.collisions && fixtureDataB && fixtureDataB.ent) {
                    bodyDataA.collisions.push(fixtureDataB.ent);
                }
            }
        }
    }

    if (fixtureDataB) {
        if (fixtureDataB.id == 'foot' && (!bodyDataA || !bodyDataA.sensor)) {
            bodyDataB.footContacts++;
        }
        if (fixtureDataB.id == 'player') {
            if (bodyDataA) {
                bodyDataA.playerCollision = true;
            }
        } else {
            if (bodyDataB && fixtureDataA && fixtureDataA.ent) {
                if(bodyDataB.collisions) {
                    bodyDataB.collisions.push(fixtureDataA.ent);
                }
            }
        }
    }
}

listener.EndContact = function(contact) {
    var fixtureDataA = contact.GetFixtureA().GetUserData();
    var fixtureDataB = contact.GetFixtureB().GetUserData();
    var bodyDataA = contact.GetFixtureA().m_body.m_userData;
    var bodyDataB = contact.GetFixtureB().m_body.m_userData;
    if (fixtureDataA) {
        if (fixtureDataA.id == 'foot' && (!bodyDataB || !bodyDataB.sensor)) {
            bodyDataA.footContacts--;
        }
        if (fixtureDataA.id == 'player') {
            if (bodyDataB) {
                bodyDataB.playerCollision = false;
            }
        } else {
            if (bodyDataA) {
                if(bodyDataA.collisions && fixtureDataB && fixtureDataB.ent) {
                    removeCollision(bodyDataA.collisions, fixtureDataB.ent);
                }
            }
        }
    }

    if (fixtureDataB) {
        if (fixtureDataB.id == 'foot' && (!bodyDataA || !bodyDataA.sensor)) {
            bodyDataB.footContacts--;
        }
        if (fixtureDataB.id == 'player') {
            if (bodyDataA) {
                bodyDataA.playerCollision = false;
            }
        } else {
            if (bodyDataB && fixtureDataA && fixtureDataA.ent) {
                if(bodyDataB.collisions) {
                    removeCollision(bodyDataB.collisions, fixtureDataA.ent);
                }
            }
        }
    }
}

var Physics = {
    world: new b2World(new b2Vec2(0, 9.8), true),

    // Every game tick advances the world by `substeps` steps of `stepAmount`
    // seconds. The levels were tuned with exactly 1/15s of simulation per 60Hz
    // frame (four 1/60s steps), so the engine calls step() at a fixed 60Hz.
    stepAmount: 1 / 60,
    substeps: 4,

    debugDraw: null,

    paused: false,

    ground: null,

    resetWorld: function() {
        this.world = new b2World(new b2Vec2(0, 9.8), true);
        this.world.SetContactListener(listener);
        this.world.SetDebugDraw(this.debugDraw);
    },

    step: function() {
        for (var i = 0; i < this.substeps; i++) {
            this.world.Step(this.paused ? 0 : this.stepAmount, 8, 3);
        }
    },

    setPaused: function(p) {
        this.paused = p;
    },

    removeBody: function(body) {
        this.world.DestroyBody(body);
    },

    addPlayerEntity: function(x, y, w, h, options) {
        var bd = new b2BodyDef();
        bd.position.Set(x, y);
        bd.type = b2Body.b2_dynamicBody;
        var body = this.world.CreateBody(bd);
        body.SetFixedRotation(true);

        w = w - 0.6;


        var shape = new b2PolygonShape();
        shape.SetAsOrientedBox(w / 2, h / 2, new b2Vec2(w / 2, h / 2), 0);


        var fd = new b2FixtureDef();
        fd.shape = shape;
        fd.density = 1;
        fd.friction = 0.5;
        fd.restitution = 0.2;

        var fix = body.CreateFixture(fd);
        fix.SetUserData({
            id: 'player'
        });

        fd.friction = 0;
        fd.restitution = 0.05;
        shape.SetAsOrientedBox(0.3, h / 2, new b2Vec2(0, h / 2), 0);
        body.CreateFixture(fd);
        shape.SetAsOrientedBox(0.3, h / 2, new b2Vec2(w, h / 2), 0);
        body.CreateFixture(fd);

        shape.SetAsOrientedBox((w / 2), 0.3, new b2Vec2(w / 2, h), 0);
        fd.isSensor = true;

        var footSensor = body.CreateFixture(fd);
        footSensor.SetUserData({
            id: 'foot'
        });
        body.SetUserData({
            footContacts: 0,
            // outer extents of the side fixtures, used by playerAgainstWall()
            left: -0.3,
            right: w + 0.3,
            height: h
        });

        return body;
    },

    addBoxEntity: function(x, y, w, h, options) {
        options = options || {};
        if (!options.bodytype) options.bodytype = "b2_dynamicBody";
        if (options.fixedrotation == undefined) options.fixedrotation = true;
        if (!options.density) options.density = 4;
        if (!options.friction) options.friction = 0;
        if (!options.restitution) options.restitution = 0;
        if (options.width) w = options.width;
        if (options.height) h = options.height;
        if (options.x) x = options.x;
        if (options.y) y = options.y;

        var bd = new b2BodyDef();
        bd.position.Set(x, y);
        bd.type = b2Body[options.bodytype];

        var body = this.world.CreateBody(bd);


        body.SetFixedRotation(options.fixedrotation);

        h = h - (options.top ? 0.2 : 0) - (options.bottom ? 0.2 : 0);

        var shape = new b2PolygonShape();
        shape.SetAsOrientedBox(w / 2, h/2, new b2Vec2(w / 2, h / 2), 0);

        var fd = new b2FixtureDef();
        fd.shape = shape;
        fd.density = options.density;
        fd.friction = options.friction;
        fd.restitution = options.restitution;
        fd.isSensor = options.isSensor || false;
        if (fd.isSensor) {
            body.SetUserData({
                playerCollision: false,
                collisions: [],
                sensor: true
            });
        }
        var fix = body.CreateFixture(fd);
        fix.SetUserData({
            id: 'spawn',
            ent: options.ent
        });

        if (options.top) {
            shape.SetAsOrientedBox((w / 2), 0.2, new b2Vec2(w / 2, -0.2), 0);
            fd.restitution = options.top.restitution || 0;
            fd.friction = options.top.friction || 0;
            body.CreateFixture(fd);
        }

        if (options.bottom) {
            shape.SetAsOrientedBox((w / 2), 0.2, new b2Vec2(w / 2, h), 0);
            fd.friction = options.bottom.friction || 0;
            fd.restitution = options.bottom.restitution || 0;
            body.CreateFixture(fd);
        }

        var joint;
        if (options.fixed) {
            body.SetFixedRotation(false);
            var pjd = new b2PrismaticJointDef();
            var axis = options.fixed == "y" ? new b2Vec2(0, 1) : new b2Vec2(-1, 0);
            pjd.Initialize(body, this.world.GetGroundBody(), new b2Vec2(0, 0), axis);
            if (options.limit) {
                pjd.enableLimit = true;
                pjd.lowerTranslation = options.limit.lower;
                pjd.upperTranslation = options.limit.upper;
            }


            if(options.motor) {
                pjd.enableMotor = true;
                pjd.motorSpeed = options.motor.speed;
                pjd.maxMotorForce = options.motor.maxForce;

            }
            joint = this.world.CreateJoint(pjd);
        }

        if (joint) return {body: body, joint: joint};

        return body;
    },

    createCollisionBody: function(x, y) {
        var bd = new b2BodyDef();
        bd.type = b2Body.b2_staticBody;
        bd.position.Set(x, y);
        var body = this.world.CreateBody(bd);

        return body;
    },

    createCollisionFixture: function(options) {
        options = options || {};
        var fd = new b2FixtureDef();
        fd.restitution = options.restitution || 0;
        fd.friction = options.friction || 0.5;
        fd.density = options.density || 0;

        return fd;
    },

    accelerate: function(body, speed) {
        var vel = body.GetLinearVelocity();

        var changeX = speed - vel.x,
            impulseX = body.GetMass() * changeX;

        body.ApplyImpulse(new b2Vec2(impulseX, 0), body.GetWorldCenter());
    },

    createCollisionBox: function(x, y, w, h, options) {
        var body = this.createCollisionBody(x, y);
        var fd = this.createCollisionFixture(options);

        var shape = new b2PolygonShape();
        shape.SetAsOrientedBox(w / 2, h / 2, new b2Vec2(w / 2, h / 2), 0);

        fd.shape = shape;
        body.CreateFixture(fd);

        return body;
    },

    createCollisionPolyline: function(vecArray, x, y, options) {
        var body = this.createCollisionBody(x, y);
        var fd = this.createCollisionFixture(options);

        for (var i = 0; i < vecArray.length - 1; i++) {
            var v1 = new b2Vec2(vecArray[i].x, vecArray[i].y),
                v2 = new b2Vec2(vecArray[i + 1].x, vecArray[i + 1].y);

            var shape = new b2PolygonShape();
            shape.SetAsEdge(v1, v2);

            fd.shape = shape;
            body.CreateFixture(fd);
        }

        return body;
    },

    createCollisionPolygon: function(vecArray, x, y, options) {
        var val = b2Sep.validate(vecArray);
        if (val !== 0) {
            throw ('Couldnt separate polygon, validation code ' + val);
        }

        var body = this.createCollisionBody(x, y);
        var fd = this.createCollisionFixture(options);

        b2Sep.separate(body, fd, vecArray);

        return body;
    },

    // True if static level geometry is right beside the player body on side
    // `dir` (-1 left, 1 right). The lowest 2px are ignored, so floor seams and
    // tiny steps behave exactly as before.
    playerAgainstWall: function(body, dir) {
        var d = body.GetUserData(),
            p = body.GetPosition(),
            x = p.x + (dir > 0 ? d.right : d.left),
            reach = 0.5;

        return this.staticGeometryAt(dir > 0 ? x : x - reach, p.y + 1, dir > 0 ? x + reach : x, p.y + d.height - 2);
    },

    // True if a solid fixture of the static level geometry overlaps the
    // rectangle (x1, y1)-(x2, y2).
    staticGeometryAt: function(x1, y1, x2, y2) {
        var aabb = new b2AABB(),
            probe = new b2PolygonShape(),
            xf = new b2Transform(),
            found = false;

        aabb.lowerBound.Set(x1, y1);
        aabb.upperBound.Set(x2, y2);
        probe.SetAsOrientedBox((x2 - x1) / 2, (y2 - y1) / 2, new b2Vec2((x1 + x2) / 2, (y1 + y2) / 2), 0);
        xf.SetIdentity();

        this.world.QueryAABB(function(fixture) {
            var body = fixture.GetBody();
            if (body.GetType() !== b2Body.b2_staticBody || fixture.IsSensor()) return true;
            if (b2Shape.TestOverlap(probe, xf, fixture.GetShape(), body.GetTransform())) {
                found = true;
                return false;
            }
            return true;
        }, aabb);

        return found;
    },

    getBodyPos: function(body) {
        return {
            x: 0,
            y: 0
        }
    },

    draw: function() {
        if (this.debugDraw) {
            var ctx = this.debugDraw.m_ctx;
            ctx.save();
            ctx.translate(config.display.offset.x, config.display.offset.y);
            this.world.DrawDebugData();
            ctx.restore();
        }
    },

    initDebug: function(context, scale) {
        this.scale = scale;
        this.debugDraw = new b2DebugDraw();
        this.debugDraw.SetSprite(context);
        this.debugDraw.SetDrawScale(scale);
        this.debugDraw.SetFillAlpha(0.3);
        this.debugDraw.SetLineThickness(1.0);
        this.debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
        this.world.SetDebugDraw(this.debugDraw);
    },

    resizeDebug: function(scale) {
        this.scale = scale;
        this.debugDraw.SetDrawScale(scale);
    },

    dragNDrop: function(element) {
        var self = this;
        var obj = null;
        var joint = null;

        function calculateWorldPosition(e) {
            return {
                x: ((e.offsetX || e.layerX) - config.display.offset.x) / self.scale,
                y: ((e.offsetY || e.layerY) - config.display.offset.y) / self.scale
            };
        }

        element.addEventListener("mousedown", function(e) {
            e.preventDefault();
            var point = calculateWorldPosition(e);
            self.world.QueryPoint(function(fixture) {
                obj = fixture.GetBody();
            }, point);
        });

        element.addEventListener("mousemove", function(e) {
            if (!obj) {
                return;
            }
            var point = calculateWorldPosition(e);

            if (!joint) {
                var jointDefinition = new Box2D.Dynamics.Joints.b2MouseJointDef();

                jointDefinition.bodyA = self.world.GetGroundBody();
                jointDefinition.bodyB = obj;
                jointDefinition.target.Set(point.x, point.y);
                jointDefinition.maxForce = 100000;
                jointDefinition.timeStep = self.stepAmount;
                joint = self.world.CreateJoint(jointDefinition);
            }

            joint.SetTarget(new b2Vec2(point.x, point.y));
        });

        element.addEventListener("mouseup", function(e) {
            obj = null;
            if (joint) {
                self.world.DestroyJoint(joint);
                joint = null;
            }
        });
    }
};



module.exports = Physics;
