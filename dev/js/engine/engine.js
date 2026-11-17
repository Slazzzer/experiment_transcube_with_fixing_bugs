var config = require('../config');
var Input = require('./input');
var p = require('./physics');
var media = require('../data/media');
var Assets = require('./assets');
var game = require('../game');

var Engine = Class.extend({
    game: null,

    canvas: null,
    context: null,
    ui: null,

    draws: 0,

    // Game logic (input, entities, physics) runs at a fixed 60 ticks per
    // second, independent of the display refresh rate. Previously every
    // animation frame was one tick, so on 120/144/165Hz screens the whole game
    // ran 2-3x too fast while timers (e.g. the transform animation) stayed in
    // real time, which made some levels impossible.
    tickMs: 1000 / 60,
    maxTicksPerFrame: 4,
    accumulator: 0,
    lastTime: 0,

    profiles: 0,

    init: function(gameConst) {
        this.initCanvas();

        if (!this.game) {
            Assets.loadAll(media);
            Assets.onReady(function() {
                if (!this.game) {
                    this.game = new game(this.context);
                }

            }, this);
        }

        this.initSounds();

        p.initDebug(this.context, config.display.scale);
        // Dragging physics bodies with the mouse is a development aid only;
        // in a normal build it would let anyone carry the player to the exit.
        if (config.debug) p.dragNDrop(window);

        this.tick();
    },

    initSounds: function() {
        soundManager.setup({
            // HTML5 audio only: Flash is end-of-life and the SWF fallback is no longer shipped.
            preferFlash: false,
            useHTML5Audio: true,
            useHighPerformance: false,
            onready: function() {
                Assets.loadSounds();
            }
        });
    },

    initCanvas: function() {
        this.canvas = document.getElementById('canvas');

        this.canvas.style.imageRendering = '-moz-crisp-edges';
        this.canvas.style.imageRendering = '-o-crisp-edges';
        this.canvas.style.imageRendering = '-webkit-optimize-contrast';
        this.canvas.style.imageRendering = 'crisp-edges';
        this.canvas.style.msInterpolationMode = 'nearest-neighbor';

        this.context = this.canvas.getContext('2d');
        this.context.imageSmoothingEnabled = false;
        this.context.webkitImageSmoothingEnabled = false;
        this.context.mozImageSmoothingEnabled = false;

        this.resize();
    },

    resize: function() {
        var w = window.innerWidth,
            h = window.innerHeight,
            s = (w > 1260 && h > 700) ? 3 : 2;

        this.canvas.width = config.display.width * s;
        this.canvas.height = config.display.height * s;
        config.display.realwidth = this.canvas.width;
        config.display.realheight = this.canvas.height;

        $('#ui').css('width', this.canvas.width);
        var uh = $('#ui').css('height').replace('px', '');
        $('#ui').css('padding-top', ~~ (h / 2 - uh / 2));
        $('#canvas').css('left', ~~ (w / 2 - this.canvas.width / 2) + "px").css('top', ~~ (h / 2 - this.canvas.height / 2) + "px");
        config.message.top = ~~ (h / 2 - 50);

        if (this.game && config.display.scale != s) {
            p.resizeDebug(s);
            config.display.scale = s;
            Assets.resizeAll();
        }

        config.display.scale = s;
    },

    update: function() {
        p.step();
        this.game.update();
    },

    clear: function() {
        if (!config.display.clearColor) {
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.context.fillStyle = config.display.clearColor;
            this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    },

    draw: function() {
        this.clear();

        this.game.draw();
        if (config.physics.debug) {
            p.draw();
        }
    },

    now: function() {
        return (window.performance && performance.now) ? performance.now() : Date.now();
    },

    tick: function() {
        requestAnimFrame(this.tick.bind(this));
        if (!this.game) return;

        var now = this.now();
        if (this.game.paused) {
            this.lastTime = now;
            this.accumulator = 0;
            this.draw();
            return;
        }

        // Cap the catch-up after a stall (e.g. a background tab) instead of
        // fast-forwarding the level.
        var elapsed = this.lastTime ? now - this.lastTime : 0;
        this.accumulator += Math.min(elapsed, this.tickMs * this.maxTicksPerFrame);
        this.lastTime = now;

        while (this.accumulator >= this.tickMs) {
            this.accumulator -= this.tickMs;
            config.tick = this.tickMs;
            config.time += this.tickMs;
            this.update();
            Input.update();
        }

        this.draw();
    }
});


module.exports = Engine;
