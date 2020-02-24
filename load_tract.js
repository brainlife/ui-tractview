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
        console.log(tract.url, bundle.length);

        //if(bundle[0] && bundle[0].length > 3) bundle = bundle[0]; //unwind 
        let depth = 0;
        let node = bundle[0];
        while(Array.isArray(node)) {
            depth++;
            node = node[0];
        }
        if(depth > 3) {
            console.log("unwinding",depth);
            bundle = bundle[0];
        }

        //convert each bundle to threads_pos array
        var threads_pos = [];
        bundle.forEach(function(fascicle) {
            if (fascicle.length == 1) fascicle = fascicle[0]; 
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
