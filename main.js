// main test code for running the vorojs functions + showing results via threejs
// currently just a chopped up version of a basic threejs example

if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

var scene, camera, renderer;
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();

var controls;
var last_touch_for_camera = false;
function override_cam_controls() { // disable trackball controls
    controls.overrideState();
    controls.dragEnabled = false;
    last_touch_for_camera = false;
}

var bb_geometry;


var v3;
var xf_manager;

var datgui;
var settings;

//camera, renderer.domElement
XFManager = function (scene, camera, domEl, v3, override_other_controls) {
    this.controls = undefined;
    var _this = this;

    this.reset = function() {
        this.cells = [];
        this.plane = this.mouse_offset = this.geom = this.pts = this.mat = undefined;
        this.controls.detach();
    };
    this.init = function(scene, camera, domEl, v3, override_other_controls) {
        this.v3 = v3;
        this.scene = scene;
        this.camera = camera;
        this.domEl = domEl;
        this.controls = new THREE.TransformControls(camera, domEl);
        this.controls.addEventListener('objectChange', this.handle_moved); //moved_control
        this.controls.addEventListener('mouseDown', override_other_controls); //e.g. steal from camera
        this.scene.add(this.controls);
        this.reset();
    };


    this.update = function() {
        if (this.controls) this.controls.update();
    }

    this.update_previews = function() {
        for (var i=0; i<this.cells.length; i++) {
            // todo; actually set preview for all cells at once, not just one after the other in sequence
            if (this.v3.cell_type(this.cells[i]) === 0) {
                this.v3.set_preview(this.cells[i]);
            }
        }
    };

    this.handle_moved = function() {
        var ptspos = _this.pts.position;
        for (var i=0; i<_this.cells.length; i++) {
            // todo pull out the global pos of the corresponding individual pt in the geom.
            var newpos = ptspos.toArray();
            _this.v3.move_cell(_this.cells[i], newpos);
        }
        _this.update_previews();
        render();
    };

    this.detach = function() { if (this.controls) this.controls.detach(); };
    this.invis = function() { if (this.mat) this.mat.visible = false; };

    this.deselect = function() {
        this.detach();
        this.invis();
    };

    this.over_axis = function() { return this.controls && this.controls.axis; };
    this.dragging = function() { return this.controls && this.controls.visible && this.controls._dragging; };
    this.dragging_custom = function() { return this.mat && this.mat.visible && this.plane; };
    this.active = function() { return this.cells.length > 0 && this.mat && this.mat.visible; }

    this.drag_custom = function(mouse) {
        if (this.controls) {
            this.controls.axis = null; // make sure the transformcontrols are not active when the custom drag controls are active
        }
        var n = this.plane.normal;
        
        var pos = mouse.clone().add(this.mouse_offset);
        var caster = new THREE.Raycaster();
        caster.setFromCamera(pos, this.camera);
        
        var endpt = new THREE.Vector3();
        endpt.copy(caster.ray.direction);
        endpt.multiplyScalar(1000);
        endpt.add(caster.ray.origin);
        
        rayline = new THREE.Line3(caster.ray.origin, endpt);
        var newpos = this.plane.intersectLine(rayline);
        if (newpos && this.cells.length > 0) { // todo: make this not specific to single-cell case:
            this.v3.move_cell(this.cells[0], newpos.toArray());
            this.set_geom(newpos);
            this.update_previews();
        }
    }


    // todo: redesign this to take an array of cells
    this.set_geom = function(p) {
        if (!p) {
            this.invis();
            return;
        }
        if (!this.geom) {
            this.geom = new THREE.Geometry();
            this.geom.vertices.push(new THREE.Vector3());
            this.mat = new THREE.PointsMaterial( { size: .2, color: 0xff00ff, depthTest: false } );
            this.pts = new THREE.Points(this.geom, this.mat);
            this.pts.position.set(p.x, p.y, p.z);
            this.scene.add(this.pts);
            this.controls.attach(this.pts);
        } else {
            this.controls.attach(this.pts);
            this.mat.visible = true;
            this.pts.position.set(p.x, p.y, p.z);
        }
    };

    this.attach = function(cells) {
        this.cells = cells;
        if (this.cells.length > 0) {
            // todo pass set of cells to set_geom, post redesign????
            var n = camera.getWorldDirection();
            var p = new THREE.Vector3().fromArray(this.v3.cell_pos(this.cells[0]));
            this.plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, p);
            this.set_geom(p);
            render();
            var p_on_screen = p.project(camera);
            this.mouse_offset = p_on_screen.sub(mouse);
            this.update_previews();
        }
    };




    this.init(scene, camera, domEl, v3, override_other_controls);

    


}



