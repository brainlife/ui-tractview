//importScripts('node_modules/three/build/three.min.js');

//parsing large json and converting them to Float32Array is alow,
//so let's do this on another thread and pass back the vertices
let total = 0;
onmessage = function(e) {
    let tract = e.data;
    fetch(tract.url).then(res=>res.json()).then(json=>{
        console.log(tract.url);

        var bundle = json.coords;
        if(bundle.length == 1 && bundle[0][0].length == 3) bundle = bundle[0]; //1>N>3>[] v.s. N>1>3>[]

        //convert each bundle to threads_pos array
        var threads_pos = [];
        var starts = [];
        var ends = [];
        bundle.forEach(function(fascicle) {
            //unwind the [ [[...]], [[...]], [[...]] ]  into > [ [...],[...],[...] ] 
            if (fascicle.length == 1 && fascicle[0].length == 3) {
                fascicle = fascicle[0]; 
            }

            var xs = fascicle[0];
            var ys = fascicle[1];
            var zs = fascicle[2];
            const l = xs.length;

            starts.push(xs[0], ys[0], zs[0]);
            ends.push(xs[l-1], ys[l-1], zs[l-1]);
            total+=1

            for(var i = 1;i < xs.length;++i) {
                threads_pos.push(xs[i-1]);
                threads_pos.push(ys[i-1]);
                threads_pos.push(zs[i-1]);
                threads_pos.push(xs[i]);
                threads_pos.push(ys[i]);
                threads_pos.push(zs[i]);
            }
        });

        postMessage({
            lines: new Float32Array(threads_pos),
            startPoints: new Float32Array(starts),
            endPoints: new Float32Array(ends),
        });
        console.log("total", total);
    });
}
