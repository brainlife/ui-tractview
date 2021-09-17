<script lang="ts">

import { defineComponent, defineAsyncComponent } from 'vue'

import SurfaceController from './components/SurfaceController.vue'
import TractController from './components/TractController.vue'

import * as THREE from 'three'

import { ITractConfig, ISurfaceConfig, ISurfaceLR, ITractLR } from './interfaces'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { VTKLoader } from 'three/examples/jsm/loaders/VTKLoader.js'

// @ts-ignore
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'

// @ts-ignore
import * as Stats from 'stats.js/build/stats.min.js'

//we can't store threejs elements here as vue3's proxied object interfares with threejs's proxied object
const three = {
    scene: new THREE.Scene(),
    back_scene: new THREE.Scene(),
    renderer: new THREE.WebGLRenderer({ alpha: true, antialias: true }),
    camera: new THREE.PerspectiveCamera(45, 2.0, 1, 5000), //will be resized in initScene()
    camera_light: new THREE.PointLight(0xffffff, 0.9),
    raycaster: new THREE.Raycaster(),
}

export default defineComponent({

    data() {
        return {
            config: {
                tracts: null as ITractConfig[]|null,
                surfaces: null as ISurfaceConfig[]|null,
                debug: (process.env.NODE_ENV == "development")?true:false,      
            },
            controls: {
                orbit: null as OrbitControls|null,
                showStart: false,
                showEnd: false,
            },

            tracts: {} as {[key: string]: ITractLR},
            surfaces: {} as {[key: string]: ISurfaceLR},

            //below are things that we haven't touched yet.
            load_percentage: 1,
            loading: null as (null|string),

            pushed_surface: null as ISurfaceConfig|null,
            
            hoveredLR: null as ISurfaceLR|ITractLR|null,//on the list

            tooltip: "",
            tooltipBounce: null as null|ReturnType<typeof setTimeout>,
            stats: null as null | typeof Stats, //for fps
        }
    },

    mounted() {
        //handle config params
        // @ts-ignore (we inject config via window.parent.config which is not standard)
        let config = window.parent.config || window.config;

        if(config) {
            //normalize a case where there is only 1 surface / tract object (some app does that..)
            if(config.tracts && !Array.isArray(config.tracts)) config.tracts = [config.tracts];
            if(config.surfaces && !Array.isArray(config.surfaces)) config.surfaces = [config.surfaces];

            this.config.tracts = config.tracts;
            this.config.surfaces = config.surfaces;

            //append jwt to config.
            let jwt = localStorage.getItem("jwt");
            if(jwt && this.config.tracts) this.config.tracts.forEach((tract:ITractConfig)=>{
                tract.url += "?at="+jwt;
            });
            if(jwt && this.config.surfaces) this.config.surfaces.forEach((surface:ISurfaceConfig)=>{
                surface.url += "?at="+jwt;
            });
            this.init();
        } else {
            this.loadDemoConfig();
        }
    },

    destroyed() {
        window.removeEventListener("resize", this.resize);
    },

    watch: {
        "controls.showStart": function() {
            this.updateVisibility();
        },
        "controls.showEnd": function() {
            this.updateVisibility();
        },
    },

    methods: {

        async init() {
            // @ts-ignore
            THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
            // @ts-ignore
            THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
            THREE.Mesh.prototype.raycast = acceleratedRaycast;

            //initialize Stats to show debug info (FPS, etc..) 
            if(this.config.debug) {
                this.stats = new Stats();
                this.stats.dom.style.top = 'inherit';
                this.stats.dom.style.bottom = '0px';
                this.stats.dom.style.left = 'inherit';
                this.stats.dom.style.right = '0px';
                document.body.appendChild(this.stats.dom);
                this.stats.showPanel(0);
            }

            this.normalizeColor();
            this.organizeLR();
            this.initScene();
            this.animate(); //start animating before all data is loaded
            
            await this.loadTracts();
            await this.loadSurfaces();

            //remove loading indicator
            this.loading = null;
            this.load_percentage = 1;
            
        },

        async loadTracts() {
            if(!this.config.tracts) return;

            const textureLoader = new THREE.TextureLoader();
            const pointSprite = textureLoader.load('point.png');

            let idx = 0;
            let tracts = new THREE.Object3D();
            three.scene.add(tracts);
            for (const tract of this.config.tracts) {
                this.loading = tract.name;
                this.load_percentage = (idx++) / this.config.tracts.length;
                const {lineGeometry, startPointGeometry, endPointGeometry} : any = await this.loadTract(tract);

                //create fiber mesh
                let normal_material = new THREE.LineBasicMaterial({color: tract.color, transparent: true, linewidth: 1, opacity: 0.6});
                let highlight_material = new THREE.LineBasicMaterial({color: "white", transparent: true, linewidth: 1, opacity: 0.5});
                const linemesh = new THREE.LineSegments( lineGeometry, normal_material );            

                tract.mesh = linemesh;
                tract.normal_material = normal_material;
                tract.highlight_material = highlight_material;

                linemesh.name = tract.name;
                linemesh.visible = false; //tract.show || false;
                linemesh.rotation.x = -Math.PI/2;
                tracts.add(linemesh);

                //create start point particles
                const startPointMaterial = new THREE.PointsMaterial( { 
                    size: 2, map: pointSprite, 
                    blending: THREE.AdditiveBlending, depthTest: false, transparent: true } );
                startPointMaterial.color.setHSL( 0.5, 0.5, 0.3 ); //blue
                const startPoints = new THREE.Points(startPointGeometry, startPointMaterial);
                startPoints.visible = false; //tract.show || false;
                startPoints.rotation.x = -Math.PI/2;
                tracts.add(startPoints);
                tract.start = startPoints; 
                
                //create end point particles
                const endPointMaterial = new THREE.PointsMaterial( { 
                    size: 2, map: pointSprite, 
                    blending: THREE.AdditiveBlending, depthTest: false, transparent: true } );
                endPointMaterial.color.setHSL( 0, 0.5, 0.3 ); //red
                const endPoints = new THREE.Points(endPointGeometry, endPointMaterial);
                endPoints.visible = false; //tract.show || false;
                endPoints.rotation.x = -Math.PI/2;
                tracts.add(endPoints);
                tract.end = endPoints;
            }
        },

        loadTract(tract: ITractConfig) {

            return new Promise((resolve, reject)=>{
                if(!tract.url) return; //for ts..

                //use web worker to parse the json.. although I still have to spend good chunk of time constructing the BufferGeometry which
                //must happen on this thread - as they are not serializable.
                fetch(tract.url).then(res=>res.json()).then(json=>{

                    // @ts-ignore
                    this.$worker.run((json:any)=>{
                        let bundle = json.coords;

                        //normalize data format (1>N>3>[] v.s. N>1>3>[])
                        if(bundle.length == 1 && bundle[0][0].length == 3) bundle = bundle[0];

                        //convert each bundle to threads_pos array
                        const threads_pos = [] as number[];
                        const starts = [] as number[];
                        const ends = [] as number[];
                        bundle.forEach((fascicle : number[][])=>{
                            //normalize data type from the [ [[...]], [[...]], [[...]] ]  into > [ [...],[...],[...] ] 
                            if (fascicle.length == 1 && fascicle[0].length == 3) {
                                // @ts-ignore
                                fascicle = fascicle[0]; 
                            }

                            var xs = fascicle[0];
                            var ys = fascicle[1];
                            var zs = fascicle[2];
                            const l = xs.length;

                            starts.push(xs[0], ys[0], zs[0]);
                            ends.push(xs[l-1], ys[l-1], zs[l-1]);

                            for(var i = 1;i < xs.length;++i) {
                                threads_pos.push(xs[i-1]);
                                threads_pos.push(ys[i-1]);
                                threads_pos.push(zs[i-1]);
                                threads_pos.push(xs[i]);
                                threads_pos.push(ys[i]);
                                threads_pos.push(zs[i]);
                            }
                        });

                        return {
                            lines: new Float32Array(threads_pos),
                            startPoints: new Float32Array(starts),
                            endPoints: new Float32Array(ends),
                        }

                    }, [json]).then((res:any)=>{
                        let {lines, startPoints, endPoints} = res;

                        //create LineGeometry
                        const lineGeometry = new THREE.BufferGeometry();
                        lineGeometry.setAttribute('position', new THREE.BufferAttribute(lines, 3));

                        //start points
                        const startPointGeometry = new THREE.BufferGeometry();
                        startPointGeometry.setAttribute('position', new THREE.BufferAttribute(startPoints, 3));

                        //end points
                        const endPointGeometry = new THREE.BufferGeometry();
                        endPointGeometry.setAttribute('position', new THREE.BufferAttribute(endPoints, 3));

                        resolve({lineGeometry, startPointGeometry, endPointGeometry});
                    });
                });

            });
        },

        async loadSurfaces() {
            if(!this.config.surfaces) return;

            let idx = 0;
            let vtkloader = new VTKLoader();
            for (const surface of this.config.surfaces) {
                if(!surface.url) continue;

                this.loading = surface.name;
                this.load_percentage = (idx++) / this.config.surfaces.length;
                //await this.loadSurface(surface);
                try {
                    const geometry = await vtkloader.loadAsync(surface.url);
                    geometry.computeVertexNormals(); //for smooth shading

                    // @ts-ignore
                    if(geometry.computeBoundsTree) geometry.computeBoundsTree(); //for BVH

                    let back_material = new THREE.MeshLambertMaterial({
                        //color: new THREE.Color(surface.color).multiplyScalar(2),
                        color: surface.color,
                        transparent: true,
                        opacity: 0.2,
                        depthTest: false,
                    });
                    let back_mesh = new THREE.Mesh( geometry, back_material );
                    back_mesh.rotation.x = -Math.PI/2;
                    three.back_scene.add(back_mesh);

                    let mesh = new THREE.Mesh( geometry );
                    mesh.rotation.x = -Math.PI/2;
                    mesh.visible = false;
                    surface.mesh = mesh;

                    //store other surfaces
                    surface.normal_material = new THREE.MeshLambertMaterial({
                        color: new THREE.Color(surface.color),
                        transparent: true,
                        opacity: 0.8,
                    });
                    surface.highlight_material = new THREE.MeshPhongMaterial({
                        color: new THREE.Color(surface.color).multiplyScalar(1.25),
                        transparent: true,
                        opacity: 1,
                        shininess: 80,
                    });
                    surface.xray_material = new THREE.MeshLambertMaterial({
                        color: new THREE.Color(surface.color).multiplyScalar(1.25),
                        transparent: true,
                        opacity: 0.2,
                        depthTest: false, //need this to show tracts on top
                    });
                    mesh.material = surface.normal_material;
                    three.scene.add(mesh);
                } catch (err) {
                    console.error("failed to load surface", surface.url);
                    console.error(err);
                }
            }
        },

        loadDemoConfig() {
            let dataurl = "/ui/tractview/testdata/0001"; //production demo data
            if(this.config.debug) {
                dataurl = "https://brainlife.io/ui/tractview/testdata/0001";
            }

            console.log("loading demo tracts.json from", dataurl + "/tracts/tracts.json")
            fetch(dataurl+"/tracts/tracts.json").then(res=>res.json()).then(data=>{
                if(!Array.isArray(data)) data = [data];
                this.config.tracts = data;
                if(this.config.tracts) this.config.tracts.forEach((tract:ITractConfig)=>{
                    tract.url = dataurl+"/tracts/"+tract.filename;
                });
                fetch(dataurl+"/surfaces/index.json").then(res=>res.json()).then(data=>{
                    if(!Array.isArray(data)) data = [data];
                    this.config.surfaces = data;
                    if(this.config.surfaces) this.config.surfaces.forEach((surface:ISurfaceConfig)=>{
                        surface.url = dataurl+"/surfaces/"+surface.filename;
                    });
                    this.init();
                }).catch(err=>{
                    //probably no surfacess.. but it's ok
                    console.error(err);
                    this.init();
                });
            });
        },

        //convert color info stored in JSON to THREE.Color.
        normalizeColor()  {
            if(this.config.tracts) this.config.tracts.forEach((tract:ITractConfig)=>{
                // @ts-ignore
                tract.color = new THREE.Color(tract.color[0]/2+0.5, tract.color[1]/2+0.5, tract.color[2]/2+0.5); //always array?
            });
            if(this.config.surfaces) this.config.surfaces.forEach((surface:ISurfaceConfig)=>{
                surface.color = new THREE.Color(surface.color.r/512+0.5,  surface.color.g/512+0.5,  surface.color.b/512+0.5);  
            });
        },

        //from the config tracts/surfaces, setup this.tracts and this.surfaces with left/right separated (no mesh yet)
        organizeLR() {
            this.tracts = {};
            if(this.config.tracts) this.config.tracts.forEach((tract:ITractConfig)=>{
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
                if(!this.tracts[name]) this.tracts[name] = {
                    left_check: false,
                    right_check: false,
                }

                if(left) this.tracts[name].left = tract;
                if(right) this.tracts[name].right = tract;
            });

            this.surfaces = {};
            if(this.config.surfaces) this.config.surfaces.forEach((surface:ISurfaceConfig)=>{
                let left = false;
                let right = false;

                //detect hierachy and adjust name
                let name = surface.name.toLowerCase();
                //console.log(name);
                if(name.startsWith('left-')) {
                    left = true;
                    name = surface.name.substring(5);
                }
                if(name.endsWith('_left')) {
                    left = true;
                    name = surface.name.substring(0, name.length-5);
                }
                if(name.startsWith('l-')) {
                    left = true;
                    name = surface.name.substring(2);
                }
                if(name.startsWith('right-')) {
                    right = true;
                    name = surface.name.substring(6);
                }
                if(name.endsWith('_right')) {
                    right = true;
                    name = surface.name.substring(0, name.length-6);
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
                if(!this.surfaces[name]) this.surfaces[name] = {
                    left_check: false,
                    right_check: false,
                }

                if(left) this.surfaces[name].left = surface;
                if(right) this.surfaces[name].right = surface;
            });
        },

        initScene() {

            // @ts-ignore
            let viewbox = this.$refs.view.getBoundingClientRect();

            three.renderer.autoClear = false;
            three.renderer.setSize(viewbox.width, viewbox.height);

            // @ts-ignore
            this.$refs.view.appendChild(three.renderer.domElement);

            three.camera.position.z = 200;
            three.back_scene.add(new THREE.AmbientLight(0x303030));

            three.scene.add(new THREE.AmbientLight(0x303030));
            three.scene.add(three.camera_light);

            this.controls.orbit = new OrbitControls(three.camera, three.renderer.domElement);
            this.controls.orbit.enableDamping = true;
            this.controls.orbit.dampingFactor = 0.25;
    
            const axesHelper = new THREE.AxesHelper( 10 );
            three.scene.add( axesHelper );
        
            window.addEventListener("resize", this.resize);
            this.resize();
        },

        resize() {
            // @ts-ignore
            const viewbox = this.$refs.view.getBoundingClientRect();
            three.camera.aspect = viewbox.width / viewbox.height;
            three.camera.updateProjectionMatrix();
            three.renderer.setSize(viewbox.width, viewbox.height);
        },

        animate() {
            if(this.stats) this.stats.begin();

            if(this.controls.orbit) this.controls.orbit.update();

            // @ts-ignore (can't figure out what's wrong with animate_mesh param)
            if(this.hoveredLR?.left?.mesh) this.animateMesh(this.hoveredLR.left.mesh);
            // @ts-ignore (can't figure out what's wrong with animate_mesh param)
            if(this.hoveredLR?.right?.mesh) this.animateMesh(this.hoveredLR.right.mesh);       

            three.camera_light.position.copy(three.camera.position);
            three.renderer.clear();

            three.renderer.render(three.back_scene, three.camera);
            three.renderer.clearDepth();
            three.renderer.render(three.scene, three.camera);

            if(this.stats) this.stats.end();

            requestAnimationFrame(this.animate);
        },

        animateMesh(mesh : THREE.Mesh) {
            const now = new Date().getTime();
            const l = Math.cos((now/5%1000)*(2*Math.PI/1000)); //-1.0 ~ -1.0 (every 5 seconds)
            (mesh.material as THREE.Material).opacity = Math.abs(l)/2+0.1;  //0.1 ~ 0.7
        },

        menuitementer(obj: (ITractLR|ISurfaceLR)) {
            if(obj.left && obj.left.mesh) {
                obj.left.mesh.material = obj.left.highlight_material;
                obj.left.mesh.visible = true;
            }
            if(obj.right && obj.right.mesh) {
                obj.right.mesh.material = obj.right.highlight_material;
                obj.right.mesh.visible = true;
            }
            this.updateVisibility();

            this.hoveredLR = obj;
        },

        menuitemleave(obj: (ITractLR|ISurfaceLR)) {
            if(obj.left && obj.left.mesh) {
                obj.left.mesh.material = obj.left.normal_material;
                if(!obj.left_check) obj.left.mesh.visible = false;
            }
            if(obj.right && obj.right.mesh) {
                obj.right.mesh.material = obj.right.normal_material;
                if(!obj.right_check) obj.right.mesh.visible = false;
            }
            this.updateVisibility();
            this.hoveredLR = null;
        },

        mouseup(/*event*/) {
            if(this.pushed_surface?.mesh) {
                this.pushed_surface.mesh.material = this.pushed_surface.normal_material;
                this.pushed_surface = null;
            }
            this.tooltip = "";
        },

        mousedown(event: MouseEvent) {
            let obj = this.findSurface(event);
            if(obj?.mesh) {
                this.pushed_surface = obj;
                obj.mesh.material = obj.xray_material;
            }
        },

        mousemove(event: MouseEvent) {
            this.tooltip = "";
            if(this.tooltipBounce) clearTimeout(this.tooltipBounce);
            this.tooltipBounce = setTimeout(()=>{
                let obj = this.findSurface(event);
                if(obj) {
                    this.tooltip = obj.name;
                    (this.$refs.tooltip as HTMLElement).style.left = event.x+"px";
                    (this.$refs.tooltip as HTMLElement).style.top = (event.y-30)+"px";
                }
            }, 300)
        },

        findSurface(event: MouseEvent): ISurfaceConfig|null {
            if(!this.config.surfaces) return null;
            
            let mouse = new THREE.Vector2();
            mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
            mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
            three.raycaster.setFromCamera( mouse, three.camera );

            //console.time("raycasting");
            let intersects = three.raycaster.intersectObjects(three.scene.children);
            //console.timeEnd("raycasting");

            /* each intersects will contain..
            distance: 123.30349997883842
            face: {a: 4878, b: 5089, c: 4877, normal: Vector3, materialIndex: 0}
            faceIndex: 1187
            object: Mesh {uuid: '134C723D-6261-4C2A-87CF-CED307926FFD', name: '', type: 'Mesh', parent: Scene, children: Array(0), …}
            point: Vector3
            x: 3.7158954185774817
            y: 39.11251489116937
            z: 74.70316006686787
            */

            //select first surface mesh
            for(let i = 0;i < intersects.length; ++i) {
                let mesh = intersects[i].object as THREE.Mesh;
                const surface = this.config.surfaces.find(s=>(s.mesh?.visible && s.mesh?.uuid == mesh.uuid));
                if(surface) return surface;
            }
            return null;
        },

        updateVisibility() {
            for(let name in this.tracts) {
                let tract = this.tracts[name] as ITractLR;
                if(tract.left && tract.left.mesh) {
                    tract.left.start.visible = tract.left.mesh.visible && this.controls.showStart;
                    tract.left.end.visible = tract.left.mesh.visible && this.controls.showEnd;
                }
                if(tract.right && tract.right.mesh) {
                    tract.right.start.visible = tract.right.mesh.visible && this.controls.showStart;
                    tract.right.end.visible = tract.right.mesh.visible && this.controls.showEnd;
                }
            }
        },
    },

    components: {
        SurfaceController,
        TractController,
    }
});

</script>

<template>
<span class="loading" v-if="!config.tracts">Loading Config</span>
<div v-if="config.tracts" class="main">
    <div class="tooltip" ref="tooltip" v-show="tooltip">{{tooltip}}</div>
    <div class="view" ref="view" @mousedown="mousedown" @mouseup="mouseup" @mousemove="mousemove"/>

    <div v-if="load_percentage < 1" id="loading" class="loading">Loading... {{loading}} ({{Math.round(load_percentage*100)}}%)</div>

    <SurfaceController :surfaces="surfaces" 
        @menuitementer="menuitementer" 
        @menuitemleave="menuitemleave" 
        @update="updateVisibility"/>
    <TractController :tracts="tracts" 
        @menuitementer="menuitementer" 
        @menuitemleave="menuitemleave" 
        @update="updateVisibility"/>

    <div class="controls-help">
        <span>Rotate</span>
        <span>Zoom</span>
        <span>Pan</span>
        <br>
        <img src="./assets/controls.png" style="height: 40px"/>
    </div>

    <div class="rotateControl">
        <input type="checkbox" v-if="controls.orbit" v-model="controls.orbit.autoRotate" >
        &nbsp;
        <span>Auto-Rotate</span>
        &nbsp;
        <input type="checkbox" v-model="controls.showStart">
        &nbsp;
        <span style="color: #5cf">Show Fiber Startpoint</span>
        &nbsp;
        <input type="checkbox" v-model="controls.showEnd">
        &nbsp;
        <span style="color: #f55">Show Fiber Endpoint</span>
        &nbsp;
    </div>
</div>
</template>

<style lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Roboto&display=swap');

html, body {
    height: 100%;
    margin: 0;
    font-family: Roboto;
    font-size: 12px;
    color: white;
}

.controls {
    position: fixed;
    top: 0;
    bottom: 0;
    width:250px;
    white-space:nowrap;
    background:rgba(0, 0, 0, .3);
    color: #fff;
    user-select: none;

    h2 {
        font-size: 13pt;
        opacity: 0.5;
        color: white;
        margin-bottom: 3px;
    }

    .control-row {
        height: 17px;
        padding-left: 10px;

    }

    .control-row:hover {
        background-color: rgba(0,0,0,0.3);
        color: white !important;
    }

    .check {
        position: absolute;
        opacity: 0.6;
    }

    .check-left {
        right: 35px;
    }

    .check-right {
        right: 15px;
    }
}

.scrollable {
    position: fixed;
    width: 250px;
    top: 35px;
    bottom: 0;
}

#app {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
}

