import Vue from 'vue'
import App from './App.vue'

Vue.config.productionTip = false

console.log("main.js");

new Vue({
    render: h => h(App),
    data() {
        return {
            tracts: null,
            surfaces: null,
            ready: false
        }
    },
    mounted() {
        let config = window.parent.config || window.config;
        if(!config) return this.loadDemoData();

        //handle a case where there is only 1 surface / tract object
        if(config.tracts && !Array.isArray(config.tracts)) config.tracts = [config.tracts];
        if(config.surfaces && !Array.isArray(config.surfaces)) config.surfaces = [config.surfaces];

        this.tracts = config.tracts;
        this.surfaces = config.surfaces;

        //append jwt to config.
        let jwt = localStorage.getItem("jwt");
        if(jwt && this.tracts) this.tracts.forEach(tract=>{
            tract.url += "?at="+jwt;
        });
        if(jwt && this.surfaces) this.surfaces.forEach(surface=>{
            surface.url += "?at="+jwt;
        });
        this.ready = true;
    },

    methods: {
        loadDemoData() {
            console.log("mountede on app")
            console.dir(this);
            console.dir(this.$root);

            const dataurl = "/testdata/optic";
            //https://brainlife.io/ui/tractview/testdata/0001/tracts/tracts.json
            console.log("loading tracts.json from", dataurl + "/tracts/tracts.json")
            fetch(dataurl+"/tracts/tracts.json").then(res=>res.json()).then(data=>{
                console.log("got tracts.json", data);
                if(!Array.isArray(data)) data = [data];
                this.tracts = data;
                this.tracts.forEach(tract=>{
                    tract.url = dataurl+"/tracts/"+tract.filename;
                });
                fetch(dataurl+"/surfaces/index.json").then(res=>res.json()).then(data=>{
                    if(!Array.isArray(data)) data = [data];
                    this.surfaces = data;
                    this.surfaces.forEach(surface=>{
                        surface.url = dataurl+"/surfaces/"+surface.filename;
                    });
                    this.ready = true;
                }).catch(err=>{
                    console.err(err);
                    console.log("not using surfaces");
                    this.ready = true;
                });
            });
        },
    }
}).$mount('#app')
