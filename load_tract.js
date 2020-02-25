//importScripts('node_modules/three/build/three.min.js');

//parsing large json and converting them to Float32Array is alow,
//so let's do this on another thread and pass back the vertices
onmessage = function(e) {
    //console.log("message received");
    let tract = e.data;
    //console.dir(tract);
    fetch(tract.url).then(res=>{
        return res.json();
    }).then(json=>{
        var bundle = json.coords;
        console.log(tract.url);

        let node = bundle;
        /*
        while(node) {
            console.log(node.length);
            node = node[0];
        }
        */

        if(bundle.length == 1 && bundle[0][0].length == 3) bundle = bundle[0]; //1>N>3>[] v.s. N>1>3>[]

        //bundle = bundle[0];
        /*
        //if(bundle[0] && bundle[0].length > 3) bundle = bundle[0]; //unwind 
        let depth = 0;
        let node = bundle[0];
        while(node.length == 1 && Array.isArray(node)) {
            depth++;
            node = node[0];
        }
        console.log(tract.url, "depth", depth);
        if(depth == 4) {
            console.log("unwinding",depth);
            bundle = bundle[0];
        }
        console.dir(bundle);
        console.dir(bundle);
        console.log(bundle.length, "fibers");
        */

        //convert each bundle to threads_pos array
        var threads_pos = [];
        bundle.forEach(function(fascicle) {
            //unwind the [ [[...]], [[...]], [[...]] ]  into > [ [...],[...],[...] ] 
            if (fascicle.length == 1 && fascicle[0].length == 3) {
                fascicle = fascicle[0]; 
            }

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
        var vertices = new Float32Array(threads_pos);      
        postMessage(vertices);
    });
}
