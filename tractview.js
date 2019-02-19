let debounce_hashupdate;

let tract_loader = new Worker("load_tract.js")

Vue.component('tractview', {
    props: [ "config" ],

    data () {
        return {
            load_percentage: 1,
            loading: null,

            all_left: false,
            all_right: false,
            control_visible: true,

            meshes: [],

            dataMin: 0,
            dataMax: 0,
            gamma: 1,

            color_map: null,
            color_map_head: null,
            hist: [],
            focused: {},

            scene: null,
            back_scene: null,

            renderer: null,
            camera: null,
            controls: null,

            camera_light: null,

            tinyBrainScene: null,
            tinyBrainCam: null,
            brainRenderer: null,

            niftis: [],
            selectedNifti: null,

            tracts: null, //tracts organized into left/right
            surfaces: null, //surfaces organized into left/right

            gui: new dat.GUI(),
            stats: new Stats(),
            show_stats: true,

            raycaster: new THREE.Raycaster(),
            hovered_surface: null, //on the main ui
            hovered_obj: null,//on the list

            pushed_surface: null,
        };
    },

    mounted() {
        //weird way to register fast raycaster
        THREE.BufferGeometry.prototype.computeBoundsTree = window.MeshBVHLib.computeBoundsTree;
        THREE.BufferGeometry.prototype.disposeBoundsTree = window.MeshBVHLib.disposeBoundsTree;
        THREE.Mesh.prototype.raycast = window.MeshBVHLib.acceleratedRaycast;

        this.organize_tracts();
        this.organize_surfaces();

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.brainRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

        let viewbox = this.$refs.view.getBoundingClientRect();
        let tinybrainbox = this.$refs.tinybrain.getBoundingClientRect();

        this.camera = new THREE.PerspectiveCamera(45, viewbox.width / viewbox.height, 1, 5000);
        this.tinyBrainCam = new THREE.PerspectiveCamera(45, tinybrainbox.width / tinybrainbox.height, 1, 5000);
        this.camera.position.z = 200;

        //create back scene (to put shadow of surfaces)
        this.back_scene = new THREE.Scene();
        var ambientLight = new THREE.AmbientLight(0x404040);
        this.back_scene.add(ambientLight);
        this.camera_light = new THREE.PointLight(0xffffff, 0.2);
        this.camera_light.radius = 10;
        this.back_scene.add(this.camera_light);

        //create tract scene
        this.scene = new THREE.Scene();
        var ambientLight = new THREE.AmbientLight(0x505050);
        this.scene.add(ambientLight);
        this.camera_light = new THREE.PointLight(0xffffff, 1);
        this.camera_light.radius = 10;
        this.scene.add(this.camera_light);

        window.addEventListener("resize", this.resized);

        // start loading the tract
        if(this.config.tracts) {
            let idx = 0;
            let tracts = new THREE.Object3D();
            this.scene.add(tracts);
            async.eachSeries(this.config.tracts, (tract, next_tract) => {
                this.load_tract(tract, idx++, (err, mesh) => {
                    if (err) return next_tract(err);
                    this.meshes.push(mesh);
                    tracts.add(mesh);
                    this.load_percentage = idx / this.config.tracts.length;
                    this.loading = tract.name;
                    tract.mesh = mesh; 
                    //this.$forceUpdate(); //doesn't work
                    setTimeout(next_tract, 0); //give UI thread time
                });
            }, console.error); 
        }

        //start loading surfaces
        if(this.config.surfaces) {
            let vtkloader = new THREE.VTKLoader();
            async.eachSeries(this.config.surfaces, (surface, next_surface)=>{
                //console.dir(surface);
                this.loading = surface.filename;
                vtkloader.load(surface.url, geometry=>{
                    geometry.computeVertexNormals(); //for smooth shading
                    geometry.computeBoundsTree(); //for BVH

                    //add to back_scene
                    let material = new THREE.MeshLambertMaterial({
                        color: new THREE.Color(surface.color.r/256, surface.color.g/256, surface.color.b/256),
                        transparent: true,
                        opacity: 0.2,
                        depthTest: false,
                    });
                    var back_mesh = new THREE.Mesh( geometry, material );
                    back_mesh.rotation.x = -Math.PI/2;
                    back_mesh.visible = true;
                    this.back_scene.add(back_mesh);

                    /*
                    normal_material = new THREE.MeshPhongMaterial({
                        color: new THREE.Color(surface.color.r/256, surface.color.g/256, surface.color.b/256),
                        shininess: 80,
                    });
                    */

                    let mesh = new THREE.Mesh( geometry );
                    mesh.rotation.x = -Math.PI/2;
                    mesh.visible = false;
                    mesh._surface = true;
                    surface.mesh = mesh; 

                    //store other surfaces
                    mesh._normal_material = new THREE.MeshLambertMaterial({
                        color: new THREE.Color(surface.color.r/256, surface.color.g/256, surface.color.b/256),
                    });
                    mesh._highlight_material = new THREE.MeshPhongMaterial({
                        color: new THREE.Color(surface.color.r/256*1.25, surface.color.g/256*1.25, surface.color.b/256*1.25),
                        shininess: 80,
                    });
                    mesh._xray_material = new THREE.MeshLambertMaterial({
                        color: new THREE.Color(surface.color.r/256*1.25, surface.color.g/256*1.25, surface.color.b/256*1.25),
                        transparent: true,
                        opacity: 0.25,
                        depthTest: false, //need this to show tracts on top
                    });
                    mesh.material = mesh._normal_material;
                    this.scene.add(mesh);
                    //this.$forceUpdate(); //doesn't work
                    setTimeout(next_surface, 0); //give UI thread time
                });
            }, console.error);
        }

        // add tiny brain (to show the orientation of the brain while the user looks at fascicles)
        // - only load if there are no surfaces
        if(!this.config.surfaces) {
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
        }

        this.renderer.autoClear = false;
        this.renderer.setSize(viewbox.width, viewbox.height);
        //this.renderer.setClearColor(new THREE.Color(.5,.5,.5));
        this.$refs.view.appendChild(this.renderer.domElement);

        this.brainRenderer.autoClear = false;
        this.brainRenderer.setSize(tinybrainbox.width, tinybrainbox.height);
        this.$refs.tinybrain.appendChild(this.brainRenderer.domElement);

        // use OrbitControls and make camera light follow camera position
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);

        this.handle_hash();
        window.parent.addEventListener("hashchange", e=>{
            this.handle_hash();
            //this.animate();
        });

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
                let where = "where=" + pos_params + "/" + target_params;
                window.parent.location.hash = where;
            }, 100);
        });

        this.controls.addEventListener('start', ()=>{
            this.controls.autoRotate = false;
        });

        this.animate();

        if (this.config.layers) {
            this.config.layers.forEach(layer => {
                let condensed_filename = layer.url;
                if (condensed_filename.indexOf('/') != -1) condensed_filename = condensed_filename.substring(condensed_filename.lastIndexOf('/')+1);
                this.niftis.push({ user_uploaded: false, url: layer.url, user_uploaded: false, filename: condensed_filename });
            });
            this.selectedNifti = null;
        }

        this.stats.showPanel(1);
        this.$refs.stats.appendChild(this.stats.dom);
        this.stats.dom.style.top = null;
        this.stats.dom.style.bottom = "5px";
        this.stats.dom.style.right = null;
        this.stats.dom.style.left = "5px";

        this.init_gui();
    },

    methods: {
        organize_tracts() {
            this.tracts = {};
            if(!this.config.tracts) return;
            this.config.tracts.forEach(tract=>{
                let left = false;
                let right = false;

                //detect hierachy and adjust name
                let name = tract.name.toLowerCase();
                if(name.startsWith('left')) {
                    left = true;
                    name = tract.name.substring(4);
                }
                if(name.endsWith(' l')) {
                    left = true;
                    name = tract.name.substring(0, name.length - 2);
                }
                if(name.startsWith('right')) {
                    right = true;
                    name = tract.name.substring(5);
                }
                if(name.endsWith(' r')) {
                    right = true;
                    name = tract.name.substring(0, name.length - 2);
                }

                //if it's not left nor right, pretend that it's left
                if(!left && !right) left = true;

                //put tract info into appropriate categories
                if(!this.tracts[name]) Vue.set(this.tracts, name, {
                    left_check: false,
                    right_check: false,
                });
                if(left) this.tracts[name].left = tract;
                if(right) this.tracts[name].right = tract;
            });
        },

        organize_surfaces() {
            this.surfaces = {};
            if(!this.config.surfaces) return;
            this.config.surfaces.forEach(surface=>{
                let left = false;
                let right = false;

                //detect hierachy and adjust name
                let name = surface.name.toLowerCase();
                console.log(name);
                if(name.startsWith('left-')) {
                    left = true;
                    name = surface.name.substring(5);
                }
                if(name.startsWith('l-')) {
                    left = true;
                    name = surface.name.substring(2);
                }
                if(name.startsWith('right-')) {
                    right = true;
                    name = surface.name.substring(6);
                }
                if(name.startsWith('r-')) {
                    right = true;
                    name = surface.name.substring(2);
                }
                if(name.startsWith('ctx-lh-')) {
                    left = true;
                    name = surface.name.substring(7);
                }
                if(name.startsWith('ctx-rh-')) {
                    right = true;
                    name = surface.name.substring(7);
                }

                //if it's not left nor right, pretend that it's left
                if(!left && !right) left = true;

                //put tract info into appropriate categories
                if(!this.surfaces[name]) Vue.set(this.surfaces, name, {
                    left_check: false,
                    right_check: false,
                });
                if(left) this.surfaces[name].left = surface;
                if(right) this.surfaces[name].right = surface;
                //console.log(surface.name, name, left, right);
            });
            console.dir(this.surfaces);
        },

        init_gui() {
            var ui = this.gui.addFolder('UI');
            ui.add(this.controls, 'autoRotate').listen();
            ui.add(this, 'show_stats');
            ui.open();

            /*
            var matrix = this.gui.addFolder('Matrix');
            matrix.add(this, 'weight_field',  [ 'count', 'density' ]); 
            matrix.open();
            */
        },

        handle_hash() {
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
        },

        animate() {
            this.stats.begin();

            if(this.hovered_obj) {
                if(this.hovered_obj.left && this.hovered_obj.left.mesh) this.animate_mesh(this.hovered_obj.left.mesh);
                if(this.hovered_obj.right && this.hovered_obj.right.mesh) this.animate_mesh(this.hovered_obj.right.mesh);
            }

            this.controls.enableKeys = !this.inputFocused();
            this.controls.update();
            this.camera_light.position.copy(this.camera.position);

            this.renderer.clear();
            this.renderer.render(this.back_scene, this.camera);
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

            this.stats.end();
            requestAnimationFrame(this.animate);
        },

        animate_mesh(mesh) {
            let now = new Date().getTime();
            let l = Math.cos((now%1000)*(2*Math.PI/1000));
            mesh.material.opacity = (l+2)/4;
        },

        round(v) {
            return Math.round(v * 1e3) / 1e3;
        },

        /*
        tractFocus: function(LR, basename) {
            this.focused[basename] = true;
            if (LR.left) {
                LR.left.material_previous = LR.left.material;
                LR.left.material = white_material;
                //LR.left.visible = true;
            }
            if (LR.right) {
                LR.right.material_previous = LR.right.material;
                LR.right.material = white_material;
                //LR.right.visible = true;
            }
        },

        tractUnfocus: function(LR, basename) {
            this.focused[basename] = false;
            if (LR.left && LR.left.material_previous) {
                LR.left.material = LR.left.material_previous;
            }
            if (LR.right && LR.right.material_previous) {
                LR.right.material = LR.right.material_previous;
            }
        },
        */

        resized() {
            var viewbox = this.$refs.view.getBoundingClientRect();
            this.camera.aspect = viewbox.width / viewbox.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(viewbox.width, viewbox.height);
        },

        load_tract: function(tract, index, cb) {

            //use web worker to parse the json.. although I still have to spend good chunk of time constructing the BufferGeometry which 
            //must happen on this thread - as they are not serializable.
            tract_loader.postMessage(tract);
            tract_loader.onmessage=(e)=>{
                //let threads_pos = e.data;
                let vertices = e.data;

                var geometry = new THREE.BufferGeometry();
                geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
                geometry.vertices = vertices;
                geometry.tract_index = index;
                geometry.tract = tract; //metadata..

                let mesh = this.calculateMesh(geometry);
                mesh.name = tract.name;
                mesh.visible = false;
                mesh.rotation.x = -Math.PI/2;
                
                cb(null, mesh);
            }
        },

        calculateMesh: function(geometry, mesh) {
            //console.log("calculateMesh called");
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
                    //update
                    mesh.geometry = geometry;
                    mesh.material = material;
                    return mesh;
                } else {
                    //new
                    mesh = new THREE.LineSegments( geometry, material );
                    mesh = new THREE.LineSegments( geometry, material );
                    mesh._normal_material = material;
                    mesh._highlight_material = highlight_material;
                    this.config.tracts[geometry.tract_index].mesh = mesh;
                    return mesh;
                }
            }

            let color;
            let mul = 1.5;
            if (Array.isArray(geometry.tract.color)) {
                color = new THREE.Color(geometry.tract.color[0]*mul, geometry.tract.color[1]*mul, geometry.tract.color[2]*mul);
            } else {
                color = new THREE.Color(geometry.tract.color.r*mul, geometry.tract.color.g*mul, geometry.tract.color.b*mul);
            }

            let material = new THREE.LineBasicMaterial({
                color,
                transparent: true,
                opacity: 0.6,
            });

            let highlight_material = new THREE.LineBasicMaterial({
                color: "white",
                transparent: true,
                opacity: 0.8,
            });

            if (mesh) {
                //update
                mesh.geometry = geometry;
                mesh.material = material;
                return mesh;
            } else {
                //new
                mesh = new THREE.LineSegments( geometry, material );
                mesh._normal_material = material;
                mesh._highlight_material = highlight_material;
            }
            this.config.tracts[geometry.tract_index].mesh = mesh;
            return mesh;
        },

        recalculateMaterials: function() {
            this.hist = [];
            this.meshes.forEach(mesh => {
                this.calculateMesh(mesh.geometry, mesh);
            });
        },

        destroyPlot: function() {
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

            this.recalculateMaterials();
            this.makePlot();
            this.showAll();
        },

        inputFocused: function() {
            let result = false;
            Object.keys(this.$refs).forEach(k => result = result || (document.activeElement == this.$refs[k]) );
            return result;
        },
        
        surface_color(surface) {
            let color;
            if(surface.left) color = surface.left.color;
            if(surface.right) color = surface.right.color;
            return `rgb(${128+color.r/2},${128+color.g/2},${128+color.b/2})`;
        },

        tract_color(tract) {
            let color;
            if(tract.left) color = tract.left.color;
            if(tract.right) color = tract.right.color;
            return `rgb(${128+color[0]*128},${128+color[1]*128},${128+color[2]*128})`;
        },

        check(obj, left) {
            if(left) {
                obj.left.mesh.visible = obj.left_check;
            } else {
                obj.right.mesh.visible = obj.right_check;
            }
        },

        mouseenter(obj) {
            //if(!obj) return;
            if(obj.left && obj.left.mesh) {
                obj.left.mesh.material = obj.left.mesh._highlight_material;
                obj.left.mesh.visible = true;
            }
            if(obj.right && obj.right.mesh) {
                obj.right.mesh.material = obj.right.mesh._highlight_material;
                obj.right.mesh.visible = true;
            }
            this.hovered_obj = obj;
        },

        mouseleave(obj) {
            //if(!obj) return;
            if(obj.left && obj.left.mesh) {
                obj.left.mesh.material = obj.left.mesh._normal_material;
                if(!obj.left_check) {
                    obj.left.mesh.visible = false;
                }
            }
            if(obj.right && obj.right.mesh) {
                obj.right.mesh.material = obj.right.mesh._normal_material;
                if(!obj.right_check) {
                    obj.right.mesh.visible = false;
                }
            }

            //restore original material.opacity
            if(this.hovered_obj.left && this.hovered_obj.left.mesh) {
                this.hovered_obj.left.mesh.opacity = this.hovered_obj.left.mesh._normal_material.opacity;
            }
            if(this.hovered_obj.right && this.hovered_obj.right.mesh) {
                this.hovered_obj.right.mesh.opacity = this.hovered_obj.right.mesh._normal_material.opacity;
            }
            this.hovered_obj = null;
        },

        find_surface(event) {
            let mouse = new THREE.Vector2();
            mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
            mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
            this.raycaster.setFromCamera( mouse, this.camera );
            let intersects = this.raycaster.intersectObjects(this.scene.children);

            //select first roi mesh
            for(let i = 0;i < intersects.length; ++i) {
                let obj = intersects[i].object;
                if(obj._surface) return obj;
            }
            return null;
        },

        mousemove(event) {
            if(event.buttons) return; //ignore dragging
    
            //restore previously hovered surface
            if(this.hovered_surface) this.hovered_surface.material = this.hovered_surface._normal_material;
    
            //check to see if we are still hovering, or hovering on new surface
            let obj = this.find_surface(event);
            if(obj) obj.material = obj._highlight_material;

            this.hovered_surface = obj;
        },

        mouseup(event) {
            if(this.pushed_surface) {
                this.pushed_surface.material = this.pushed_surface._highlight_material;
                this.pushed_surface = null;
            }
        },
        mousedown(event) {
            let obj = this.find_surface(event);
            if(obj) {
                this.pushed_surface = obj;
                obj.material = obj._xray_material;
            }
        },
    },

    computed: {
        sorted_tracts: function() {
            if(!this.tracts) return [];
            return Object.keys(this.tracts).sort();
        },
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
        <div ref="stats" v-show="show_stats"/>
         <div id="conview" class="conview" ref="view" style="position:absolute; width: 100%; height:100%;"
            @mousemove="mousemove" @mousedown="mousedown" @mouseup="mouseup"/>
         <div id="tinybrain" class="tinybrain" style="width:100px;height:100px;" ref="tinybrain"></div>
         <div v-if="load_percentage < 1" id="loading" class="loading">Loading... {{loading}} ({{Math.round(load_percentage*100)}}%)</div>
         <div id="controls" class="controls" :class="{'controls-hidden': !control_visible}">
            <div v-if="tracts">
                <div style="clear: right; position: sticky; top: 0px; background-color: rgba(0,0,0,0.7); padding: 5px; margin-bottom: 5px">
                    <span class="checks">
                        <b>&nbsp;L&nbsp;</b>
                        <b>&nbsp;R&nbsp;</b>
                    </span>
                    <h2>White Matter Tracts</h2>
                </div>
                <div style="clear: right; margin-bottom: 5px;">
                    <b style="opacity: 0.3">All</b>
                    <span class="checks">
                        <input type='checkbox' v-model='all_left' />
                        <input type='checkbox' v-model='all_right' />
                    </span>
                </div>

                <div v-for="name in sorted_tracts" :style="{color: tract_color(tracts[name])}" class="control-row"
                    @mouseenter="mouseenter(tracts[name])" @mouseleave="mouseleave(tracts[name])">
                    {{name}}
                    <span class="checks">
                        <input v-if="tracts[name].left && tracts[name].left.mesh" type='checkbox' 
                            @change="check(tracts[name], true)" v-model='tracts[name].left_check' />
                        <input v-if="tracts[name].right && tracts[name].right.mesh" type='checkbox' 
                            @change="check(tracts[name], false)" v-model='tracts[name].right_check' />
                    </span>
                </div>
                <br>
            </div>

            <div v-if="surfaces">
                <div style="clear: right; position: sticky; top: 0px; background-color: rgba(0,0,0,0.7); padding: 5px; margin-bottom: 5px">
                    <h2>Brain Regions</h2>
                </div>
                <div v-for="name in Object.keys(surfaces)" :style="{color: surface_color(surfaces[name])}" class="control-row"
                    @mouseenter="mouseenter(surfaces[name])" @mouseleave="mouseleave(surfaces[name])">
                    {{name}}
                    <span class="checks">
                        <input v-if="surfaces[name].left && surfaces[name].left.mesh" type='checkbox' 
                            @change="check(surfaces[name], true)" v-model='surfaces[name].left_check' />
                        <input v-if="surfaces[name].right && surfaces[name].right.mesh" type='checkbox' 
                            @change="check(surfaces[name], false)" v-model='surfaces[name].right_check' />
                    </span>
                </div>
                <br>
            </div>

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

function getHashValue(key) {
    var matches = window.parent.location.hash.match(new RegExp(key+'=([^&]*)'));
    return matches ? decodeURIComponent(matches[1]) : null;
}

/////////////////////////////////////////////////////////////
// 
// all these will be removed..
//

// returns whether or not the tractName is considered to be a left tract
function isLeftTract(tractName) {
    let name = tractName.toLowerCase();
    return name.startsWith('left') || name.endsWith(' l');
}

// returns whether or not the tractName is considered to be a right tract
function isRightTract(tractName) {
    let name = tractName.toLowerCase();
    return name.startsWith('right') || name.endsWith(' r');
}

