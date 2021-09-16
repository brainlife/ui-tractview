<script lang="ts">

import { defineComponent, PropType } from 'vue'

import { ISurfaceLR } from '../interfaces'

import PerfectScrollbar from 'perfect-scrollbar'
import 'perfect-scrollbar/css/perfect-scrollbar.css'

export default defineComponent({
    props: {
        surfaces: {
            type: Object as PropType<{[key: string]: ISurfaceLR}>,
            required: true
        }
    },

    mounted() {
        // @ts-ignore
        new PerfectScrollbar(this.$refs.surfaces);
    },
    methods: {
        color(surface: ISurfaceLR) {
            if(surface.left) return surface.left.color.getStyle();
            if(surface.right) return surface.right.color.getStyle();
        },
        
        menuitementer(tract: ISurfaceLR) {
            //console.log("TractController mouseenter", tract);
            this.$emit("menuitementer", tract);
        },
        menuitemleave(tract: ISurfaceLR) {
            this.$emit("menuitemleave", tract);
        },
    
        check(obj: ISurfaceLR, left: boolean) {
            if(!obj) return;
            if(left) {
                if(obj.left && obj.left.mesh) obj.left.mesh.visible = obj.left_check;
            } else {
                if(obj.right && obj.right.mesh) obj.right.mesh.visible = obj.right_check;
            }
            this.$emit("update");
        },

    }
});

</script>

<template>   
<div class="controls">
    <div class="control-row" style="margin: 8px 0px; position: relative;">
        <b class="check check-left">&nbsp;L&nbsp;</b>
        <b class="check check-right">&nbsp;R&nbsp;</b>
        <h2>Brain Regions</h2>
    </div>
    <div class="scrollable" ref="surfaces">
        <div v-if="surfaces">
            <div v-for="name in Object.keys(surfaces)" :key="name"
                    :style="{color: color(surfaces[name])}" 
                    class="control-row"
                @mouseenter="menuitementer(surfaces[name])" 
                @mouseleave="menuitemleave(surfaces[name])">
                {{name}}
                <input v-if="surfaces[name].left?.mesh" type='checkbox' class="check check-left" @change="check(surfaces[name], true)" v-model='surfaces[name].left_check' />
                <input v-if="surfaces[name].right?.mesh" type='checkbox' class="check check-right" @change="check(surfaces[name], false)" v-model='surfaces[name].right_check' />
            </div>
        </div>
    </div>
    <br>
</div>
</template>