<script lang="ts">

import { defineComponent, PropType } from 'vue'

import { ITractLR } from '../interfaces'

import PerfectScrollbar from 'perfect-scrollbar'
import 'perfect-scrollbar/css/perfect-scrollbar.css'

export default defineComponent({
    props: {
        tracts: {
            type: Object as PropType<{[key: string]: ITractLR}>,
            required: true
        }
    },
    data() {
        return {
            all_left: false,
            all_right: false,
        }
    },
    computed: {
        sorted_tracts: function() {
            if(!this.tracts) return [];
            return Object.keys(this.tracts).sort();
        }
    },
    mounted() {
        // @ts-ignore
        new PerfectScrollbar(this.$refs.tracts);
    },
    watch: {
        all_left: function(v) {
            for(let name in this.tracts) {
                let tract = this.tracts[name] as ITractLR;
                if(tract.left?.mesh) {
                    tract.left_check = v;   
                    tract.left.mesh.visible = v;
                }
            }
            this.$emit("update");
        },

        all_right: function(v) {
            for(let name in this.tracts) {
                let tract = this.tracts[name] as ITractLR;
                if(tract.right?.mesh) {
                    tract.right_check = v;  
                    tract.right.mesh.visible = v;
                }
            }
            this.$emit("update");
        },
    },

    methods: {
        color(tract: ITractLR) {
            if(tract.left) return tract.left.color.getStyle();
            if(tract.right) return tract.right.color.getStyle();
        },
        
        menuitementer(tract: ITractLR) {
            //console.log("TractController menuitementer", tract);
            this.$emit("menuitementer", tract);
        },
        menuitemleave(tract: ITractLR) {
            this.$emit("menuitemleave", tract);
        },
    
        check(obj: ITractLR, left: boolean) {
            if(!obj) return;
            if(left) {
                if(obj.left?.mesh) obj.left.mesh.visible = obj.left_check;
            } else {
                if(obj.right?.mesh) obj.right.mesh.visible = obj.right_check;
            }
            this.$emit("update");
        },
    },
});

</script>

<template>   
<div class="controls">
    <div class="control-row" style="margin: 8px 0px; position: relative;">
        <b class="check check-left">&nbsp;L&nbsp;</b>
        <b class="check check-right">&nbsp;R&nbsp;</b>
        <h2>White Matter Tracts</h2>
    </div>

    <div class="scrollable" ref="tracts">
        <div v-if="tracts">
            <div class="control-row" style="border-bottom: 1px solid #fff3; padding-bottom: 5px; margin-bottom: 5px">
                <b style="opacity: 0.3; position: relative;">All</b>
                <input type='checkbox' v-model='all_left' class="check check-left"/>
                <input type='checkbox' v-model='all_right' class="check check-right"/>
            </div>

            <div v-for="name in sorted_tracts" :key="name"
                :style="{color: color(tracts[name])}" 
                class="control-row" style="position: relative;"
                @mouseenter="menuitementer(tracts[name])" 
                @mouseleave="menuitemleave(tracts[name])">
                {{name}}
                <input v-if="tracts[name].left?.mesh" type='checkbox' class="check check-left" 
                    @change="check(tracts[name], true)" 
                    v-model='tracts[name].left_check' />
                <input v-if="tracts[name].right?.mesh" type='checkbox' class="check check-right" 
                    @change="check(tracts[name], false)" 
                    v-model='tracts[name].right_check' />
            </div>
            <!--
            <div class="nifti_chooser" style="display:inline-block; max-width:300px; margin-top:5px;">
                <div style="display:inline-block;" v-if="niftis.length > 0">
                    <label style="color:#ccc; width: 120px;">Overlay</label>
                    <select id="nifti_select" class="nifti_select" ref="upload_input" @change="niftiSelectChanged" v-model="selectedNifti">
                    <option :value="null">(No Overlay)</option>
                    <option v-for="(n, i) in niftis" :key="i" :value="i">{{n.filename}}</option>
                    </select>
                </div>
                <br />
                <div class="upload_div">
                    <label for="upload_nifti">Upload Overlay Image (.nii.gz)</label>
                    <input type="file" 
                        style="visibility:hidden;max-height:0;max-width:5px;" 
                        name="upload_nifti" 
                        id="upload_nifti" 
                        @change="upload_file"/>
                </div>
                <div class="plots" id="plots" ref="hist"></div>
            </div>
            -->
        </div>
    </div>
</div>
</template>

<style scoped>
.controls {
    right: 0;
}
</style>