</style>

<style lang="scss" scoped>

.main {
    width: 100%;
    height: 100%;
}

.error {
    position:relative;
    width:100%;
    height:100%;
    background:black;
    color:white;
    padding:10px;
    font-size:20px;
}

.view {
    width: 100%;
    height: 100%;
    background: #333;
    position: absoute;
}

input[type="checkbox"] {
    vertical-align:middle;
    margin:0;
    cursor:pointer;
}

.bllogo {
    position: fixed;
    padding: 8px;
    font-size: 23px;
    font-family: "Open Sans";
    font-weight: bold;
    opacity:.3;
    color:white;
    text-decoration:none;
    bottom: 0px;
    right: 0px;
}

.loading {
    position: fixed;
    width: 100%;
    bottom:150px;
    color:white;
    opacity:.2;
    text-align: center;
    pointer-events: none;
    font-size: 200%;
}

.rotateControl {
    position: fixed;
    bottom: 5px;
    left: 260px;
}
.controls-help {
    color: white;
    position: fixed;
    bottom: 5px;
    right: 255px;
    opacity: 0.7;
}
.controls-help span {
    font-size: 6pt;
    width: 27px;
    display: inline-block;
    text-align: center;
}
.tooltip {
    position: absolute;
    z-index: 1;
    opacity: 0.5;
    background-color: #0008;
    display: inline-block;
    padding: 5px;
}

</style>
