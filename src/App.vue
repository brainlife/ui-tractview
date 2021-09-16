<template>
<div id="app">
    <Tractview v-if="$root.ready"/>
    <span class="loading" v-if="!$root.ready">Loading Config</span>
</div>
</template>

<script>

import Tractview from './components/Tractview.vue'

console.log("App.vue here");

export default {
    name: 'App',
    components: {
        Tractview
    },
    data() {
        return {
        }
    },
}
</script>

<style>
#app {
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: Roboto;
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
    /*
    background: radial-gradient( circle, transparent 30%, black 150%), rgb(46, 39, 39);
    */
    background: #111;
}
.tinybrain {
    position:absolute;
    pointer-events:none;
    left:0;
    bottom:0;
}

.controls {
    position: fixed;
    top: 0;
    bottom: 0;
    width:250px;
    white-space:nowrap;
    font-size:12px;
    font: "Lucida Grande", sans-serif;
    background:rgba(0, 0, 0, .1);
    color: #fff;
    user-select: none;
}
.scrollable {
    position: fixed;
    width: 250px;
    top: 35px;
    left: 0;
    bottom: 0;
}

.controls h2 {
    font-size: 13pt;
    opacity: 0.5;
    color: white;
    margin-bottom: 3px;
}
.controls .control-row {
height: 17px;
padding-left: 10px;
}
.controls .control-row:hover {
background-color: rgba(0,0,0,0.3);
color: white !important;
}
.controls .check {
position: absolute;
opacity: 0.6;
}
.controls .check-left {
right: 35px;
}
.controls .check-right {
right: 15px;
}

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
.rotateControl {
position: fixed;
bottom: 5px;
left: 260px;
}
.controls-help {
position: fixed;
bottom: 5px;
right: 255px;
opacity: 0.7;
}
.controls-help span {
font-size: 6pt;
width: 25px;
display: inline-block;
text-align: center;
}
</style>