Generators = {
    "uniform random": function(numpts, voro) {
        voro.add_cell([0,0,0], true);
        for (var i=0; i<numpts; i++) {
            voro.add_cell([Math.random()*20-10,Math.random()*20-10,Math.random()*20-10], false);
        }
        
    },
    "regular grid": function(numpts, voro) {
        var w = 9.9;
        var n = Math.floor(Math.cbrt(numpts));
        for (var i=0; i<n+1; i++) {
            for (var j=0; j<n+1; j++) {
                for (var k=0; k<n+1; k++) {
                    voro.add_cell([i*2*w/n-w,j*2*w/n-w,k*2*w/n-w], (i+j+k)%2==1);
                }
            }
        }
//        var lastcellid = voro.add_cell([0,0,0], true); // add seed to click
    },
    "degenerating grid": function(numpts, voro) {
        var w = 9.9;
        
        var n = Math.floor(Math.cbrt(numpts));
        var rfac = 1.0/n;
        for (var i=0; i<n+1; i++) {
            for (var j=0; j<n+1; j++) {
                for (var k=0; k<n+1; k++) {
                    var r = rfac*j;
                    voro.add_cell([i*2*w/n-w+Math.random()*r,j*2*w/n-w+Math.random()*r,k*2*w/n-w+Math.random()*r], (i+j+k)%2==1);
                }
            }
        }
    },
    "cylindrical columns": function(numpts, voro) {
        var n = Math.floor(Math.cbrt(numpts));
        var jitter = .1; // todo: expose jitter as param
        var w =9.99;
        voro.add_cell([0,0,0], true);
        for (var zi=0; zi<2*n+1; zi++) { // z
            var z = zi*w/n-w;
            for (var ri=0; ri<n*.5+1; ri++) { // radius
                var r = ri*(w-4)/(n*.5) + 4;
                for (var ti=0; ti<n+1; ti++) { // angle
                    var theta = ti*2*Math.PI/n;
                    voro.add_cell([r*Math.cos(theta)+Math.random()*jitter, r*Math.sin(theta)+Math.random()*jitter, z+Math.random()*jitter], ((zi%n)-ti)==0);
                }
            }
        }
    },
    "spherical spikes": function(numpts, voro) {
        for (var i = 0; i < numpts; i++) {
            var pt = [Math.random()*20-10,Math.random()*20-10,Math.random()*20-10];
            var radtrue = Math.sqrt(pt[0]*pt[0]+pt[1]*pt[1]+pt[2]*pt[2]);
            var rad = .55;//+rndn()*.002;
            if (i > numpts/2) {
                rad = .3+.25*(pt[2]+1)*(pt[2]+1)*.1+Math.random()*.05;
            }
            if (radtrue > .00000001) {
                for (var ii=0; ii<3; ii++) {
                    pt[ii]*=5*rad/radtrue;
                }
            }
            var radfinal = Math.sqrt(pt[0]*pt[0]+pt[1]*pt[1]+pt[2]*pt[2]);
            voro.add_cell(pt, radfinal < 4);
        }
    },
    "hexagonal prisms": function(numpts, voro) {
        var w = 9.9;
        var n = Math.floor(Math.cbrt(numpts));
        for (var i=0; i<n+1; i++) {
            for (var j=0; j<n+1; j++) {
                offset = (j%2)*(w/n);
                for (var k=0; k<n+1; k++) {
                    voro.add_cell([i*2*w/n-w,j*2*w/n-w,k*2*w/n-w+offset], (i+j+k)%2==1);
                }
            }
        }
    },
    "triangular prisms": function(numpts, voro) {
        var w = 9.9;
        var n = Math.floor(Math.cbrt(numpts/2));
        var o = (w/n);
        for (var i=0; i<2*n+1; i++) {
            var s = i%4;
            var ox = (s==0||s==1)?0:o;
            var oz = (i%2)*o*.5-o*.25;
            for (var j=0; j<n+1; j++) {
                for (var k=0; k<n+1; k++) {
                    voro.add_cell([i*w/n-w+oz,j*2*w/n-w+ox,k*2*w/n-w], (i+j+k)%2==1);
                }
            }
        }
    },
    "truncated octahedra": function(numpts, voro) {
        var w = 9.9;
        var n = Math.floor(Math.cbrt(numpts/2));
        var o = (w/n);
        for (var i=0; i<n+1; i++) {
            for (var j=0; j<n+1; j++) {
                for (var k=0; k<n+1; k++) {
                    voro.add_cell([i*2*w/n-w,j*2*w/n-w,k*2*w/n-w], (i+j+k)%2==1);
                    voro.add_cell([i*2*w/n-w+o,j*2*w/n-w+o,k*2*w/n-w+o], (i+j+k)%2==1);
                }
            }
        }
    },
    "gyrobifastigia": function(numpts, voro) {
        var w = 9.9;
        var n = Math.floor(Math.cbrt(numpts/2));
        var o = (w/n);
        for (var i=0; i<2*n+1; i++) {
            var s = i%4;
            var ox = (s==0||s==1)?0:o;
            var oy = (s==0||s==3)?0:o;
            for (var j=0; j<n+1; j++) {
                for (var k=0; k<n+1; k++) {
                    voro.add_cell([i*w/n-w,j*2*w/n-w+ox,k*2*w/n-w+oy], (i+j+k)%2==1);
                }
            }
        }
    },
    "rhombic dodecahedra": function(numpts, voro) {
        var w = 9.9;
        var n = Math.floor(Math.cbrt(numpts/4));
        var o = (w/n);
        for (var i=0; i<n+1; i++) {
            for (var j=0; j<n+1; j++) {
                for (var k=0; k<n+1; k++) {
                    voro.add_cell([i*2*w/n-w,j*2*w/n-w,k*2*w/n-w], (i+j+k)%2==1);
                    voro.add_cell([i*2*w/n-w+o,j*2*w/n-w+o,k*2*w/n-w], (i+j+k)%2==1);
                    voro.add_cell([i*2*w/n-w+o,j*2*w/n-w,k*2*w/n-w+o], (i+j+k)%2==1);
                    voro.add_cell([i*2*w/n-w,j*2*w/n-w+o,k*2*w/n-w+o], (i+j+k)%2==1);
                }
            }
        }
    },
    "elongated dodecahedra": function(numpts, voro) {
        var w = 9.9;
        var n = Math.floor(Math.cbrt(numpts/4));
        var o = (w/n);
        for (var i=0; i<n+1; i++) {
            var oxy = (i%2)*o;
            for (var j=0; j<n+1; j++) {
                for (var k=0; k<n+1; k++) {
                    voro.add_cell([i*2*w/n-w,j*2*w/n-w+oxy,k*2*w/n-w+oxy], (i+j+k)%2==1);
                }
            }
        }
    },
    "cubes with pillows": function(numpts, voro) {
        var w = 9.9;
        var n = Math.floor(Math.cbrt(numpts/4));
        var o = (w/n);
        for (var i=0; i<n+1; i++) {
            for (var j=0; j<n+1; j++) {
                for (var k=0; k<n+1; k++) {
                    voro.add_cell([i*2*w/n-w,j*2*w/n-w,k*2*w/n-w], (i+j+k)%2==1);
                    voro.add_cell([i*2*w/n-w+o,j*2*w/n-w,k*2*w/n-w], (i+j+k)%2==1);
                    voro.add_cell([i*2*w/n-w,j*2*w/n-w+o,k*2*w/n-w], (i+j+k)%2==1);
                    voro.add_cell([i*2*w/n-w,j*2*w/n-w,k*2*w/n-w+o], (i+j+k)%2==1);
                }
            }
        }
    }
};

