(function() {
    'use strict';
    let debounce_hashupdate;

    Vue.component('tractview', {
        props: [ "config" ],

        data () {
            return {
                load_percentage: 1,

                all_left: true,
                all_right: true,
                visible: true,

                meshes: [],

                dataMin: 0,
                dataMax: 0,
                gamma: 1,

                color_map: null,
                color_map_head: null,
                hist: [],
                focused: {},

                scene: null,
                renderer: null,
                camera: null,
                controls: null,

                tinyBrainScene: null,
                tinyBrainCam: null,
                brainRenderer: null,

                niftis: [],
                selectedNifti: null,
            };
        },

        mounted() {
            this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            this.brainRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            this.scene = new THREE.Scene();

            // camera
            let viewbox = this.$refs.view.getBoundingClientRect();
            let tinybrainbox = this.$refs.tinybrain.getBoundingClientRect();

            this.camera = new THREE.PerspectiveCamera(45, viewbox.width / viewbox.height, 1, 5000);
            this.tinyBrainCam = new THREE.PerspectiveCamera(45, tinybrainbox.width / tinybrainbox.height, 1, 5000);

            this.camera.position.z = 200;

            window.addEventListener("resize", this.resized);

            // add tiny brain (to show the orientation of the brain while the user looks at fascicles)
            let loader = new THREE.ObjectLoader();

            loader.load('models/brain.json', _scene => {
                this.tinyBrainScene = _scene;
                let brainMesh = this.tinyBrainScene.children[1],
                unnecessaryDirectionalLight = this.tinyBrainScene.children[2];
                // align the tiny brain with the model displaying fascicles

                brainMesh.rotation.z += Math.PI / 2;
                brainMesh.material = new THREE.MeshLambertMaterial({ color: 0xffcc99 });

                this.tinyBrainScene.remove(unnecessaryDirectionalLight);

                let amblight = new THREE.AmbientLight(0x101010);
                this.tinyBrainScene.add(amblight);

                this.brainlight = new THREE.PointLight(0xffffff, 1);
                this.brainlight.radius = 20;
                this.brainlight.position.copy(this.tinyBrainCam.position);
                this.tinyBrainScene.add(this.brainlight);
            });

            // start loading the tract
            let idx = 0;
            async.eachLimit(this.config.tracts, 3, (tract, next_tract) => {
                this.load_tract(tract, idx++, (err, mesh) => {
                    if (err) return next_tract(err);
                    this.add_mesh_to_scene(mesh);
                    this.load_percentage = idx / this.config.tracts.length;
                    // this.config.num_fibers += res.coords.length;
                    tract.mesh = mesh;
                    next_tract();
                });
            }, console.log);


            this.renderer.autoClear = false;
            this.renderer.setSize(viewbox.width, viewbox.height);
            this.renderer.setClearColor(new THREE.Color(.5,.5,.5));
            this.$refs.view.appendChild(this.renderer.domElement);

            this.brainRenderer.autoClear = false;
            this.brainRenderer.setSize(tinybrainbox.width, tinybrainbox.height);
            this.$refs.tinybrain.appendChild(this.brainRenderer.domElement);

            // use OrbitControls and make camera light follow camera position
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);

            let info_string = getHashValue('where');
            if (info_string) {
                let info = info_string.split('/');
                let pos = (info[0] || '').split(';');
                let orig = (info[1] || '').split(';');

                if (pos) {
                    this.camera.position.x = +pos[0];
                    this.camera.position.y = +pos[1];
                    this.camera.position.z = +pos[2];
                }
                if (orig) {
                    this.controls.target.x = +orig[0];
                    this.controls.target.y = +orig[1];
                    this.controls.target.z = +orig[2];

                    this.controls.setPubPanOffset(+orig[0], +orig[1], +orig[2]);
                }
            } else this.controls.autoRotate = true;

            this.controls.addEventListener('change', e=>{
                let pan = this.controls.getPanOffset();

                //update URL hash
                clearTimeout(debounce_hashupdate);
                debounce_hashupdate = setTimeout(()=>{
                    let pos_params = [ 
                        this.round(this.camera.position.x), 
                        this.round(this.camera.position.y), 
                        this.round(this.camera.position.z)
                    ].join(";");
                    let target_params = [ 
                        this.round(this.controls.target.x), 
                        this.round(this.controls.target.y), 
                        this.round(this.controls.target.z)
                    ].join(";");
                    window.location.hash = "where=" + pos_params + "/" + target_params;
                }, 100);
            });

            this.controls.addEventListener('start', ()=>{
                // use interacting with control
                // gamma_input_el.trigger({ type: 'blur' })
                this.controls.autoRotate = false;
            });

            // gamma_input_el.on('change', gamma_changed)
            // gamma_input_el.on('keyup', gamma_changed)
            // this.updateAllShaders()
            this.appendStyle();

            this.animate_conview();

            if (this.config.layers) {
                this.config.layers.forEach(layer => {
                    let condensed_filename = layer.url;
                    if (condensed_filename.indexOf('/') != -1) condensed_filename = condensed_filename.substring(condensed_filename.lastIndexOf('/')+1);
                    this.niftis.push({ user_uploaded: false, url: layer.url, user_uploaded: false, filename: condensed_filename });
                });
                this.selectedNifti = null;
            }
        },

        methods: {
            animate_conview: function() {
                this.controls.enableKeys = !this.inputFocused();
                this.controls.update();

                this.renderer.clear();
                this.renderer.clearDepth();
                this.renderer.render(this.scene, this.camera);

                // handle display of the tiny brain preview
                if (this.tinyBrainScene) {
                    // normalize the main camera's position so that the tiny brain camera is always the same distance away from <0, 0, 0>
                    let pan = this.controls.getPanOffset();
                    let pos3 = new THREE.Vector3(
                            this.camera.position.x - pan.x,
                            this.camera.position.y - pan.y,
                            this.camera.position.z - pan.z
                            ).normalize();
                    this.tinyBrainCam.position.set(pos3.x * 10, pos3.y * 10, pos3.z * 10);
                    this.tinyBrainCam.rotation.copy(this.camera.rotation);

                    this.brainlight.position.copy(this.tinyBrainCam.position);

                    this.brainRenderer.clear();
                    this.brainRenderer.render(this.tinyBrainScene, this.tinyBrainCam);
                }

                requestAnimationFrame(this.animate_conview);
            },

            round: function(v) {
                return Math.round(v * 1e3) / 1e3;
            },

            tractFocus: function(LR, basename) {
                if (this.load_percentage == 1) {
                    this.focused[basename] = true;

                    if (LR.left) {
                        LR.left.material_previous = LR.left.material;
                        LR.left.material = white_material;
                    }
                    if (LR.right) {
                        LR.right.material_previous = LR.right.material;
                        LR.right.material = white_material;
                    }
                }
            },

            tractUnfocus: function(LR, basename) {
                if (this.load_percentage == 1) {
                    this.focused[basename] = false;

                    if (LR.left && LR.left.material_previous) LR.left.material = LR.left.material_previous;
                    if (LR.right && LR.right.material_previous) LR.right.material = LR.right.material_previous;
                }
            },

            resized: function () {
                var viewbox = this.$refs.view.getBoundingClientRect();

                this.camera.aspect = viewbox.width / viewbox.height;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(viewbox.width, viewbox.height);
            },

            load_tract: function(tract, index, cb) {
                fetch(tract.url).then(res=>{
                    return res.json();
                }).then(json=>{
                    var bundle = json.coords;

                    //convert each bundle to threads_pos array
                    var threads_pos = [];
                    bundle.forEach(function(fascicle) {
                        if (Array.isArray(fascicle[0])) fascicle = fascicle[0]; //for backward compatibility
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

                    //then convert that to bufferedgeometry
                    var vertices = new Float32Array(threads_pos);
                    var geometry = new THREE.BufferGeometry();
                    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3 ) );
                    geometry.vertices = vertices;
                    geometry.tract_index = index;
                    geometry.tract = tract; //metadata..

                    let mesh = this.calculateMesh(geometry);
                    mesh.name = tract.name;

                    cb(null, mesh);
                });
            },

            calculateMesh: function(geometry, mesh) {
                if (this.color_map) {
                    var vertexShader = `
                        attribute vec4 color;
                        varying vec4 vColor;

                        void main(){
                            vColor = color;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `;

                    var fragmentShader = `
                        varying vec4 vColor;
                        uniform float dataMin;
                        uniform float dataMax;
                        uniform float gamma;

                        float transformify(float value) {
                            return pow(value / dataMax, 1.0 / gamma) * dataMax;
                        }

                        void main(){
                            gl_FragColor = vec4(transformify(vColor.r), transformify(vColor.g), transformify(vColor.b), vColor.a);
                        }
                    `;

                    var cols = [];
                    var hist = [];
                    for (var i = 0; i < geometry.vertices.length; i += 3) {
                        //convert webgl to voxel coordinates
                        var vx, vy, vz;
                        if (i == geometry.vertices.length - 3) {
                            vx = geometry.vertices[i];
                            vy = geometry.vertices[i+1];
                            vz = geometry.vertices[i+2];
                        } else {
                            vx = (geometry.vertices[i] + geometry.vertices[i+3])/2;
                            vy = (geometry.vertices[i+1] + geometry.vertices[i+4])/2;
                            vz = (geometry.vertices[i+2] + geometry.vertices[i+5])/2;
                        }

                        var x = Math.round((vx - this.color_map_head.spaceOrigin[0]) / this.color_map_head.thicknesses[0]);
                        var y = Math.round((vy - this.color_map_head.spaceOrigin[1]) / this.color_map_head.thicknesses[1]);
                        var z = Math.round((vz - this.color_map_head.spaceOrigin[2]) / this.color_map_head.thicknesses[2]);

                        //find voxel value
                        var v = this.color_map.get(z, y, x);
                        if (isNaN(v)) {
                            // if the color is invalid, then just gray out that part of the tract
                            cols.push(.5);
                            cols.push(.5);
                            cols.push(.5);
                            cols.push(1.0);
                        } else {
                            var normalized_v = (v - this.dataMin) / (this.dataMax - this.dataMin);
                            var overlay_v = (v - this.sdev_m5) / (this.sdev_5 - this.sdev_m5);

                            //clip..
                            // if(normalized_v < 0.1) normalized_v = 0.1;
                            // if(normalized_v > 1) normalized_v = 1;

                            if(overlay_v < 0.1) overlay_v = 0.1;
                            if(overlay_v > 1) overlay_v = 1;

                            //compute histogram
                            var hv = Math.round(normalized_v*256);
                            var glob_hv = Math.round(normalized_v * 100);
                            hist[hv] = (hist[hv] || 0) + 1;
                            this.hist[glob_hv] = (this.hist[glob_hv] || 0) + 1;

                            if (Array.isArray(geometry.tract.color)) {
                                cols.push(geometry.tract.color[0] * overlay_v);
                                cols.push(geometry.tract.color[1] * overlay_v);
                                cols.push(geometry.tract.color[2] * overlay_v);
                                cols.push(1.0);
                            }
                            else {
                                cols.push(geometry.tract.color.r * overlay_v);
                                cols.push(geometry.tract.color.g * overlay_v);
                                cols.push(geometry.tract.color.b * overlay_v);
                                cols.push(1.0);
                            }
                        }
                    }
                    geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(cols), 4));
                    let material = new THREE.ShaderMaterial({
                        vertexShader,
                        fragmentShader,
                        uniforms: {
                            "gamma": { value: this.gamma },
                            "dataMin": { value: 1 },
                            "dataMax": { value: 1 },
                        },
                        transparent: true,
                    });

                    if (mesh) {
                        mesh.geometry = geometry;
                        mesh.material = material;
                        return mesh;
                    } else {
                        var m = new THREE.LineSegments( geometry, material );

                        this.config.tracts[geometry.tract_index].mesh = m;
                        return m;
                    }
                }

                var material;
                if (Array.isArray(geometry.tract.color)) {
                    material = new THREE.LineBasicMaterial({
                        color: new THREE.Color(geometry.tract.color[0], geometry.tract.color[1], geometry.tract.color[2]),
                        transparent: true,
                        opacity: 0.7,
                    });
                } else {
                    material = new THREE.LineBasicMaterial({
                        color: new THREE.Color(geometry.tract.color.r, geometry.tract.color.g, geometry.tract.color.b),
                        transparent: true,
                        opacity: 0.7,
                    });
                }

                if (mesh) {
                    mesh.geometry = geometry;
                    mesh.material = material;
                    return mesh;
                }

                var m = new THREE.LineSegments( geometry, material );
                this.config.tracts[geometry.tract_index].mesh = m;


                return m;
            },

            add_mesh_to_scene: function(mesh) {
                mesh.rotation.x = -Math.PI/2;
                this.meshes.push(mesh);
                this.scene.add(mesh);
            },

            /*updateAllShaders: function() {
              this.meshes.forEach(mesh => {
              if (mesh.material.uniforms) {
            // console.log(mesh.material.uniforms);
            mesh.material.uniforms["gamma"].value = this.gamma;
            if (mesh.material.uniforms["dataMin"]) mesh.material.uniforms["dataMin"].value = this.dataMin;
            if (mesh.material.uniforms["dataMax"]) mesh.material.uniforms["dataMax"].value = this.dataMax;
            }
            });

            // update background depending on gamma
            var transform96 = Math.pow(96 / 255, 1 / this.gamma);
            this.renderer.setClearColor(new THREE.Color(transform96,transform96,transform96));
            },*/

            recalculateMaterials: function() {
                this.hist = [];
                this.meshes.forEach(mesh => {
                    this.calculateMesh(mesh.geometry, mesh);
                });
            },

            destroyPlot: function() {
                // plots_el.html('');
                Plotly.purge(this.$refs.hist);
                this.$refs.hist.style.display = "none";
            },

            makePlot: function() {
                this.destroyPlot();

                var min_to_max = [];
                for (var x = 0; x <= 100; x++) {
                    min_to_max.push(this.dataMin + (this.dataMax - this.dataMin) / 100 * x);
                    this.hist[x] = this.hist[x] || 0;
                }

                this.$refs.hist.style.display = "inline-block";
                Plotly.plot(this.$refs.hist, [{
                    x: min_to_max,
                    y: this.hist,
                }], {
                    xaxis: { gridcolor: '#444', tickfont: { color: '#aaa', size: 9 }, title: "Image Intensity" },
                    yaxis: { gridcolor: '#444', tickfont: { color: '#aaa', size: 9 }, title: "Number of Voxels", titlefont: { size: 12 } },

                    margin: {
                        t: 5,
                        b: 32,
                        l: 40,
                        r: 10
                    },
                    font: { color: '#ccc' },
                    titlefont: { color: '#ccc' },

                    plot_bgcolor: 'transparent',
                    paper_bgcolor: 'transparent',
                    autosize: true,

                    //margin: {t: 0, b: 35, r: 0},
                }, { displayModeBar: false });
            },

            upload_file: function(e) {
                let file = e.target.files[0];
                let reader = new FileReader();
                reader.addEventListener('load', buffer=>{
                    this.niftis.push({ user_uploaded: true, filename: file.name, buffer: reader.result });
                    this.selectedNifti = this.niftis.length - 1;
                    this.niftiSelectChanged();
                });
                reader.readAsArrayBuffer(file);
            },

            niftiSelectChanged: function() {
                if (this.selectedNifti === null) {
                    this.color_map = undefined;

                    this.recalculateMaterials();
                    this.destroyPlot();
                    this.showAll();
                } else {
                    let nifti = this.niftis[this.selectedNifti];
                    if (nifti.user_uploaded) this.processDeflatedNiftiBuffer(nifti.buffer);
                    else {
                        fetch(nifti.url)
                            .then(res => res.arrayBuffer())
                            .then(this.processDeflatedNiftiBuffer)
                            .catch(err => console.error);
                    }
                }
            },

            showAll: function() {
                this.meshes.forEach(m => m.visible = true);
            },

            processDeflatedNiftiBuffer: function(buffer) {
                var raw = pako.inflate(buffer);
                var N = nifti.parse(raw);

                this.color_map_head = nifti.parseHeader(raw);
                this.color_map = ndarray(N.data, N.sizes.slice().reverse());

                this.color_map.sum = 0;
                this.dataMin = null;
                this.dataMax = null;

                N.data.forEach(v=>{
                    if (!isNaN(v)) {
                        if (this.dataMin == null) this.dataMin = v;
                        else this.dataMin = v < this.dataMin ? v : this.dataMin;
                        if (this.dataMax == null) this.dataMax = v;
                        else this.dataMax = v > this.dataMax ? v : this.dataMax;

                        this.color_map.sum+=v;
                    }
                });
                this.color_map.mean = this.color_map.sum / N.data.length;

                //compute sdev
                this.color_map.dsum = 0;
                N.data.forEach(v=>{
                    if (!isNaN(v)) {
                        var d = v - this.color_map.mean;
                        this.color_map.dsum += d*d;
                    }
                });
                this.color_map.sdev = Math.sqrt(this.color_map.dsum/N.data.length);

                //set min/max
                this.sdev_m5 = this.color_map.mean - this.color_map.sdev*5;
                this.sdev_5 = this.color_map.mean + this.color_map.sdev*5;

                // console.log("color map");
                // console.dir(color_map);

                this.recalculateMaterials();
                this.makePlot();
                this.showAll();
            },

            inputFocused: function() {
                let result = false;
                Object.keys(this.$refs)
                    .forEach(k => result = result || (document.activeElement == this.$refs[k]) );

                return result;
            },

            appendStyle: function() {
                this.$refs.style.innerHTML = `
                <style scoped>
                .container {
                display:inline-block;
                position:relative;
                width: 100%;
                height: 100%;
                padding: 0px;
                }

                .conview {
                width:100%;
                height: 100%;
                }
                .tinybrain {
                position:absolute;
                pointer-events:none;
                left:0;
                bottom:0;
                }

                .controls {
                display:inline-block;
                position:absolute;
                right:0;
                top:0;
                width:auto;
                height:auto;
                white-space:nowrap;
                font-family:Roboto;
                font-size:13px;
                background:rgba(0, 0, 0, .4);
                line-height: 130%;
                color: #fff;
                padding: 8px;
                overflow-x:hidden;
                overflow-y:auto;
                max-height:100%;
                transition: opacity 0.3s;
                }
                .controls.controls-hidden {
                opacity: 0;
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

                /*
                .container_toggles {
                display:inline-block;
                max-width:500px;
                width:auto;
                height:auto;
                max-height:100%;
                padding: 8px;
                overflow-y:auto;
                overflow-x:hidden;
                transition:max-width .5s, opacity .5s, padding .5s;
                }
                .container_toggles.hidden {
                opacity: 0;
                }
                */

                .nifti_chooser {
                padding-left:4px;
                display:inline-block;
                }

                .gamma_input {
                max-width: 45px;
                }

                .plots {
                display:none;
                width:200px;
                height:200px;
                }

                .nifti_select {
                margin-bottom:4px;
                }

                .upload_div {
                color:#999;
                margin-bottom:10px;
                }

                input[type="checkbox"] {
                vertical-align:middle;
                margin:0;
                cursor:pointer;
                }

                td.label {
                text-overflow:ellipsis;
                }

                tr.row {
                opacity:.8;
                }
                tr.row:hover {
                opacity:1;
                }
                tr.row.active label {
                }

                .bllogo {
                position: absolute;
                padding-left: 8px;
                padding-top: 8px;
                font-size: 20px;
                font-family: "Open Sans";
                font-weight: bold;
                opacity:.2;
                color:white;
                text-decoration:none;
                }

                .loading {
                position: absolute;
                bottom:15px;
                left: 100px;
                font-size: 16px;
                font-family: "Open Sans";
                opacity:.2;
                color:white;
                }

                .xyz_input {
                max-width:44px;
                }

                .show_hide_button {
                color: white;
                font-size:17px;
                position:fixed;
                top: 0px;
                right:0px;
                cursor:pointer;
                z-index: 10;
                padding: 3px;
                color: #ddd;
                }
                .show_hide_button:hover {
                background-color: black;
                }
                </style>`;
            }
        },

        computed: {
            sortedMeshes: function() {
                let out = {};
                this.meshes.map(m=>m).sort((_a, _b) => {
                    var a = _a.name; var b = _b.name;
                    var a_has_lr = isLeftTract(a) || isRightTract(a);
                    var b_has_lr = isLeftTract(b) || isRightTract(b);

                    if (a_has_lr && !b_has_lr) return 1;
                    if (!a_has_lr && b_has_lr) return -1;

                    if (a > b) return 1;
                    if (a == b) return 0;
                    return -1;
                }).forEach(m => {
                    if (m.previous_material && m.material == white_material) m.material = m.previous_material;

                    if (isRightTract(m.name)) {
                        let basename = removeRightText(m.name);
                        out[basename] = out[basename] || {};
                        out[basename].right = m;
                    } else {
                        let basename = removeLeftText(m.name);
                        out[basename] = out[basename] || {};
                        out[basename].left = m;
                    }
                });

                return out;
            }
        },

        watch: {
            all_left: function() {
                this.meshes.forEach(m => {
                    if (!isRightTract(m.name)) m.visible = this.all_left;
                });
            },

            all_right: function() {
                this.meshes.forEach(m => {
                    if (isRightTract(m.name)) m.visible = this.all_right;
                });
            },
        },

        template: `
        <div class="container" style="display:inline-block;">
             <link href="https://fonts.googleapis.com/css?family=Open+Sans" rel="stylesheet">
             <div ref="style" scoped></div>
             <div id="conview" class="conview" ref="view" style="position:absolute; width: 100%; height:100%;"></div>
             <div id="tinybrain" class="tinybrain" style="width:100px;height:100px;" ref="tinybrain"></div>
             <div v-if="load_percentage < 1" id="loading" class="loading">Loading... ({{Math.round(load_percentage*100)}}%)</div>
             <a id="bllogo" class="bllogo" href="https://brainlife.io">Brain Life</a>

             <div v-if="sortedMeshes" class='show_hide_button' @click="visible = !visible">&#9776;</div>
             <div id="controls" class="controls" :class="{'controls-hidden': !visible}">
               <div v-if='controls'>
                  <input type="checkbox" name="enableRotation" v-model="controls.autoRotate" /> Rotate
               </div>
               <table class="tract_toggles" id="tract_toggles">
                  <tr class="row">
                     <td class='label'><b>Tracts</b></td>
                     <td class='label'><b>L</b></td>
                     <td class='label'><b>R</b></td>
                  </tr>
                  <tr class='row'>
                     <td class='label'><label>All</label></td>
                     <td class='label'><input type='checkbox' v-model='all_left' /></td>
                     <td class='label'><input type='checkbox' v-model='all_right' /></td>
                  </tr>
                  <tr class="row">
                     <td colspan="3" style="padding-top: 5px; margin-bottom: 5px; border-bottom: 1px solid gray;"></td>
                  </tr>
                  <tr v-for="(LR, basename) in sortedMeshes" class='row' @mouseenter="tractFocus(LR, basename)" @mouseleave="tractUnfocus(LR, basename)">
                     <td class='label'><label>{{basename}}</label></td>
                     <td class='label'><input v-if="LR.left && load_percentage == 1" type='checkbox' :name='LR.left.name' v-model='LR.left.visible' /></td>
                     <td class='label'><input v-if="LR.right && load_percentage == 1" type='checkbox' :name='LR.right.name' v-model='LR.right.visible' /></td>
                  </tr>
               </table>
               <!-- Nifti Choosing -->
               <div class="nifti_chooser" style="display:inline-block; max-width:300px; margin-top:5px;">
                  <div style="display:inline-block;" v-if="niftis.length > 0">
                     <label style="color:#ccc; width: 120px;">Overlay</label> 
                     <select id="nifti_select" class="nifti_select" ref="upload_input" @change="niftiSelectChanged" v-model="selectedNifti">
                        <option :value="null">(No Overlay)</option>
                        <option v-for="(n, i) in niftis" :value="i">{{n.filename}}</option>
                     </select>
                  </div>
                  <br />
                  <div class="upload_div">
                     <label for="upload_nifti">Upload Overlay Image (.nii.gz)</label>
                     <input type="file" style="visibility:hidden;max-height:0;max-width:5px;" name="upload_nifti" id="upload_nifti" @change="upload_file"></input>
                  </div>
                  <div class="plots" id="plots" ref="hist"></div>
                </div>
              </div><!--controls-->
        </div>            
        `
    })

    let white_material = new THREE.LineBasicMaterial({
        color: new THREE.Color(1, 1, 1)
    });

    function getHashValue(key) {
        var matches = location.hash.match(new RegExp(key+'=([^&]*)'));
        return matches ? decodeURIComponent(matches[1]) : null;
    }

    // returns whether or not the tractName is considered to be a left tract
    function isLeftTract(tractName) {
        return tractName.startsWith('Left ') || tractName.endsWith(' L');
    }

    // remove the 'left' part of the tract text
    function removeLeftText(tractName) {
        if (tractName.startsWith('Left ')) tractName = tractName.substring(5);
        if (tractName.endsWith(' L')) tractName = tractName.substring(0, tractName.length - 2);
        return tractName;
    }

    // returns whether or not the tractName is considered to be a right tract
    function isRightTract(tractName) {
        return tractName.startsWith('Right ') || tractName.endsWith(' R');
    }

    // remove the 'right' part of the tract text
    function removeRightText(tractName) {
        if (tractName.startsWith('Right ')) tractName = tractName.substring(6);
        if (tractName.endsWith(' R')) tractName = tractName.substring(0, tractName.length - 2);
        return tractName;
    }

})();
