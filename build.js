#!/usr/bin/env node
'use strict';

// Build script for TransCube.
//
//   node build.js                    development build into build/
//   node build.js --release          release build into dist/
//   node build.js --serve            development build, serve it on
//                                    http://localhost:8000 and rebuild on change
//   node build.js --release --serve  release build, served from dist/
//
// The game loads its levels with XHR, so it must be served over http://;
// opening index.html straight from disk does not work.

var fs = require('fs');
var http = require('http');
var path = require('path');

var esbuild = require('esbuild');
var less = require('less');
var pug = require('pug');

var ROOT = __dirname;
var DEV = path.join(ROOT, 'dev');
var args = process.argv.slice(2);
var release = args.indexOf('--release') !== -1;
var serve = args.indexOf('--serve') !== -1;
var OUT = path.join(ROOT, release ? 'dist' : 'build');
var PORT = Number(process.env.PORT) || 8000;

var pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
var banner = '/*! ' + pkg.name + ' - v' + pkg.version + ' */';

function out() {
    return path.join.apply(path, [OUT].concat([].slice.call(arguments)));
}

function write(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
}

function html() {
    write(out('index.html'), pug.compileFile(path.join(DEV, 'index.pug'))({ dev: !release }));
}

function css() {
    var file = path.join(DEV, 'css', 'main.less');
    return less.render(fs.readFileSync(file, 'utf8'), {
        filename: file,
        compress: release,
        sourceMap: release ? undefined : { sourceMapFileInline: true, outputSourceFiles: true }
    }).then(function(result) {
        write(out('css', 'main.css'), result.css);
    });
}

function js() {
    return esbuild.build({
        entryPoints: [path.join(DEV, 'js', 'main.js')],
        bundle: true,
        format: 'iife',
        outfile: out('js', release ? 'main.min.js' : 'main.js'),
        minify: release,
        sourcemap: release ? false : 'inline',
        banner: { js: banner },
        logLevel: 'warning'
    });
}

function libs() {
    [
        [path.join(DEV, 'js', 'lib', 'soundmanager2-nodebug-jsmin.js'), 'soundmanager2-nodebug-jsmin.js'],
        [require.resolve('jquery/dist/jquery.min.js'), 'jquery.min.js'],
        [require.resolve('jquery-color/dist/jquery.color.min.js'), 'jquery.color.min.js']
    ].forEach(function(lib) {
        fs.mkdirSync(out('js'), { recursive: true });
        fs.copyFileSync(lib[0], out('js', lib[1]));
    });
}

function media() {
    ['img', 'sounds', 'music', 'fonts'].forEach(function(dir) {
        fs.cpSync(path.join(DEV, 'media', dir), out('media', dir), { recursive: true });
    });
}

// Reduces Tiled's JSON export to what the game reads: layers keyed by name,
// with tile data or objects under `data`.
function levels() {
    var src = path.join(DEV, 'media', 'data', 'levels');
    fs.readdirSync(src).filter(function(f) {
        return path.extname(f) === '.json';
    }).forEach(function(f) {
        var name = path.basename(f, '.json');
        var level = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
        var result = {
            name: name,
            tileheight: level.tileheight,
            tilewidth: level.tilewidth,
            height: level.height,
            width: level.width,
            properties: level.properties || {},
            layers: {}
        };

        level.layers.forEach(function(layer) {
            result.layers[layer.name] = {
                data: layer.type === 'tilelayer' ? layer.data : layer.objects,
                name: layer.name,
                type: layer.type,
                properties: layer.properties || {}
            };
        });

        write(out('media', 'data', 'levels', f), JSON.stringify(result));
    });
}

function buildAll() {
    fs.rmSync(OUT, { recursive: true, force: true });
    html();
    libs();
    media();
    levels();
    return Promise.all([css(), js()]);
}

// Rebuild only what a changed source file affects.
function rebuild(file) {
    var rel = path.relative(DEV, file).split(path.sep).join('/');
    var step;
    if (rel.indexOf('js/') === 0) step = js;
    else if (rel.indexOf('css/') === 0) step = css;
    else if (rel.indexOf('media/data/levels/') === 0) step = levels;
    else if (rel.indexOf('media/') === 0) step = media;
    else if (/\.pug$/.test(rel)) step = html;
    if (!step) return Promise.resolve();
    return Promise.resolve().then(step).then(function() {
        console.log('rebuilt (' + rel + ')');
    });
}

var TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.eot': 'application/vnd.ms-fontobject',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff'
};

// Minimal static file server for local play. Listens on the loopback
// interface only and never serves anything outside the output folder.
function startServer() {
    var server = http.createServer(function(req, res) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405, { Allow: 'GET, HEAD' });
            return res.end();
        }

        var pathname;
        try {
            pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        } catch (e) {
            pathname = null;
        }
        if (!pathname || pathname.indexOf('\0') !== -1) {
            res.writeHead(400);
            return res.end();
        }
        if (pathname.endsWith('/')) pathname += 'index.html';

        var file = path.resolve(OUT, '.' + pathname);
        if (file !== OUT && file.indexOf(OUT + path.sep) !== 0) {
            res.writeHead(403);
            return res.end();
        }

        fs.stat(file, function(err, stat) {
            if (err || !stat.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end('Not found');
            }
            res.writeHead(200, {
                'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
                'Content-Length': stat.size,
                'Cache-Control': 'no-cache',
                'X-Content-Type-Options': 'nosniff'
            });
            if (req.method === 'HEAD') return res.end();
            fs.createReadStream(file).pipe(res);
        });
    });

    server.listen(PORT, '127.0.0.1', function() {
        console.log('TransCube is running at http://localhost:' + PORT + '/  (Ctrl+C to stop)');
    });
}

function watch() {
    var timers = {};
    fs.watch(DEV, { recursive: true }, function(event, name) {
        if (!name) return;
        var file = path.join(DEV, name);
        clearTimeout(timers[file]);
        timers[file] = setTimeout(function() {
            delete timers[file];
            rebuild(file).catch(function(err) {
                console.error(err.message || err);
            });
        }, 100);
    });
    console.log('Watching dev/ for changes.');
}

buildAll().then(function() {
    console.log((release ? 'Release' : 'Development') + ' build written to ' + path.relative(ROOT, OUT) + '/');
    if (serve) {
        startServer();
        if (!release) watch();
    }
}).catch(function(err) {
    console.error(err.message || err);
    process.exit(1);
});