var VoroSettings = function() {
    this.all_modes = ['camera', 'toggle', 'add/delete', 'move', 'move neighbor'];
    this.mode_index = function(name) {
        for (var i=0; i<this.all_modes.length; i++) {
            if (name === this.all_modes[i])
                return i;
        }
        return null;
    }
    this.next_mode = function() {
        var i = this.mode_index(this.mode);
        if (i != null) {
            this.mode = this.all_modes[(i+1)%this.all_modes.length];
            return;
        }
    }
    this.mode = 'toggle';
    // this.generator = 'uniform random';
    this.generator = 'cylindrical columns';
    this.numpts = 1000;
    this.seed = 'qq';
    this.fill_level = 0.0;
    
    this.regenerate = function() {
        xf_manager.reset();
        v3.generate(scene, [-10, -10, -10], [10, 10, 10], Generators[this.generator], this.numpts, this.seed, this.fill_level);
        render();
        
    };

    this.filename = 'filename';
    this.exportAsSTL = function() {
        var binstl = v3.get_binary_stl_buffer();
        var blob = new Blob([binstl], {type: 'application/octet-binary'});
        saveAs(blob, this.filename + ".stl");
    }
    this.downloadRaw = function() {
        var bin = v3.get_binary_raw_buffer();
        var blob = new Blob([bin], {type: 'application/octet-binary'});
        saveAs(blob, this.filename + ".vor");
    }
    this.uploadRaw = function() {
        document.getElementById('upload_raw').addEventListener('change', loadRawVoroFile, false);
        $("#upload_raw").trigger('click');
        return false;
    }
    this.save = function() {
        var bin = v3.get_binary_raw_buffer();
        var binstr = fromByteArray(new Uint8Array(bin));
        localStorage.setItem("saved_cells", binstr);
    }
    this.load = function() {
        var binstr = localStorage.getItem("saved_cells");
        if (binstr != null) {
            bin = toByteArray(binstr).buffer;
            var valid = v3.generate_from_buffer(scene, bin);
            if (!valid) {
                alert("Failed to load the saved voronoi diagram!  It might not have saved correctly, or there might be a bug in the loader!");
            }
        }
    }

};

