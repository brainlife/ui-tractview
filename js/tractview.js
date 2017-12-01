
var ndarray = require('ndarray');
var nifti = require('nifti-js');
var Plotly = require('plotly.js/lib/core');
Plotly.register([
    require('plotly.js/lib/histogram')
]);

Number.prototype.map = function (in_min, in_max, out_min, out_max) {
    return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

var TractView = {
    
    /**
     * Inits the tractography viewer
     * 
     * @param {String} config.selector -> Query selector for the element that will contain the tractview control
     * @param {Object[]} config.tracts -> Array containing name,color,and url for each tracts to load
     * 
     * (Optional)
     * @param {String} config.preview_scene_path -> Path to the scene to use which portrays the orientation of the brain
     */
    init: function(config) {
        if (!config) throw "Error: No config provided";
        
        var color_map, color_map_head, all_geometry = [], all_mesh = [], brainRotationX = -Math.PI/2;
        
        // set up for later
        config.num_fibers = 0;
        config.LRtractNames = {};
        
        if (typeof config.selector != 'string')
            throw "Error: config.selector not provided or not set to a string";
        if (typeof config.tracts != 'object')
            throw "Error: config.tracts not provided";
        
        var user_container = $(config.selector);
        if (user_container.length == 0)
            throw `Error: Selector '${config.selector}' did not match any elements`;
        
        populateHtml(user_container);
        
        var scene, camera;
        
        var view = user_container.find("#conview"),
            tinyBrain = user_container.find("#tinybrain"),
            controls_el = user_container.find("#controls"),
            container_toggles = user_container.find("#container_toggles"),
            tract_toggles_el = user_container.find("#tract_toggles"),
            hide_show_el = user_container.find("#hide_show"),
            hide_show_text_el = user_container.find("#hide_show_text"),
            nifti_select_el = user_container.find("#nifti_select");
        
        create_nifti_options();
        init_conview();
        
        function init_conview() {
            var renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
            var brainRenderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
            
            scene = new THREE.Scene();
            
            //camera
            camera = new THREE.PerspectiveCamera( 45, view.width() / view.height(), 1, 5000);
            var brainCam = new THREE.PerspectiveCamera( 45, tinyBrain.width() / tinyBrain.height(), 1, 5000 );
            camera.position.z = 200;
            
            //resize view
            function resized() {
                camera.aspect = view.width() / view.height();
                camera.updateProjectionMatrix();
                renderer.setSize(view.width(), view.height());
            }
            $(window).on('resize', resized);
            view.on('resize', resized);
            
            // add tiny brain (to show the orientation of the brain while the user looks at fascicles)
            var loader = new THREE.ObjectLoader();
            var tinyBrainScene, brainlight;
            
            if (config.preview_scene_path) {
                loader.load(config.preview_scene_path, _scene => {
                    tinyBrainScene = _scene;
                    var brainMesh = tinyBrainScene.children[1], unnecessaryDirectionalLight = tinyBrainScene.children[2];
                    // align the tiny brain with the model displaying fascicles
                    
                    brainMesh.rotation.z += Math.PI / 2;
                    brainMesh.material = new THREE.MeshLambertMaterial({color: 0xffcc99});
                    
                    tinyBrainScene.remove(unnecessaryDirectionalLight);
                    
                    var amblight = new THREE.AmbientLight(0x101010);
                    tinyBrainScene.add(amblight);
                    
                    brainlight = new THREE.PointLight(0xffffff, 1);
                    brainlight.radius = 20;
                    brainlight.position.copy(brainCam.position);
                    tinyBrainScene.add(brainlight);
                });
            }

            // sort + make non-LR based tracts appear first
            config.tracts.sort((_a, _b) => {
                var a = _a.name;
                var b = _b.name;
                var a_has_lr = isLeftTract(a) || isRightTract(a);
                var b_has_lr = isLeftTract(b) || isRightTract(b);
                
                if (a_has_lr && !b_has_lr) return 1;
                if (!a_has_lr && b_has_lr) return -1;
                
                if (a > b) return 1;
                if (a == b) return 0;
                return -1;
            });

            // make 'All' button that toggles everything on/off
            var checkbox_all = $('<input type="checkbox" id="checkbox_all" checked />');
            checkbox_all.on('change', e => {
                for (let tractName in config.LRtractNames) {
                    let toggle = config.LRtractNames[tractName];
                    if (toggle.left) {
                        if (toggle.left.checkbox[0].checked != e.target.checked) toggle.left.checkbox.click();
                        if (toggle.right.checkbox[0].checked != e.target.checked) toggle.right.checkbox.click();
                    }
                    else {
                        if (toggle.checkbox[0].checked != e.target.checked) toggle.checkbox.click();
                    }
                }
            });
            
            // add header toggles to controls
            tract_toggles_el.append(
                $('<tr/>').addClass('header').append([
                    $('<td><label class="all" for="checkbox_all">All</label></td>').append(checkbox_all),
                    $('<td><label>Left</label></td>'),
                    $('<td><label>Right</label></td>')
                ])
            );
            
            // group together tract names in the following way:
            // tractName -> { left: {tractNameLeft, mesh}, right: {tractNameRight, mesh} }
            // or tractName -> {mesh} if there are no children
            config.tracts.forEach(tract=>{

                //convert color array to THREE.Color
                tract.color = new THREE.Color(tract.color[0], tract.color[1], tract.color[2]);

                var rawName = tract.name.replace(/ [LR]$|^(Left|Right) /g, "");
                if (rawName != tract.name) {
                    config.LRtractNames[rawName] = config.LRtractNames[rawName] || {};
                    if (isLeftTract(tract.name)) config.LRtractNames[rawName].left = tract;
                    else config.LRtractNames[rawName].right = tract;
                }
                else config.LRtractNames[rawName] = tract;   // standalone, not left or right
            });
            
            // add tract toggles to controls
            for (let tractName in config.LRtractNames) {
                let subTracts = config.LRtractNames[tractName];
                
                // toggles that only have a name and a single checkbox
                if (!~Object.keys(subTracts).indexOf('left')) {
                    var row = makeToggle(tractName, {
                        hideRightToggle: true,
                        onchange_left: (left_checked) => {
                            subTracts.mesh.visible = left_checked;
                            subTracts._restore.visible = left_checked;
                            
                            // if (!left_checked) row.addClass('disabled');
                            // else row.removeClass('disabled');
                        },
                        onmouseenter: e => {
                            subTracts.mesh.visible = true;
                            subTracts.mesh.material.color = new THREE.Color(1, 1, 1);
                        },
                        onmouseleave: e => {
                            var restore = config.LRtractNames[tractName]._restore;
                            subTracts.mesh.visible = restore.visible;
                            subTracts.mesh.material.color = restore.color;
                        }
                    });
                    
                    subTracts.checkbox = row.checkbox_left;
                    subTracts._restore = {
                        visible: true,
                        color: subTracts.color,
                    };
                } else {
                    // toggles that have both L + R checkboxes, almost the same as code above, just done twice
                    let left = subTracts.left;
                    let right = subTracts.right;

                    var row = makeToggle(tractName, {
                        onchange_left: (left_checked, none_checked) => {
                            left.mesh.visible = left_checked;
                            left._restore.visible = left_checked;
                            // if (none_checked) row.addClass('disabled');
                            // else row.removeClass('disabled');
                        },
                        onchange_right: (right_checked, none_checked) => {
                            right.mesh.visible = right_checked;
                            right._restore.visible = right_checked;
                            // if (none_checked) row.addClass('disabled');
                            // else row.removeClass('disabled');
                        },
                        onmouseenter: e => {
                            left.mesh.visible = true;
                            left.mesh.material.color = new THREE.Color(1, 1, 1);
                            right.mesh.visible = true;
                            right.mesh.material.color = new THREE.Color(1, 1, 1);
                        },
                        onmouseleave: e => {
                            left.mesh.visible = left._restore.visible;
                            left.mesh.material.color = left._restore.color;
                            right.mesh.visible = right._restore.visible;
                            right.mesh.material.color = right._restore.color;
                        }
                    });
                    
                    left.checkbox = row.checkbox_left;
                    left._restore = {
                        visible: true,
                        color: subTracts.left.color, 
                    };
                    
                    right.checkbox = row.checkbox_right;
                    right._restore = {
                        visible: true, 
                        color: subTracts.right.color,
                    };
                }
                tract_toggles_el.append(row);
            }
            
            // configure hiding/showing the panel
            hide_show_text_el.text('Hide Controls');
            hide_show_el.on("click", e => {
                if (container_toggles.css('opacity') == '0') {
                    container_toggles.css({ 'max-width': '500px', 'opacity': 1 });
                    controls_el.css({ 'overflow-y': 'auto' });
                    hide_show_text_el.text('Hide Controls');
                }
                else {
                    hide_show_el.css('min-height', container_toggles.height() + 'px');
                    container_toggles.css({ 'max-width': '0px', 'opacity': 0 });
                    controls_el.css({ 'overflow-y': 'hidden' });
                    hide_show_text_el.text('Show Controls');
                }
            });
            
            // start loading the tract
            config.tracts.forEach((tract, i)=>{
                load_tract(tract, i, function(err, mesh, res) {
                    add_mesh_to_scene(mesh);
                    config.num_fibers += res.coords.length;
                    tract.mesh = mesh;
                });
            });
            
            renderer.autoClear = false;
            renderer.setSize(view.width(), view.height());
            view.append(renderer.domElement);

            brainRenderer.autoClear = false;
            brainRenderer.setSize(tinyBrain.width(), tinyBrain.height());
            tinyBrain.append(brainRenderer.domElement);

            //use OrbitControls and make camera light follow camera position
            var controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.autoRotate = true;
            controls.addEventListener('change', function() {
                //rotation changes
            });
            controls.addEventListener('start', function(){
                //use interacting with control
                controls.autoRotate = false;
            });
            function animate_conview() {
                controls.update();
                
                renderer.clear();
                renderer.clearDepth();
                renderer.render( scene, camera );
                
                // handle display of the tiny brain preview
                if (tinyBrainScene) {
                    // normalize the main camera's position so that the tiny brain camera is always the same distance away from <0, 0, 0>
                    var pan = controls.getPanOffset();
                    var pos3 = new THREE.Vector3(camera.position.x - pan.x, camera.position.y - pan.y, camera.position.z - pan.z).normalize();
                    brainCam.position.set(pos3.x * 10, pos3.y * 10, pos3.z * 10);
                    brainCam.rotation.copy(camera.rotation);
                    
                    brainlight.position.copy(brainCam.position);
                    
                    brainRenderer.clear();
                    brainRenderer.render(tinyBrainScene, brainCam);
                }

                requestAnimationFrame( animate_conview );
            }
            
            animate_conview();
        }
        
        // helper method for making toggles
        function makeToggle(tractName, options) {
            options = options || {};
            
            // row that contains the text of the toggle, as well as the left/right checkboxes
            let row = $("<tr/>"),
                td_label = $("<td/>"),
                label = $("<label/>"),
                td_left = $("<td/>"),
                checkbox_left = $("<input/>").attr({ 'type': 'checkbox', 'checked': true }),
                td_right = $("<td/>"),
                checkbox_right = $("<input/>").attr({ 'type': 'checkbox', 'checked': true });
            
            label.text(tractName);
            
            // mouse events
            row.on('mouseenter', e => {
                row.addClass('active');
                if (options.onmouseenter)
                    options.onmouseenter(e);
            });
            row.on('mouseleave', e => {
                row.removeClass('active');
                if (options.onmouseleave)
                    options.onmouseleave(e);
            });
            
            checkbox_left.on('change', e => {
                var left_checked = checkbox_left[0].checked,
                    right_checked = checkbox_right[0].checked || options.hideRightToggle;
                
                if (options.onchange_left)
                    options.onchange_left(left_checked, !left_checked && !right_checked);
            });
            checkbox_right.on('change', e => {
                var left_checked = checkbox_left[0].checked,
                    right_checked = checkbox_right[0].checked || options.hideRightToggle;
                
                if (options.onchange_right)
                    options.onchange_right(right_checked, !left_checked && !right_checked);
            });
            
            // add everything
            td_label.addClass('label').append(label);
            td_left.addClass('left').append(checkbox_left);
            td_right.addClass('right');
            if (!options.hideRightToggle)
                td_right.append(checkbox_right)
            
            row.addClass('row');
            row.append([td_label, td_left, td_right]);
            
            row.checkbox_left = checkbox_left;
            row.checkbox_right = checkbox_right;
            
            return row;
        }
        
        function load_tract(tract, index, cb) {
            $.get(tract.url, res => {
                var bundle = res.coords;

                var threads_pos = [];
                bundle.forEach(function(fascicle) {
                    
                    if (fascicle[0] instanceof Array)
                        fascicle = fascicle[0];
                    var xs = fascicle[0];
                    var ys = fascicle[1];
                    var zs = fascicle[2];

                    for(var i = 1;i < xs.length;++i) {
                        threads_pos.push(xs[i-1]);
                        threads_pos.push(ys[i-1]);
                        threads_pos.push(zs[i-1]);
                        threads_pos.push(xs[i]);
                        threads_pos.push(ys[i]);
                        threads_pos.push(zs[i]);
                    }
                });

                //now show bundle
                var vertices = new Float32Array(threads_pos);
                var geometry = new THREE.BufferGeometry();
                geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3 ) );
                
                geometry.tract = tract;
                geometry.vertices = vertices;
                geometry.tract_index = index;
                all_geometry.push(geometry);
                
                cb(null, calculateMesh(geometry), res);
            });
        }
        
        // returns whether or not the tractName is considered to be a left tract
        function isLeftTract(tractName) {
            return tractName.startsWith('Left ') || tractName.endsWith(' L');
        }
        // returns whether or not the tractName is considered to be a right tract
        function isRightTract(tractName) {
            return tractName.startsWith('Right ') || tractName.endsWith(' R');
        }
        
        function add_mesh_to_scene(mesh) {
            mesh.rotation.x = brainRotationX;
            all_mesh.push(mesh);
            scene.add(mesh);
        }
        
        function calculateMesh(geometry) {
            
            if (nifti_select_el.val() == 'rainbow') {
                var vertexShader = `attribute vec3 col;
                                    varying vec3 vColor;
                                    
                                    void main(){
                                        vColor = col;
                                        
                                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                                    }`;

                    var fragmentShader = `varying vec3 vColor;
                                            
                                        void main(){
                                            gl_FragColor = vec4( vColor.rgb, 1.0 );
                                        }`;

                    var cols = [];
                    for (var i = 0; i < geometry.vertices.length; i += 3) {
                        var l = Math.sqrt(geometry.vertices[i] * geometry.vertices[i] + geometry.vertices[i + 1] * geometry.vertices[i + 1] + geometry.vertices[i + 2] * geometry.vertices[i + 2]);
                        
                        cols.push(geometry.vertices[i] / l);
                        cols.push(geometry.vertices[i + 1] / l);
                        cols.push(geometry.vertices[i + 2] / l);
                    }
                    geometry.addAttribute('col', new THREE.BufferAttribute(new Float32Array(cols), 3));
                    
                    var m = new THREE.LineSegments( geometry, new THREE.ShaderMaterial({
                        vertexShader,
                        fragmentShader
                    }) );
                    config.tracts[geometry.tract_index].mesh = m;
                    
                    return m;
            }
            else if (color_map) {
                var vertexShader = `attribute vec3 col;
                                    varying vec3 vColor;
                                    
                                    void main(){
                                        vColor = col;
                                        
                                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                                    }`;

                var fragmentShader = `varying vec3 vColor;
                                      
                                      void main(){
                                          gl_FragColor = vec4( vColor.rgb, 1.0 );
                                      }`;
                
                var cols = [];
                for (var i = 0; i < geometry.vertices.length; i += 3) {
                    // var l = Math.sqrt(geometry.vertices[i] * geometry.vertices[i] + geometry.vertices[i + 1] * geometry.vertices[i + 1] + geometry.vertices[i + 2] * geometry.vertices[i + 2]);
                    
                    // cols.push(geometry.vertices[i] / l);
                    // cols.push(geometry.vertices[i + 1] / l);
                    // cols.push(geometry.vertices[i + 2] / l);
                    
                    var x_ = geometry.vertices[i],
                        y_ = geometry.vertices[i + 1],
                        z_ = geometry.vertices[i + 2];
                    
                        /*
                    var x_ = x__,
                        y_ = y__ * Math.cos(brainRotationX) - z__ * Math.sin(brainRotationX),
                        z_ = y__ * Math.sin(brainRotationX) + z__ * Math.cos(brainRotationX);
                        */
                    
                    x_ = Math.round((x_ - color_map_head.spaceOrigin[0]) / color_map_head.thicknesses[0]);
                    y_ = Math.round((y_ - color_map_head.spaceOrigin[1]) / color_map_head.thicknesses[1]);
                    z_ = Math.round((z_ - color_map_head.spaceOrigin[2]) / color_map_head.thicknesses[2]);
                    
                    /*
                    x_ = Math.round((x_/color_map_head.thicknesses[0]) - color_map_head.spaceOrigin[0]);
                    y_ = Math.round((y_/color_map_head.thicknesses[1]) - color_map_head.spaceOrigin[1]);
                    z_ = Math.round((z_/color_map_head.thicknesses[2]) - color_map_head.spaceOrigin[2]);
                    */
                    // rotation.x = -Math.PI/2
                    
                    var weight = color_map.get(z_, y_, x_);
                    //weight = (weight - color_map.min) * (1- 0.5) / (color_map.max - color_map.min) + 0.5;
                    weight = (weight - color_map.min) / (color_map.max - color_map.min);
                    //weight = Math.exp(weight) / Math.E; 
                    weight = Math.pow(weight, 1/4);
                    /*
                    var weight = color_map.get(z_, y_, x_);
                    if(i % 10000 == 0) {
                        console.log(weight, weight.map(color_map.min, color_map.max, 0, 1));
                    }
                    weight = weight.map(color_map.min, color_map.max, 0, 0.5);
                    */
                    cols.push(weight);
                    cols.push(weight);
                    cols.push(weight);
                    /*
                    if (color_map.shape.length == 3) {
                        //var weight = Math.pow( color_map.get(x_, y_, z_), 1/6);
                        var weight = color_map.get(z_, y_, x_);
                        if(weight>0 && i % 1000 == 0) console.log(weight);
                        cols.push(weight*10);
                        cols.push(weight*10);
                        cols.push(weight*10);
                    }
                    else if (color_map.shape.length == 4 && color_map.shape[color_map.shape.length - 1] == 3) {
                        cols.push(color_map.get(x_, y_, z_, 0) / 255);
                        cols.push(color_map.get(x_, y_, z_, 1) / 255);
                        cols.push(color_map.get(x_, y_, z_, 2) / 255);
                    }
                    else
                        throw `Unsupported color_map_shape: ${color_map.shape}`;
                        */
                    
                }
                geometry.addAttribute('col', new THREE.BufferAttribute(new Float32Array(cols), 3));
                
                var m = new THREE.LineSegments( geometry, new THREE.ShaderMaterial({
                    vertexShader,
                    fragmentShader
                }) );
                config.tracts[geometry.tract_index].mesh = m;
                
                return m;
            }
            else {
                var m = new THREE.LineSegments( geometry, new THREE.LineBasicMaterial({
                    color: geometry.tract.color,
                    transparent: true,
                    opacity: 0.7
                }) );
                config.tracts[geometry.tract_index].mesh = m;
                
                return m;
            }    
        }
        
        function recalculateMaterials() {
            while (all_mesh.length)
                scene.remove(all_mesh.pop());
            
            all_geometry.forEach(geometry => {
                add_mesh_to_scene( calculateMesh(geometry) );
            });
        }
        
        function create_nifti_options() {
            nifti_select_el.append($("<option/>").html("None").val('none'));
            nifti_select_el.append($("<option/>").html("Rainboww!! :D").val('rainbow'));
            
            if (config.niftis) {
                config.niftis.forEach(nifti => {
                    nifti_select_el.append($("<option/>").text(nifti.filename).val(nifti.url));
                });
                
                nifti_select_el.on('change', function() {
                    if (nifti_select_el.val() == 'none' || nifti_select_el.val() == 'rainbow') {
                        color_map = undefined;
                        recalculateMaterials();
                        return;
                    }
                    
                    fetch(nifti_select_el.val())
                    .then(res => res.arrayBuffer())
                    .then(function(buffer) {
                        // console.log(nifti.parseHeader(pako.inflate(buffer)),
                        //             nifti.parseNIfTIHeader(pako.inflate(buffer)),
                        //             nifti.parse(pako.inflate(buffer)));
                        
                        var raw = pako.inflate(buffer);
                        var N = nifti.parse(raw);
                        
                        color_map_head = nifti.parseHeader(raw);
                        color_map = ndarray(N.data, N.sizes.slice().reverse());

                        //find min/max
                        color_map.min = N.data[0];
                        color_map.max = N.data[0];
                        N.data.forEach(v=>{
                            if(v > color_map.max) color_map.max = v;
                            if(v < color_map.min) color_map.min = v;
                        });
                        console.log("here");
                        console.log(color_map);
                        
                        recalculateMaterials();
                    })
                    .catch(err => console.error);
                });
            }
        }
        
        function populateHtml(element) {
            element.html(`
            <div class="container">
                <!-- Main Connectome View -->
                <div id="conview" class="conview"></div>
                
                <!-- Tiny Brain to Show Orientation -->
                <div id="tinybrain" class="tinybrain"></div>
                
                <div id="controls" class="controls">
                    <div style="display:flex;">
                        <!-- Hide/Show Panel -->
                        <div id="hide_show" class="hide_show">
                            <div class="table">
                                <div class="cell">
                                    <div class="rotated" id="hide_show_text"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Fascicle Toggling -->
                        <div class="container_toggles" id="container_toggles">
                            <table class="tract_toggles" id="tract_toggles"></table>
                            
                            <!-- Nifti Choosing -->
                            <div class="nifti_chooser">
                                <select id="nifti_select" class="nifti_select"></select>
                            </div>
                        </div>
                        
                    </div>
                </div>
            </div>
            
            <style scoped>
                .container {
                    width: 100%;
                    height: 100%;
                    padding: 0px;
                }
                .conview {
                    width:100%;
                    height: 100%;
                    background:black;
                }
                .tinybrain {
                    position:absolute;
                    pointer-events:none;
                    left:0;
                    bottom:0;
                    width:100px;
                    height:100px;
                }
                
                .controls {
                    display:inline-block;
                    position:absolute;
                    right:0;
                    top:0;
                    width:auto;
                    height:auto;
                    max-height:100%;
                    padding-left:1px;
                    overflow-x:hidden;
                    overflow-y:auto;
                    white-space:nowrap;
                    font-family:Roboto;
                    font-size:12px;
                    background:rgba(0, 0, 0, .7);
                }
                
                .hide_show {
                    display:inline-block;
                    position:relative;
                    vertical-align:top;
                    text-align:left;
                    width:auto;
                    flex:1;
                    color: #777;
                    overflow:hidden;
                    cursor:default;
                    transition:background 1s, color 1s;
                }
                .hide_show:hover {
                    background:black;
                    color:white;
                }
                
                /* Hide/Show Vertical Alignment */
                .parent {
                    padding-right:4px;
                }
                .list-group-item.table {
                    height:auto !important;
                }
                .table {
                    display:table;
                    height:100%;
                    margin-bottom:0 !important;
                }
                .cell {
                    display:table-cell;
                    vertical-align:middle;
                }
                
                .hide_show .rotated {
                    display:inline-block;
                    min-width:16px;
                    max-width:16px;
                    vertical-align:middle;
                    transform:rotate(-90deg);
                }
                
                .container_toggles {
                    display:inline-block;
                    max-width:500px;
                    width:auto;
                    height:auto;
                    padding-top:2px;
                    overflow:hidden;
                    transition:max-width .5s, opacity .5s, padding .5s;
                }
                
                label {
                    font-weight:100;
                    font-size:12px;
                }
                tr.header {
                    color:white;
                    text-align:center;
                    margin:0;
                }
                tr.header label {
                    margin-right:4px;
                    cursor:pointer;
                }
                
                input[type="checkbox"] {
                    vertical-align:middle;
                    margin:0;
                    cursor:pointer;
                }
                
                td.label {
                    text-overflow:ellipsis;
                }
                
                tr.row.disabled {
                    opacity:.5;
                }
                tr.row label {
                    color:#ccc;
                }
                tr.row.active label {
                    color:#fff;
                }
            </style>
            `);
        }
    }
    
};

module.exports = TractView;