function loadRawVoroFile(evt) {
    var files = evt.target.files;

    for (var i = 0, f; f = files[i]; i++) {
        var reader = new FileReader();
        reader.onload = function(event) {
            var valid = v3.generate_from_buffer(scene, event.target.result);
            if (!valid) {
                alert("Failed to load this voronoi diagram! It might not be a valid voronoi diagram file, or it might have been corrupted, or there might be a bug in file saving/loading!");
            }
        };
        reader.readAsArrayBuffer(f);
        
        break;
    }
    document.getElementById('upload_raw').value = null;
}



function wait_for_ready() {
    if (ready_for_emscripten_calls) {
        init();
    } else {
        requestAnimationFrame( wait_for_ready );
    }
}
wait_for_ready();



function init() {
    Math.seedrandom('qq');
    
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 30;



    // create voro structure w/ bounding box
    v3 = new Voro3();
    
    var lights = [];
    lights[0] = new THREE.DirectionalLight( 0xcc9999 );
    lights[1] = new THREE.DirectionalLight( 0x99cc99 );
    lights[2] = new THREE.DirectionalLight( 0x9999cc );
    
    lights[3] = new THREE.DirectionalLight( 0xff9999 );
    lights[4] = new THREE.DirectionalLight( 0x99ff99 );
    lights[5] = new THREE.DirectionalLight( 0x9999ff );
    
    lights[0].position.set( 0, 1, 0 );
    lights[1].position.set( 1, 0, 0 );
    lights[2].position.set( 0, 0, 1 );
    lights[3].position.set( 0,-1, 0 );
    lights[4].position.set(-1, 0, 0 );
    lights[5].position.set( 0, 0,-1 );
    
    scene.add( lights[0] );
    scene.add( lights[1] );
    scene.add( lights[2] );
    scene.add( lights[3] );
    scene.add( lights[4] );
    scene.add( lights[5] );
    
    var bb_geom = new THREE.BoxGeometry( 20, 20, 20 );
    var bb_mat = new THREE.MeshBasicMaterial( { wireframe: true } );
    bounding_box_mesh = new THREE.Mesh( bb_geom, bb_mat );
    var bb_edges = new THREE.EdgesHelper(bounding_box_mesh);
    scene.add(bb_edges);


    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setPixelRatio( window.devicePixelRatio );
    
    window.addEventListener( 'resize', onWindowResize, false );
    container = document.getElementById( 'container' );
    container.addEventListener( 'mousemove', onDocumentMouseMove, false );
    container.addEventListener( 'touchstart', onDocumentTouchStart, false );
    container.addEventListener( 'touchmove', onDocumentTouchMove, false );
    container.addEventListener( 'touchend', onDocumentTouchEnd, false );
    container.addEventListener( 'mousedown', onDocumentMouseDown, false );
    document.addEventListener( 'keydown', onDocumentKeyDown, false );
    container.addEventListener( 'mouseup', onDocumentMouseUp, false );

    
    container.appendChild( renderer.domElement );
    
    controls = new THREE.TrackballControls( camera, renderer.domElement );
    controls.rotateSpeed = 10.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 1.8;
    controls.noZoom = false;
    controls.noPan = false;
    controls.staticMoving = true;
    controls.dynamicDampingFactor = 0.3;
    controls.keys = [ 65, 83, 68 ];
    controls.addEventListener( 'change', render );

    xf_manager = new XFManager(scene, camera, renderer.domElement, v3, override_cam_controls);
    
    datgui = new dat.GUI();
    settings = new VoroSettings();
    
    var hasTouch = ('ontouchstart' in window) || (navigator.MaxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    if (hasTouch) {
        settings.all_modes.push("toggle off");
        settings.all_modes.push("delete");
    }
    datgui.add(settings,'mode',settings.all_modes);
    datgui.add(settings,'filename');
    datgui.add(settings,'exportAsSTL');
    datgui.add(settings,'downloadRaw');
    datgui.add(settings,'uploadRaw');
    datgui.add(settings,'save');
    datgui.add(settings,'load');
    
    var procgen = datgui.addFolder('Proc. Gen. Settings');
    
    procgen.add(settings,'seed');
    procgen.add(settings,'numpts').min(1);
    procgen.add(settings,'generator',Object.keys(Generators));
    var fill_controller = procgen.add(settings, 'fill_level', 0, 100);

    procgen.add(settings,'regenerate');

    procgen.open();
    
    settings.regenerate();
    
    animate();
    render();
}





function onDocumentKeyDown( event ) {
    if (event.keyCode === "S".charCodeAt()) {
        v3.voro.debug_print_block(171, 92);
        console.log("sanity checking ...");
        v3.sanity("after manual sanity check triggered");
    }
    if (event.keyCode === " ".charCodeAt()) {
        settings.next_mode();
        for (var i in datgui.__controllers) {
            datgui.__controllers[i].updateDisplay();
        }
    }
    if (event.keyCode === 27) {
        xf_manager.deselect();
    }
    // not sure this feature was actually useful ...
    // if (event.keyCode >= 'X'.charCodeAt() && event.keyCode <= 'Z'.charCodeAt()) {
    //     var axis = event.keyCode - 'X'.charCodeAt();
    //     controls.alignToAxis(axis);
    //     xf_manager.deselect();
    // }
    render();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    controls.handleResize();
    render();
}



function doToggleClick(button, mouse) {
    if (settings.mode === 'toggle' || settings.mode === 'toggle off') {
        xf_manager.deselect();
        if (button === 2 || settings.mode === 'toggle off') {
            var cell = v3.raycast(mouse, camera, raycaster);
            v3.toggle_cell(cell);
        } else {
            var cell = v3.raycast_neighbor(mouse, camera, raycaster);
            v3.toggle_cell(cell);
        }
        
        var nbr_cell = v3.raycast_neighbor(mouse, camera, raycaster);
        v3.set_preview(-1);
        // v3.set_preview(nbr_cell); // un-comment to make the next toggle preview pop up right away ... it's more responsive but feels worse to me.
    }
}

function doAddDelClick(button, mouse) {
    if (settings.mode === 'add/delete' || settings.mode === 'delete') {
        if (button === 2 || settings.mode === 'delete') {
            var cell = v3.raycast(mouse, camera, raycaster);
            v3.delete_cell(cell);
            xf_manager.deselect();
        } else {
            var pt = v3.raycast_pt(mouse, camera, raycaster);
            if (pt) {
                var added_cell = v3.add_cell(pt);
                xf_manager.attach([added_cell]);
            }
        }
    }
}

function startMove(mouse) {
    if (!xf_manager.active()) {
        if (settings.mode === 'move') {
            moving_cell_new = v3.raycast(mouse, camera, raycaster);
            xf_manager.attach([moving_cell_new]);
        }
        if (settings.mode === 'move neighbor') {
            moving_cell_new = v3.raycast_neighbor(mouse, camera, raycaster);
            xf_manager.attach([moving_cell_new]);
        }
    }
}

function onDocumentMouseDown(event) {
    doToggleClick(event.button, mouse);
    
    doAddDelClick(event.button, mouse);

    startMove(mouse);
    
    render();
}


function logv2(s,v){
    console.log(s + ": " + v.x + ", " + v.y);
}
function logv3(s,v){
    console.log(s + ": " + v.x + ", " + v.y + ", " + v.z);
}
function onDocumentMouseUp(event) {
    xf_manager.invis();
}
function onDocumentMouseMove( event ) {
    event.preventDefault();
    doCursorMove(event.clientX, event.clientY);
    check_allow_trackball();
}
function check_allow_trackball(over_moving_controls) {
    if (over_moving_controls===undefined) over_moving_controls = xf_manager.over_axis();
    if (!xf_manager.dragging()) {
        var cell = v3.raycast(mouse, camera, raycaster);
        if (!controls.isActive() || controls.isTouch()) {
            controls.dragEnabled = (cell < 0 || settings.mode === 'camera') && !over_moving_controls;
            if (!controls.dragEnabled && settings.mode === 'toggle') {
                var nbr_cell = v3.raycast_neighbor(mouse, camera, raycaster);
                v3.set_preview(nbr_cell);
            }
        }
    }
    return controls.dragEnabled;
}
function doCursorMove(cur_x, cur_y) {
    v3.set_preview(-1);
    
    mouse.x = ( cur_x / window.innerWidth ) * 2 - 1;
    mouse.y = - ( cur_y / window.innerHeight ) * 2 + 1;
    if (xf_manager.dragging_custom()) {
        xf_manager.drag_custom(mouse);
    }
    
    render();
}

function mouse_from_touch(event) {
    var cur_x = event.touches[0].clientX, cur_y = event.touches[0].clientY;
    mouse.x = ( cur_x / window.innerWidth ) * 2 - 1;
    mouse.y = - ( cur_y / window.innerHeight ) * 2 + 1;
}

function onDocumentTouchStart( event ) {
    event.preventDefault();

    mouse_from_touch(event);

    // ~~~ todo check if below section is needed ~~~
    // var moving_controls_check = moving_controls && moving_controls.checkHover(event);
    // var allowed = check_allow_trackball(moving_controls_check);
    // if (!allowed) {
    //     controls.overrideState();
    //     controls.dragEnabled = false;
    // }
    // last_touch_for_camera = controls.dragEnabled;
    // ~~~ todo check if above section is needed ~~~
    
    startMove(mouse);

}
function onDocumentTouchMove( event ) {
    event.preventDefault();
    mouse_from_touch(event);
    doCursorMove(event.touches[0].clientX, event.touches[0].clientY);

    if (!controls.dragEnabled && settings.mode === 'toggle') {
        var nbr_cell = v3.raycast_neighbor(mouse, camera, raycaster);
        v3.set_preview(nbr_cell);
    }
}
function onDocumentTouchEnd( event ) {
    xf_manager.invis();

    if (!last_touch_for_camera) {
        doToggleClick(event.button, mouse);
        
        doAddDelClick(event.button, mouse);
    }

    event.preventDefault();

}

function render() {
    xf_manager.update();
    renderer.render( scene, camera );
}

function animate() {  
    v3.do_chaos();
    render();  
    controls.update();

    requestAnimationFrame( animate );
}



