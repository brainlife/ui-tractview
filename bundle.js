(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

$(function() {
    var TractView = require('./tractview.js');
    var jwt = localStorage.getItem('jwt');
    var config = window.config || window.parent.config;
    if(localStorage.getItem('debug_config')) {
        config = JSON.parse(localStorage.getItem("debug_config"));
       //debug: let datauis/wmc view create a debug config
    }

    //set token for each tracts/layers
    config.tracts.forEach(tract=>{
        if(~tract.url.indexOf("?")) tract.url += "&";
        else tract.url += "?";
        tract.url += "at="+jwt;
    });
    if(config.layers) config.layers.forEach(layer=>{
        if(~layer.url.indexOf("?")) layer.url += "&";
        else layer.url += "?";
        layer.url += "at="+jwt;
    });
    
    // code to get steven's instance to work without remote loading
    // config.tracts.forEach(tract => {
    //     tract.url = encodeURI(`http://localhost:8080/wmc_59b2c17a76fddd0027308fb8/1_tracts/${tract.filename}`);
    // });
    // if (config.layers) config.layers.forEach(layer => {
    //     layer.url = encodeURI(`http://localhost:8080/dtiinit_5a26f2c34e57c077cf5e3472/1_./dti/bin/${layer.filename}`);
    // });
    
    console.log("dump");
    console.dir(config);
    TractView.init({
        selector: '#tractview',
        preview_scene_path: 'models/brain.json',
        tracts: config.tracts,
        niftis: config.layers,
    });
});

},{"./tractview.js":6}],2:[function(require,module,exports){
"use strict"

function iota(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = i
  }
  return result
}

module.exports = iota
},{}],3:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],4:[function(require,module,exports){
var iota = require("iota-array")
var isBuffer = require("is-buffer")

var hasTypedArrays  = ((typeof Float64Array) !== "undefined")

function compare1st(a, b) {
  return a[0] - b[0]
}

function order() {
  var stride = this.stride
  var terms = new Array(stride.length)
  var i
  for(i=0; i<terms.length; ++i) {
    terms[i] = [Math.abs(stride[i]), i]
  }
  terms.sort(compare1st)
  var result = new Array(terms.length)
  for(i=0; i<result.length; ++i) {
    result[i] = terms[i][1]
  }
  return result
}

function compileConstructor(dtype, dimension) {
  var className = ["View", dimension, "d", dtype].join("")
  if(dimension < 0) {
    className = "View_Nil" + dtype
  }
  var useGetters = (dtype === "generic")

  if(dimension === -1) {
    //Special case for trivial arrays
    var code =
      "function "+className+"(a){this.data=a;};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return -1};\
proto.size=0;\
proto.dimension=-1;\
proto.shape=proto.stride=proto.order=[];\
proto.lo=proto.hi=proto.transpose=proto.step=\
function(){return new "+className+"(this.data);};\
proto.get=proto.set=function(){};\
proto.pick=function(){return null};\
return function construct_"+className+"(a){return new "+className+"(a);}"
    var procedure = new Function(code)
    return procedure()
  } else if(dimension === 0) {
    //Special case for 0d arrays
    var code =
      "function "+className+"(a,d) {\
this.data = a;\
this.offset = d\
};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return this.offset};\
proto.dimension=0;\
proto.size=1;\
proto.shape=\
proto.stride=\
proto.order=[];\
proto.lo=\
proto.hi=\
proto.transpose=\
proto.step=function "+className+"_copy() {\
return new "+className+"(this.data,this.offset)\
};\
proto.pick=function "+className+"_pick(){\
return TrivialArray(this.data);\
};\
proto.valueOf=proto.get=function "+className+"_get(){\
return "+(useGetters ? "this.data.get(this.offset)" : "this.data[this.offset]")+
"};\
proto.set=function "+className+"_set(v){\
return "+(useGetters ? "this.data.set(this.offset,v)" : "this.data[this.offset]=v")+"\
};\
return function construct_"+className+"(a,b,c,d){return new "+className+"(a,d)}"
    var procedure = new Function("TrivialArray", code)
    return procedure(CACHED_CONSTRUCTORS[dtype][0])
  }

  var code = ["'use strict'"]

  //Create constructor for view
  var indices = iota(dimension)
  var args = indices.map(function(i) { return "i"+i })
  var index_str = "this.offset+" + indices.map(function(i) {
        return "this.stride[" + i + "]*i" + i
      }).join("+")
  var shapeArg = indices.map(function(i) {
      return "b"+i
    }).join(",")
  var strideArg = indices.map(function(i) {
      return "c"+i
    }).join(",")
  code.push(
    "function "+className+"(a," + shapeArg + "," + strideArg + ",d){this.data=a",
      "this.shape=[" + shapeArg + "]",
      "this.stride=[" + strideArg + "]",
      "this.offset=d|0}",
    "var proto="+className+".prototype",
    "proto.dtype='"+dtype+"'",
    "proto.dimension="+dimension)

  //view.size:
  code.push("Object.defineProperty(proto,'size',{get:function "+className+"_size(){\
return "+indices.map(function(i) { return "this.shape["+i+"]" }).join("*"),
"}})")

  //view.order:
  if(dimension === 1) {
    code.push("proto.order=[0]")
  } else {
    code.push("Object.defineProperty(proto,'order',{get:")
    if(dimension < 4) {
      code.push("function "+className+"_order(){")
      if(dimension === 2) {
        code.push("return (Math.abs(this.stride[0])>Math.abs(this.stride[1]))?[1,0]:[0,1]}})")
      } else if(dimension === 3) {
        code.push(
"var s0=Math.abs(this.stride[0]),s1=Math.abs(this.stride[1]),s2=Math.abs(this.stride[2]);\
if(s0>s1){\
if(s1>s2){\
return [2,1,0];\
}else if(s0>s2){\
return [1,2,0];\
}else{\
return [1,0,2];\
}\
}else if(s0>s2){\
return [2,0,1];\
}else if(s2>s1){\
return [0,1,2];\
}else{\
return [0,2,1];\
}}})")
      }
    } else {
      code.push("ORDER})")
    }
  }

  //view.set(i0, ..., v):
  code.push(
"proto.set=function "+className+"_set("+args.join(",")+",v){")
  if(useGetters) {
    code.push("return this.data.set("+index_str+",v)}")
  } else {
    code.push("return this.data["+index_str+"]=v}")
  }

  //view.get(i0, ...):
  code.push("proto.get=function "+className+"_get("+args.join(",")+"){")
  if(useGetters) {
    code.push("return this.data.get("+index_str+")}")
  } else {
    code.push("return this.data["+index_str+"]}")
  }

  //view.index:
  code.push(
    "proto.index=function "+className+"_index(", args.join(), "){return "+index_str+"}")

  //view.hi():
  code.push("proto.hi=function "+className+"_hi("+args.join(",")+"){return new "+className+"(this.data,"+
    indices.map(function(i) {
      return ["(typeof i",i,"!=='number'||i",i,"<0)?this.shape[", i, "]:i", i,"|0"].join("")
    }).join(",")+","+
    indices.map(function(i) {
      return "this.stride["+i + "]"
    }).join(",")+",this.offset)}")

  //view.lo():
  var a_vars = indices.map(function(i) { return "a"+i+"=this.shape["+i+"]" })
  var c_vars = indices.map(function(i) { return "c"+i+"=this.stride["+i+"]" })
  code.push("proto.lo=function "+className+"_lo("+args.join(",")+"){var b=this.offset,d=0,"+a_vars.join(",")+","+c_vars.join(","))
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'&&i"+i+">=0){\
d=i"+i+"|0;\
b+=c"+i+"*d;\
a"+i+"-=d}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a"+i
    }).join(",")+","+
    indices.map(function(i) {
      return "c"+i
    }).join(",")+",b)}")

  //view.step():
  code.push("proto.step=function "+className+"_step("+args.join(",")+"){var "+
    indices.map(function(i) {
      return "a"+i+"=this.shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "b"+i+"=this.stride["+i+"]"
    }).join(",")+",c=this.offset,d=0,ceil=Math.ceil")
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'){\
d=i"+i+"|0;\
if(d<0){\
c+=b"+i+"*(a"+i+"-1);\
a"+i+"=ceil(-a"+i+"/d)\
}else{\
a"+i+"=ceil(a"+i+"/d)\
}\
b"+i+"*=d\
}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a" + i
    }).join(",")+","+
    indices.map(function(i) {
      return "b" + i
    }).join(",")+",c)}")

  //view.transpose():
  var tShape = new Array(dimension)
  var tStride = new Array(dimension)
  for(var i=0; i<dimension; ++i) {
    tShape[i] = "a[i"+i+"]"
    tStride[i] = "b[i"+i+"]"
  }
  code.push("proto.transpose=function "+className+"_transpose("+args+"){"+
    args.map(function(n,idx) { return n + "=(" + n + "===undefined?" + idx + ":" + n + "|0)"}).join(";"),
    "var a=this.shape,b=this.stride;return new "+className+"(this.data,"+tShape.join(",")+","+tStride.join(",")+",this.offset)}")

  //view.pick():
  code.push("proto.pick=function "+className+"_pick("+args+"){var a=[],b=[],c=this.offset")
  for(var i=0; i<dimension; ++i) {
    code.push("if(typeof i"+i+"==='number'&&i"+i+">=0){c=(c+this.stride["+i+"]*i"+i+")|0}else{a.push(this.shape["+i+"]);b.push(this.stride["+i+"])}")
  }
  code.push("var ctor=CTOR_LIST[a.length+1];return ctor(this.data,a,b,c)}")

  //Add return statement
  code.push("return function construct_"+className+"(data,shape,stride,offset){return new "+className+"(data,"+
    indices.map(function(i) {
      return "shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "stride["+i+"]"
    }).join(",")+",offset)}")

  //Compile procedure
  var procedure = new Function("CTOR_LIST", "ORDER", code.join("\n"))
  return procedure(CACHED_CONSTRUCTORS[dtype], order)
}

function arrayDType(data) {
  if(isBuffer(data)) {
    return "buffer"
  }
  if(hasTypedArrays) {
    switch(Object.prototype.toString.call(data)) {
      case "[object Float64Array]":
        return "float64"
      case "[object Float32Array]":
        return "float32"
      case "[object Int8Array]":
        return "int8"
      case "[object Int16Array]":
        return "int16"
      case "[object Int32Array]":
        return "int32"
      case "[object Uint8Array]":
        return "uint8"
      case "[object Uint16Array]":
        return "uint16"
      case "[object Uint32Array]":
        return "uint32"
      case "[object Uint8ClampedArray]":
        return "uint8_clamped"
    }
  }
  if(Array.isArray(data)) {
    return "array"
  }
  return "generic"
}

var CACHED_CONSTRUCTORS = {
  "float32":[],
  "float64":[],
  "int8":[],
  "int16":[],
  "int32":[],
  "uint8":[],
  "uint16":[],
  "uint32":[],
  "array":[],
  "uint8_clamped":[],
  "buffer":[],
  "generic":[]
}

;(function() {
  for(var id in CACHED_CONSTRUCTORS) {
    CACHED_CONSTRUCTORS[id].push(compileConstructor(id, -1))
  }
});

function wrappedNDArrayCtor(data, shape, stride, offset) {
  if(data === undefined) {
    var ctor = CACHED_CONSTRUCTORS.array[0]
    return ctor([])
  } else if(typeof data === "number") {
    data = [data]
  }
  if(shape === undefined) {
    shape = [ data.length ]
  }
  var d = shape.length
  if(stride === undefined) {
    stride = new Array(d)
    for(var i=d-1, sz=1; i>=0; --i) {
      stride[i] = sz
      sz *= shape[i]
    }
  }
  if(offset === undefined) {
    offset = 0
    for(var i=0; i<d; ++i) {
      if(stride[i] < 0) {
        offset -= (shape[i]-1)*stride[i]
      }
    }
  }
  var dtype = arrayDType(data)
  var ctor_list = CACHED_CONSTRUCTORS[dtype]
  while(ctor_list.length <= d+1) {
    ctor_list.push(compileConstructor(dtype, ctor_list.length-1))
  }
  var ctor = ctor_list[d+1]
  return ctor(data, shape, stride, offset)
}

module.exports = wrappedNDArrayCtor

},{"iota-array":2,"is-buffer":3}],5:[function(require,module,exports){
"use strict"
var assert = require('assert')

var systemEndianness = (function() {
    var buf = new ArrayBuffer(4),
        intArr = new Uint32Array(buf),
        byteArr = new Uint8Array(buf)
    intArr[0] = 0x01020304
    if (byteArr[0]==1 && byteArr[1]==2 && byteArr[2]==3 && byteArr[3]==4) {
        return 'big'
    } else if (byteArr[0]==4 && byteArr[1]==3 && byteArr[2]==2 && byteArr[3]==1) {
        return 'little'
    }
    console.warn("Unrecognized system endianness!")
    return undefined
})()

// Parses a NIfTI header
module.exports.parseNIfTIHeader = parseNIfTIHeader
function parseNIfTIHeader(buffer_org) {
  var buf8 = new Uint8Array(buffer_org)
  var buffer = buf8.buffer // Make sure we have an ArrayBuffer
  var view = new DataView(buffer)
  if (buffer.byteLength<348) {
    throw new Error("The buffer is not even large enough to contain the minimal header I would expect from a NIfTI file!")
  }
  
  // First read dim[0], to determine byte order
  var littleEndian = true
  var dim = new Array(8)
  dim[0] = view.getInt16(40, littleEndian)
  if (1>dim[0] || dim[0]>7) {
    littleEndian = !littleEndian
    dim[0] = view.getInt16(40, littleEndian)
  }
  if (1>dim[0] || dim[0]>7) {
    // Even if there were other /byte/ orders, we wouldn't be able to detect them using a short (16 bits, so only two bytes).
    console.warn("dim[0] is out-of-range, we'll simply try continuing to read the file, but this will most likely fail horribly.")
  }
  
  // Now check header size and magic
  var sizeof_hdr = view.getInt32(0, littleEndian)
  if (sizeof_hdr !== 348 && (1>dim[0] || dim[0]>7)) {
    // Try to recover from weird dim info
    littleEndian = !littleEndian
    dim[0] = view.getInt16(40, littleEndian)
    sizeof_hdr = view.getInt32(0, littleEndian)
    if (sizeof_hdr !== 348) {
      throw new Error("I'm sorry, but I really cannot determine the byte order of the (NIfTI) file at all.")
    }
  } else if (sizeof_hdr < 348) {
    throw new Error("Header of file is smaller than expected, I cannot deal with this.")
  } else if (sizeof_hdr !== 348) {
    console.warn("Size of NIfTI header different from what I expect, but I'll try to do my best anyway (might cause trouble).")
  }
  var magic = String.fromCharCode.apply(null, buf8.subarray(344, 348))
  if (magic !== "ni1\0" && magic !== "n+1\0") {
    throw new Error("Sorry, but this does not appear to be a NIfTI-1 file. Maybe Analyze 7.5 format? or NIfTI-2?")
  }
  
  // Read some more structured header fields
  var dim_info = view.getInt8(39)
  dim.length = 1+Math.min(7, dim[0])
  for(var i=1; i<dim.length; i++) {
    dim[i] = view.getInt16(40+2*i, littleEndian)
    if (dim[i]<=0) {
      console.warn("dim[0] was probably wrong or corrupt")
      dim.length = i
    }
  }
  if (dim.length === 1) throw new Error("No valid dimensions!")
  
  var pixdim = new Array(dim.length)
  for(var i=0; i<pixdim.length; i++) {
    pixdim[i] = view.getFloat32(76+4*i, littleEndian)
  }
  
  var srow = new Float32Array(12)
  for(var i=0; i<12; i++) {
    srow[i] = view.getFloat32(280+4*i, littleEndian)
  }
  
  // Read simple header fields and build up object representing the header
  var header = {
    littleEndian: littleEndian,
    
    sizeof_hdr: sizeof_hdr,
    dim_info: dim_info,
    dim: dim,
    intent_p1: view.getFloat32(56, littleEndian),
    intent_p2: view.getFloat32(56, littleEndian),
    intent_p3: view.getFloat32(56, littleEndian),
    intent_code: view.getInt16(68, littleEndian),
  
    datatype: decodeNIfTIDataType(view.getInt16(70, littleEndian)),
    bitpix: view.getInt16(72, littleEndian),
    slice_start: view.getInt16(74, littleEndian),
    pixdim: pixdim,
    vox_offset: view.getFloat32(108, littleEndian),
    
    scl_slope: view.getFloat32(112, littleEndian),
    scl_inter: view.getFloat32(116, littleEndian),
    slice_end: view.getInt16(120, littleEndian),
    slice_code: view.getInt8(122),
    xyzt_units: decodeNIfTIUnits(view.getInt8(123)),
    cal_max: view.getFloat32(124, littleEndian),
    cal_min: view.getFloat32(128, littleEndian),
    slice_duration: view.getFloat32(132, littleEndian),
    toffset: view.getFloat32(136, littleEndian),
  
    descrip: String.fromCharCode.apply(null, buf8.subarray(148, 228)),
    aux_file: String.fromCharCode.apply(null, buf8.subarray(228, 252)),
  
    qform_code: view.getInt16(252, littleEndian),
    sform_code: view.getInt16(254, littleEndian),
  
    quatern_b: view.getFloat32(256, littleEndian),
    quatern_c: view.getFloat32(260, littleEndian),
    quatern_d: view.getFloat32(264, littleEndian),
    qoffset_x: view.getFloat32(268, littleEndian),
    qoffset_y: view.getFloat32(272, littleEndian),
    qoffset_z: view.getFloat32(276, littleEndian),
    
    srow: srow,
  
    intent_name: String.fromCharCode.apply(null, buf8.subarray(328, 344)),
    
    magic: magic,
  
    extension: buffer.byteLength < 348+4 ? [0,0,0,0] : [view.getInt8(348), view.getInt8(349), view.getInt8(350), view.getInt8(351)]
  }
  
  // Check bitpix
  
  // "Normalize" datatype (so that rgb/complex become several normal floats rather than compound types, possibly also do something about bits)
  // Note that there is actually both an rgb datatype and an rgb intent... (My guess is that the datatype corresponds to sizes = [3,dim[0],...], while the intent might correspond to sizes = [dim[0],...,dim[5]=3].)
  
  return header  
}

// Converts a NIfTI header to an NRRD-compatible structure
function NIfTIToNRRD(niftiHeader) {
  var ret = {}
  ret.dimension = niftiHeader.dim[0]
  ret.type = niftiHeader.datatype // TODO: Check that we do not feed anything incompatible?
  ret.encoding = 'raw'
  ret.endian = niftiHeader.littleEndian ? 'little' : 'big'
  ret.sizes = niftiHeader.dim.slice(1) // Note that both NRRD and NIfTI use the convention that the fastest axis comes first!
  ret.thicknesses=niftiHeader.pixdim.slice(1);

  if (niftiHeader.xyzt_units !== undefined) {
    ret.spaceUnits = niftiHeader.xyzt_units
    while(ret.spaceUnits.length < ret.dimension) { // Pad if necessary
      ret.spaceUnits.push("")
    }
    ret.spaceUnits.length = ret.dimension // Shrink if necessary
  }
  
  if (niftiHeader.qform_code === 0) { // "method 1"
    ret.spacings = niftiHeader.pixdim.slice(1)
    while(ret.spacings.length < ret.dimension) {
      ret.spacings.push(NaN)
    }
    ret.spaceDimension = Math.min(ret.dimension, 3) // There might be non-3D data sets? (Although the NIfTI format does seem /heavily/ reliant on assuming a 3D space.)
  } else if (niftiHeader.qform_code > 0) { // "method 2"
    // TODO: Figure out exactly what to do with the different qform codes.
    ret.space = "right-anterior-superior" // Any method for orientation (except for "method 1") uses this, apparently.
    var qfac = niftiHeader.pixdim[0] === 0.0 ? 1 : niftiHeader.pixdim[0]
    var a = Math.sqrt(Math.max(0.0,1.0-(niftiHeader.quatern_b*niftiHeader.quatern_b + niftiHeader.quatern_c*niftiHeader.quatern_c + niftiHeader.quatern_d*niftiHeader.quatern_d)))
    var b = niftiHeader.quatern_b
    var c = niftiHeader.quatern_c
    var d = niftiHeader.quatern_d
    ret.spaceDirections = [
      [niftiHeader.pixdim[1]*(a*a+b*b-c*c-d*d),niftiHeader.pixdim[1]*(2*b*c+2*a*d),niftiHeader.pixdim[1]*(2*b*d-2*a*c)],
      [niftiHeader.pixdim[2]*(2*b*c-2*a*d),niftiHeader.pixdim[2]*(a*a+c*c-b*b-d*d),niftiHeader.pixdim[2]*(2*c*d+2*a*b)],
      [qfac*niftiHeader.pixdim[3]*(2*b*d+2*a*c),qfac*niftiHeader.pixdim[3]*(2*c*d-2*a*b),qfac*niftiHeader.pixdim[3]*(a*a+d*d-c*c-b*b)]]
    ret.spaceOrigin = [niftiHeader.qoffset_x,niftiHeader.qoffset_y,niftiHeader.qoffset_z]
  } else {
    console.warn("Invalid qform_code: " + niftiHeader.qform_code + ", orientation is probably messed up.")
  }
  // TODO: Here we run into trouble, because in NRRD we cannot expose two DIFFERENT (not complementary, different!) transformations. Even more frustrating is that sform transformations are actually more compatible with NRRD than the qform methods.
  if (niftiHeader.sform_code > 0) {
    console.warn("sform transformation are currently ignored.")
  }
  /*if (niftiHeader.sform_code > 0) { // "method 3"
    ret.space = "right-anterior-superior" // Any method for orientation (except for "method 1") uses this, apparently.
    ret.spaceDirections = [
      [niftiHeader.srow[0*4 + 0],niftiHeader.srow[1*4 + 0],niftiHeader.srow[2*4 + 0]],
      [niftiHeader.srow[0*4 + 1],niftiHeader.srow[1*4 + 1],niftiHeader.srow[2*4 + 1]],
      [niftiHeader.srow[0*4 + 2],niftiHeader.srow[1*4 + 2],niftiHeader.srow[2*4 + 2]]]
    ret.spaceOrigin = [niftiHeader.srow[0*4 + 3],niftiHeader.srow[1*4 + 3],niftiHeader.srow[2*4 + 3]]
  }*/
  // TODO: Enforce that spaceDirections and so on have the correct size.
  
  // TODO: We're still missing an awful lot of info!
  
  return ret
}

// Just parses the header
// This expects an ArrayBuffer or (Node.js) Buffer
module.exports.parseHeader = function (buffer_org) {
  var niftiHeader = parseNIfTIHeader(buffer_org)
  var ret = NIfTIToNRRD(niftiHeader)
  return ret
}

// Parses both header and data
// This expects an ArrayBuffer or (Node.js) Buffer
module.exports.parse = function (buffer_org) {
  var niftiHeader = parseNIfTIHeader(buffer_org)
  var ret = NIfTIToNRRD(niftiHeader)

  if (niftiHeader.extension[0] !== 0) {
    console.warn("Looks like there are extensions in use in this NIfTI file, which will all be ignored!")
  }
  
  // Read data if it is here
  if (niftiHeader.magic === "n+1\0") {
    var buf8 = new Uint8Array(buffer_org)
    var buffer = buf8.buffer // Make sure we have an ArrayBuffer
    if (niftiHeader.vox_offset<352 || niftiHeader.vox_offset>buffer.byteLength) {
      throw new Error("Illegal vox_offset!")
    }
    ret.buffer = buffer.slice(Math.floor(niftiHeader.vox_offset))
    if (niftiHeader.datatype !== 0) {
      // TODO: It MIGHT make sense to equate DT_UNKNOWN (0) to 'block', with bitpix giving the block size in bits
      ret.data = parseNIfTIRawData(ret.buffer, niftiHeader.datatype, niftiHeader.dim, {endianFlag: niftiHeader.littleEndian})
    }
  }
  
  return ret
}

function parseNIfTIRawData(buffer, type, dim, options) {
  var i, arr, view, totalLen = 1, endianFlag = options.endianFlag, endianness = endianFlag ? 'little' : 'big'
  for(i=1; i<dim.length; i++) {
    totalLen *= dim[i]
  }
  if (type == 'block') {
    // Don't do anything special, just return the slice containing all blocks.
    return buffer.slice(0,totalLen*options.blockSize)
  } else if (type == 'int8' || type == 'uint8' || endianness == systemEndianness) {
    switch(type) {
    case "int8":
      checkSize(1)
      return new Int8Array(buffer.slice(0,totalLen))
    case "uint8":
      checkSize(1)
      return new Uint8Array(buffer.slice(0,totalLen))
    case "int16":
      checkSize(2)
      return new Int16Array(buffer.slice(0,totalLen*2))
    case "uint16":
      checkSize(2)
      return new Uint16Array(buffer.slice(0,totalLen*2))
    case "int32":
      checkSize(4)
      return new Int32Array(buffer.slice(0,totalLen*4))
    case "uint32":
      checkSize(4)
      return new Uint32Array(buffer.slice(0,totalLen*4))
    //case "int64":
    //  checkSize(8)
    //  return new Int64Array(buffer.slice(0,totalLen*8))
    //case "uint64":
    //  checkSize(8)
    //  return new Uint64Array(buffer.slice(0,totalLen*8))
    case "float":
      checkSize(4)
      return new Float32Array(buffer.slice(0,totalLen*4))
    case "double":
      checkSize(8)
      return new Float64Array(buffer.slice(0,totalLen*8))
    default:
      console.warn("Unsupported NIfTI type: " + type)
      return undefined
    }
  } else {
    view = new DataView(buffer)
    switch(type) {
    case "int8": // Note that here we do not need to check the size of the buffer, as the DataView.get methods should throw an exception if we read beyond the buffer.
      arr = new Int8Array(totalLen)
      for(i=0; i<totalLen; i++) {
        arr[i] = view.getInt8(i)
      }
      return arr
    case "uint8":
      arr = new Uint8Array(totalLen)
      for(i=0; i<totalLen; i++) {
        arr[i] = view.getUint8(i)
      }
      return arr
    case "int16":
      arr = new Int16Array(totalLen)
      for(i=0; i<totalLen; i++) {
        arr[i] = view.getInt16(i*2)
      }
      return arr
    case "uint16":
      arr = new Uint16Array(totalLen)
      for(i=0; i<totalLen; i++) {
        arr[i] = view.getUint16(i*2)
      }
      return arr
    case "int32":
      arr = new Int32Array(totalLen)
      for(i=0; i<totalLen; i++) {
        arr[i] = view.getInt32(i*4)
      }
      return arr
    case "uint32":
      arr = new Uint32Array(totalLen)
      for(i=0; i<totalLen; i++) {
        arr[i] = view.getUint32(i*4)
      }
      return arr
    //case "int64":
    //  arr = new Int64Array(totalLen)
    //  for(i=0; i<totalLen; i++) {
    //    arr[i] = view.getInt64(i*8)
    //  }
    // return arr
    //case "uint64":
    //  arr = new Uint64Array(totalLen)
    //  for(i=0; i<totalLen; i++) {
    //    arr[i] = view.getUint64(i*8)
    //  }
    //  return arr
    case "float":
      arr = new Float32Array(totalLen)
      for(i=0; i<totalLen; i++) {
        arr[i] = view.getFloat32(i*4)
      }
      return arr
    case "double":
      arr = new Float64Array(totalLen)
      for(i=0; i<totalLen; i++) {
        arr[i] = view.getFloat64(i*8)
      }
      return arr
    default:
      console.warn("Unsupported NRRD type: " + type)
      return undefined
    }
  }
  function checkSize(sizeOfType) {
    if (buffer.byteLength<totalLen*sizeOfType) throw new Error("NIfTI file does not contain enough data!")
  }
}

function decodeNIfTIDataType(datatype) {
  switch(datatype) {
  case 1:
    return 'bit'
  case 2:
    return 'uint8'
  case 4:
    return 'int16'
  case 8:
    return 'int32'
  case 16:
    return 'float'
  case 32:
    return 'complex64'
  case 64:
    return 'double'
  case 128:
    return 'rgb24'
  case 256:
    return 'int8'
  case 512:
    return 'uint16'
  case 768:
    return 'uint32'
  case 1024:
    return 'int64'
  case 1280:
    return 'uint64'
  case 1536:
    return 'float128'
  case 1792:
    return 'complex128'
  case 2048:
    return 'complex256'
  case 2304:
    return 'rgba32'
  default:
    console.warn("Unrecognized NIfTI data type: " + datatype)
    return datatype
  }
}

function decodeNIfTIUnits(units) {
  var space, time
  switch(units & 7) {
  case 0:
    space = ""
    break
  case 1:
    space = "m"
    break
  case 2:
    space = "mm"
    break
  case 3:
    space = "um"
    break
  default:
    console.warn("Unrecognized NIfTI unit: " + (units&7))
    space = ""
  }
  switch(units & 56) {
  case 0:
    time = ""
    break
  case 8:
    time = "s"
    break
  case 16:
    time = "ms"
    break
  case 24:
    time = "us"
    break
  case 32:
    time = "Hz"
    break
  case 40:
    time = "ppm"
    break
  case 48:
    time = "rad/s"
    break
  default:
    console.warn("Unrecognized NIfTI unit: " + (units&56))
    time = ""
  }
  return (space === "" && time === "") ? undefined : [space, space, space, time]
}


},{"assert":7}],6:[function(require,module,exports){

var ndarray = require('ndarray');
var nifti = require('nifti-js');

/*
var Plotly = require('plotly.js/lib/core');
Plotly.register([
        require('plotly.js/lib/histogram')
]);
*/


var TractView = {

    /**
     * Inits the tractography viewer
     * 
     * @param {String} config.selector -> Query selector for the element that will contain the tractview control
     * @param {Object[]} config.tracts -> Array containing name,color,and url for each tracts to load
     * 
     * (Optional)
     * @param {String} config.preview_scene_path -> Path to the scene to use which portrays the orientation of the brain
     */
    init: function(config) {
        if (!config) throw "Error: No config provided";

        var color_map, color_map_head, all_geometry = [], all_mesh = [], brainRotationX = -Math.PI/2;

        // set up for later
        config.num_fibers = 0;
        config.LRtractNames = {};

        if (typeof config.selector != 'string')
            throw "Error: config.selector not provided or not set to a string";
        if (typeof config.tracts != 'object')
            throw "Error: config.tracts not provided";

        var user_container = $(config.selector);
        if (user_container.length == 0)
            throw `Error: Selector '${config.selector}' did not match any elements`;

        populateHtml(user_container);

        var scene, camera;
        var user_uploaded_files = {};

        var view = user_container.find("#conview"),
        tinyBrain = user_container.find("#tinybrain"),
        controls_el = user_container.find("#controls"),
        container_toggles = user_container.find("#container_toggles"),
        tract_toggles_el = user_container.find("#tract_toggles"),
        hide_show_el = user_container.find("#hide_show"),
        hide_show_text_el = user_container.find("#hide_show_text"),
        nifti_select_el = user_container.find("#nifti_select");
        
        create_nifti_options();
        $("#upload_nifti").on('change', function() {
            // should we allow multiple uploads at once?
            // for now just one, easy to expand
            var file = this.files[0];
            var reader = new FileReader();
            reader.addEventListener('load', function(buffer) {
                // if file was already uploaded with same name we could use unique tokens or just override the old one, as is done here (simplicity over extensibility)
                if (user_uploaded_files[file.name]) console.log(`Warning: file with name ${file.name} was already uploaded; the old one will be overwritten`);
                else nifti_select_el.append($("<option/>").text(file.name).val(`user_uploaded|${file.name}`));
                
                // buffer is reader.result
                user_uploaded_files[file.name] = reader.result;
                
                // to autouse the uploaded nifti, or to not autouse the uploaded nifti, that is the question
                // for now I think yes...
                // but if you think no then remove the following line:
                nifti_select_el.val(`user_uploaded|${file.name}`).trigger('change');
            });
            reader.readAsArrayBuffer(this.files[0]);
        });
        
        init_conview();

        function init_conview() {
            var renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
            var brainRenderer = new THREE.WebGLRenderer({alpha: true, antialias: true});

            scene = new THREE.Scene();

            //camera
            camera = new THREE.PerspectiveCamera( 45, view.width() / view.height(), 1, 5000);
            var brainCam = new THREE.PerspectiveCamera( 45, tinyBrain.width() / tinyBrain.height(), 1, 5000 );
            camera.position.z = 200;

            //resize view
            function resized() {
                camera.aspect = view.width() / view.height();
                camera.updateProjectionMatrix();
                renderer.setSize(view.width(), view.height());
            }
            $(window).on('resize', resized);
            view.on('resize', resized);

            // add tiny brain (to show the orientation of the brain while the user looks at fascicles)
            var loader = new THREE.ObjectLoader();
            var tinyBrainScene, brainlight;

            if (config.preview_scene_path) {
                loader.load(config.preview_scene_path, _scene => {
                    tinyBrainScene = _scene;
                    var brainMesh = tinyBrainScene.children[1], unnecessaryDirectionalLight = tinyBrainScene.children[2];
                    // align the tiny brain with the model displaying fascicles

                    brainMesh.rotation.z += Math.PI / 2;
                    brainMesh.material = new THREE.MeshLambertMaterial({color: 0xffcc99});

                    tinyBrainScene.remove(unnecessaryDirectionalLight);

                    var amblight = new THREE.AmbientLight(0x101010);
                    tinyBrainScene.add(amblight);

                    brainlight = new THREE.PointLight(0xffffff, 1);
                    brainlight.radius = 20;
                    brainlight.position.copy(brainCam.position);
                    tinyBrainScene.add(brainlight);
                });
            }

            // sort + make non-LR based tracts appear first
            config.tracts.sort((_a, _b) => {
                var a = _a.name;
                var b = _b.name;
                var a_has_lr = isLeftTract(a) || isRightTract(a);
                var b_has_lr = isLeftTract(b) || isRightTract(b);

                if (a_has_lr && !b_has_lr) return 1;
                if (!a_has_lr && b_has_lr) return -1;

                if (a > b) return 1;
                if (a == b) return 0;
                return -1;
            });

            // make 'All' button that toggles everything on/off
            var checkbox_all = $('<input type="checkbox" id="checkbox_all" checked />');
            checkbox_all.on('change', e => {
                for (let tractName in config.LRtractNames) {
                    let toggle = config.LRtractNames[tractName];
                    if (toggle.left) {
                        if (toggle.left.checkbox[0].checked != e.target.checked) toggle.left.checkbox.click();
                        if (toggle.right.checkbox[0].checked != e.target.checked) toggle.right.checkbox.click();
                    }
                    else {
                        if (toggle.checkbox[0].checked != e.target.checked) toggle.checkbox.click();
                    }
                }
            });

            // add header toggles to controls
            tract_toggles_el.append(
                    $('<tr/>').addClass('header').append([
                        $('<td><label class="all" for="checkbox_all">All</label></td>').append(checkbox_all),
                        $('<td><label>Left</label></td>'),
                        $('<td><label>Right</label></td>')
                    ])
                    );

            // group together tract names in the following way:
            // tractName -> { left: {tractNameLeft, mesh}, right: {tractNameRight, mesh} }
            // or tractName -> {mesh} if there are no children
            config.tracts.forEach(tract=>{

                //convert color array to THREE.Color
                tract.color = new THREE.Color(tract.color[0], tract.color[1], tract.color[2]);

                var rawName = tract.name.replace(/ [LR]$|^(Left|Right) /g, "");
                if (rawName != tract.name) {
                    config.LRtractNames[rawName] = config.LRtractNames[rawName] || {};
                    if (isLeftTract(tract.name)) config.LRtractNames[rawName].left = tract;
                    else config.LRtractNames[rawName].right = tract;
                }
                else config.LRtractNames[rawName] = tract;   // standalone, not left or right
            });

            // add tract toggles to controls
            for (let tractName in config.LRtractNames) {
                let subTracts = config.LRtractNames[tractName];

                // toggles that only have a name and a single checkbox
                if (!~Object.keys(subTracts).indexOf('left')) {
                    var row = makeToggle(tractName, {
                        hideRightToggle: true,
                        onchange_left: (left_checked) => {
                            subTracts.mesh.visible = left_checked;
                            subTracts._restore.visible = left_checked;

                            // if (!left_checked) row.addClass('disabled');
                            // else row.removeClass('disabled');
                        },
                        onmouseenter: e => {
                            subTracts.mesh.visible = true;
                            subTracts.mesh.material.color = new THREE.Color(1, 1, 1);
                        },
                        onmouseleave: e => {
                            var restore = config.LRtractNames[tractName]._restore;
                            subTracts.mesh.visible = restore.visible;
                            subTracts.mesh.material.color = restore.color;
                        }
                    });

                    subTracts.checkbox = row.checkbox_left;
                    subTracts._restore = {
                        visible: true,
                        color: subTracts.color,
                    };
                } else {
                    // toggles that have both L + R checkboxes, almost the same as code above, just done twice
                    let left = subTracts.left;
                    let right = subTracts.right;

                    var row = makeToggle(tractName, {
                        onchange_left: (left_checked, none_checked) => {
                            left.mesh.visible = left_checked;
                            left._restore.visible = left_checked;
                            // if (none_checked) row.addClass('disabled');
                            // else row.removeClass('disabled');
                        },
                        onchange_right: (right_checked, none_checked) => {
                            right.mesh.visible = right_checked;
                            right._restore.visible = right_checked;

                            // if (none_checked) row.addClass('disabled');
                            // else row.removeClass('disabled');
                        },
                        onmouseenter: e => {
                            left.mesh.visible = true;
                            left.mesh.material.color = new THREE.Color(1, 1, 1);
                            right.mesh.visible = true;
                            right.mesh.material.color = new THREE.Color(1, 1, 1);
                        },
                        onmouseleave: e => {
                            left.mesh.visible = left._restore.visible;
                            left.mesh.material.color = left._restore.color;
                            right.mesh.visible = right._restore.visible;
                            right.mesh.material.color = right._restore.color;
                        }
                    });

                    left.checkbox = row.checkbox_left;
                    left._restore = {
                        visible: true,
                        color: subTracts.left.color, 
                    };

                    right.checkbox = row.checkbox_right;
                    right._restore = {
                        visible: true, 
                        color: subTracts.right.color,
                    };
                }
                tract_toggles_el.append(row);
            }

            // configure hiding/showing the panel
            hide_show_text_el.text('Hide Controls');
            hide_show_el.on("click", e => {
                if (container_toggles.css('opacity') == '0') {
                    container_toggles.css({ 'max-width': '500px', 'opacity': 1 });
                    controls_el.css({ 'overflow-y': 'auto' });
                    hide_show_text_el.text('Hide Controls');
                }
                else {
                    hide_show_el.css('min-height', container_toggles.height() + 'px');
                    container_toggles.css({ 'max-width': '0px', 'opacity': 0 });
                    controls_el.css({ 'overflow-y': 'hidden' });
                    hide_show_text_el.text('Show Controls');
                }
            });

            // start loading the tract
            config.tracts.forEach((tract, i)=>{
                load_tract(tract, i, function(err, mesh, res) {
                    add_mesh_to_scene(mesh);
                    config.num_fibers += res.coords.length;
                    tract.mesh = mesh;
                });
            });

            renderer.autoClear = false;
            renderer.setSize(view.width(), view.height());
            view.append(renderer.domElement);

            brainRenderer.autoClear = false;
            brainRenderer.setSize(tinyBrain.width(), tinyBrain.height());
            tinyBrain.append(brainRenderer.domElement);

            //use OrbitControls and make camera light follow camera position
            var controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.autoRotate = true;
            controls.addEventListener('change', function() {
                //rotation changes
            });
            controls.addEventListener('start', function(){
                //use interacting with control
                controls.autoRotate = false;
            });
            function animate_conview() {
                controls.update();

                renderer.clear();
                renderer.clearDepth();
                renderer.render( scene, camera );

                // handle display of the tiny brain preview
                if (tinyBrainScene) {
                    // normalize the main camera's position so that the tiny brain camera is always the same distance away from <0, 0, 0>
                    var pan = controls.getPanOffset();
                    var pos3 = new THREE.Vector3(camera.position.x - pan.x, camera.position.y - pan.y, camera.position.z - pan.z).normalize();
                    brainCam.position.set(pos3.x * 10, pos3.y * 10, pos3.z * 10);
                    brainCam.rotation.copy(camera.rotation);

                    brainlight.position.copy(brainCam.position);

                    brainRenderer.clear();
                    brainRenderer.render(tinyBrainScene, brainCam);
                }

                requestAnimationFrame( animate_conview );
            }

            animate_conview();
        }

        // helper method for making toggles
        function makeToggle(tractName, options) {
            options = options || {};

            // row that contains the text of the toggle, as well as the left/right checkboxes
            let row = $("<tr/>"),
            td_label = $("<td/>"),
            label = $("<label/>"),
            td_left = $("<td/>"),
            checkbox_left = $("<input/>").attr({ 'type': 'checkbox', 'checked': true }),
            td_right = $("<td/>"),
            checkbox_right = $("<input/>").attr({ 'type': 'checkbox', 'checked': true });

            label.text(tractName);

            // mouse events
            row.on('mouseenter', e => {
                row.addClass('active');
                if (options.onmouseenter)
                    options.onmouseenter(e);
            });
            row.on('mouseleave', e => {
                row.removeClass('active');
                if (options.onmouseleave)
                    options.onmouseleave(e);
            });

            checkbox_left.on('change', e => {
                var left_checked = checkbox_left[0].checked || false,
                right_checked = checkbox_right[0].checked || options.hideRightToggle || false;

                if (options.onchange_left)
                    options.onchange_left(left_checked, !left_checked && !right_checked);
            });
            checkbox_right.on('change', e => {
                var left_checked = checkbox_left[0].checked || false,
                right_checked = checkbox_right[0].checked || options.hideRightToggle || false;

                if (options.onchange_right)
                    options.onchange_right(right_checked, !left_checked && !right_checked);
            });

            // add everything
            td_label.addClass('label').append(label);
            td_left.addClass('left').append(checkbox_left);
            td_right.addClass('right');
            if (!options.hideRightToggle)
                td_right.append(checkbox_right)

                    row.addClass('row');
            row.append([td_label, td_left, td_right]);

            row.checkbox_left = checkbox_left;
            row.checkbox_right = checkbox_right;

            return row;
        }

        function load_tract(tract, index, cb) {
            $.get(tract.url, res => {
                var bundle = res.coords;

                var threads_pos = [];
                bundle.forEach(function(fascicle) {

                    if (fascicle[0] instanceof Array)
                        fascicle = fascicle[0];
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

                //now show bundle
                var vertices = new Float32Array(threads_pos);
                var geometry = new THREE.BufferGeometry();
                geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3 ) );

                geometry.tract = tract;
                geometry.vertices = vertices;
                geometry.tract_index = index;
                all_geometry.push(geometry);

                cb(null, calculateMesh(geometry), res);
            });
        }

        // returns whether or not the tractName is considered to be a left tract
        function isLeftTract(tractName) {
            return tractName.startsWith('Left ') || tractName.endsWith(' L');
        }
        // returns whether or not the tractName is considered to be a right tract
        function isRightTract(tractName) {
            return tractName.startsWith('Right ') || tractName.endsWith(' R');
        }

        function add_mesh_to_scene(mesh) {
            mesh.rotation.x = brainRotationX;
            all_mesh.push(mesh);
            scene.add(mesh);
        }

        function calculateMesh(geometry) {

            /*
            if (nifti_select_el.val() == 'rainbow') {
                var cols = [];
                for (var i = 0; i < geometry.vertices.length; i += 3) {
                    var l = Math.sqrt(geometry.vertices[i] * geometry.vertices[i] + geometry.vertices[i + 1] * geometry.vertices[i + 1] + geometry.vertices[i + 2] * geometry.vertices[i + 2]);
                    cols.push(geometry.vertices[i] / l);
                    cols.push(geometry.vertices[i + 1] / l);
                    cols.push(geometry.vertices[i + 2] / l);
                }
                geometry.addAttribute('col', new THREE.BufferAttribute(new Float32Array(cols), 3));
                var m = new THREE.LineSegments(geometry, new THREE.ShaderMaterial({
                    vertexShader,
                    fragmentShader
                }) );
                config.tracts[geometry.tract_index].mesh = m;

                return m;
            }
            else
            */
            if (color_map) {
                var vertexShader = `
                    attribute vec4 col;
                    varying vec4 vColor;
                    void main(){
                        vColor = col;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `;

                var fragmentShader = `
                    varying vec4 vColor;
                    void main(){
                        //gl_FragColor = vec4( vColor.rgb, 1.0 );
                        //gl_FragColor = vec4( vColor.rgb[0],1,1,vColor.rgb[0]);
                        gl_FragColor = vColor;
                    }
                `;
                var cols = [];
                var hist = [];
                for (var i = 0; i < geometry.vertices.length; i += 3) {
                    //convert webgl to voxel coordinates
                    var x = Math.round((geometry.vertices[i] - color_map_head.spaceOrigin[0]) / color_map_head.thicknesses[0]);
                    var y = Math.round((geometry.vertices[i+1] - color_map_head.spaceOrigin[1]) / color_map_head.thicknesses[1]);
                    var z = Math.round((geometry.vertices[i+2] - color_map_head.spaceOrigin[2]) / color_map_head.thicknesses[2]);

                    //find voxel value
                    var v = color_map.get(z, y, x);

                    var normalized_v = (v - color_map.min) / (color_map.max - color_map.min);
                    
                    //clip..
                    if(normalized_v < 0.1) normalized_v = 0.1;
                    if(normalized_v > 1) normalized_v = 1;

                    //compute histogram
                    var hv = Math.round(normalized_v*256);
                    if(!hist[hv]) hist[hv] = 1;
                    else hist[hv]++;

                    /*
                    if(x > 63 && x < 66) {// & y > 113 && y < 136 && x > 46 && x < 58) {
                        //console.log(normalized_v);
                    } else {
                        normalized_v = 0.05;
                    }
                    */
                    //TODO - pick a better color?
                    /*
                    cols.push(0); //r
                    cols.push(normalized_v); //g
                    cols.push(0.5); //b
                    cols.push(0.75); //a
                    */
                    //cols.push((geometry.tract.color.r*2)*normalized_v/2);
                    //cols.push((geometry.tract.color.g*2)*normalized_v/2);
                    //cols.push((geometry.tract.color.b*2)*normalized_v/2);
                    cols.push(geometry.tract.color.r*normalized_v);
                    cols.push(geometry.tract.color.g*normalized_v);
                    cols.push(geometry.tract.color.b*normalized_v);
                    //cols.push(normalized_v); //g
                    cols.push(0.8);
                }
                //console.dir(geometry.tract.color);
                geometry.addAttribute('col', new THREE.BufferAttribute(new Float32Array(cols), 4));
                
                //console.log("displaying histographm");
                //console.dir(hist);

                var m = new THREE.LineSegments( geometry, new THREE.ShaderMaterial({
                    vertexShader,
                    fragmentShader,
                    transparent: true,
                }) );
                config.tracts[geometry.tract_index].mesh = m;

                return m;
            } else {
                var m = new THREE.LineSegments( geometry, new THREE.LineBasicMaterial({
                    color: geometry.tract.color,
                    transparent: true,
                    opacity: 0.7
                }) );
                config.tracts[geometry.tract_index].mesh = m;
                return m;
            }    
        }
        
        function reselectAll() {
            for (let tractName in config.LRtractNames) {
                let toggle = config.LRtractNames[tractName];
                if (toggle.left) {
                    toggle.left.checkbox.click().click();
                    toggle.right.checkbox.click().click();
                }
                else toggle.checkbox.click().click();
            }
        }
        
        function recalculateMaterials() {
            while (all_mesh.length)
                scene.remove(all_mesh.pop());

            all_geometry.forEach(geometry => {
                add_mesh_to_scene( calculateMesh(geometry) );
            });
        }

        function create_nifti_options() {
            let preloaded = [];
            nifti_select_el.append($("<option/>").html("None").val('none'));
            //nifti_select_el.append($("<option/>").html("Rainboww!! :D").val('rainbow'));

            if(config.niftis) config.niftis.forEach(nifti => {
                nifti_select_el.append($("<option/>").text(nifti.filename).val(nifti.url));
            });

            nifti_select_el.on('change', function() {
                if (nifti_select_el.val().startsWith("user_uploaded|")) {
                    var buffer = user_uploaded_files[nifti_select_el.val().substring(("user_uploaded|").length)];
                    // TODO check if file is already re-inflated (not .nii.gz but instead just .nii)
                    processDeflatedNiftiBuffer(buffer);
                }
                else if (nifti_select_el.val() == 'none') {// || nifti_select_el.val() == 'rainbow') {
                    color_map = undefined;
                    recalculateMaterials();
                    reselectAll();
                }
                else {
                    fetch(nifti_select_el.val())
                        .then(res => res.arrayBuffer())
                        .then(processDeflatedNiftiBuffer)
                    .catch(err => console.error);
                }
            });
        }
        
        function processDeflatedNiftiBuffer(buffer) {
            var raw = pako.inflate(buffer);
            var N = nifti.parse(raw);

            color_map_head = nifti.parseHeader(raw);
            color_map = ndarray(N.data, N.sizes.slice().reverse());

            color_map.sum = 0;
            N.data.forEach(v=>{
                color_map.sum+=v;
            });
            color_map.mean = color_map.sum / N.data.length;

            //compute sdev
            color_map.dsum = 0;
            N.data.forEach(v=>{
                var d = v - color_map.mean;
                color_map.dsum += d*d;
            });
            color_map.sdev = Math.sqrt(color_map.dsum/N.data.length);

            //set min/max
            color_map.min = color_map.mean - color_map.sdev;
            color_map.max = color_map.mean + color_map.sdev*5;

            console.log("color map");
            console.dir(color_map);

            recalculateMaterials();
            reselectAll();
        }
        
        function populateHtml(element) {
            element.html(`
            <div class="container">
                <!-- Main Connectome View -->
                <div id="conview" class="conview"></div>

                <!-- Tiny Brain to Show Orientation -->
                <div id="tinybrain" class="tinybrain"></div>

                <div id="controls" class="controls">
                    <div style="display:flex;">
                        <!-- Hide/Show Panel -->
                        <div id="hide_show" class="hide_show">
                            <div class="table">
                                <div class="cell">
                                    <div class="rotated" id="hide_show_text"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Fascicle Toggling -->
                        <div class="container_toggles" id="container_toggles">
                            <table class="tract_toggles" id="tract_toggles"></table>

                            <!-- Nifti Choosing -->
                            <div class="nifti_chooser">
                                <select id="nifti_select" class="nifti_select"></select>
                                <div class="upload_div">
                                    <label for="upload_nifti">Upload Nifti</label>
                                    <input type="file" style="visibility:hidden;max-height:0;" name="upload_nifti" id="upload_nifti"></input>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style scoped>
            .container {
                width: 100%;
                height: 100%;
                padding: 0px;
            }
            
            .conview {
                width:100%;
                height: 100%;
                background:#222;
            }
            .tinybrain {
                position:absolute;
                pointer-events:none;
                left:0;
                bottom:0;
                width:100px;
                height:100px;
            }

            .controls {
                display:inline-block;
                position:absolute;
                right:0;
                top:0;
                width:auto;
                height:auto;
                max-height:100%;
                padding-left:1px;
                overflow-x:hidden;
                overflow-y:auto;
                white-space:nowrap;
                font-family:Roboto;
                font-size:12px;
                background:rgba(0, 0, 0, .7);
            }

            .hide_show {
                display:inline-block;
                position:relative;
                vertical-align:top;
                text-align:left;
                width:auto;
                flex:1;
                color: #777;
                overflow:hidden;
                cursor:default;
                transition:background 1s, color 1s;
            }
            .hide_show:hover {
                background:black;
                color:white;
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

            .hide_show .rotated {
                display:inline-block;
                min-width:16px;
                max-width:16px;
                vertical-align:middle;
                transform:rotate(-90deg);
            }

            .container_toggles {
                display:inline-block;
                max-width:500px;
                width:auto;
                height:auto;
                padding-top:2px;
                overflow:hidden;
                transition:max-width .5s, opacity .5s, padding .5s;
            }
            
            .nifti_select {
                margin-bottom:4px;
            }
            
            .upload_div {
                color:#9cc;
            }
            
            .upload_div:hover {
                color:#aff;
            }

            label {
                font-weight:100;
                font-size:12px;
            }
            tr.header {
                color:white;
                text-align:center;
                margin:0;
            }
            tr.header label {
                margin-right:4px;
                cursor:pointer;
            }

            input[type="checkbox"] {
                vertical-align:middle;
                margin:0;
                cursor:pointer;
            }

            td.label {
                text-overflow:ellipsis;
            }

            tr.row.disabled {
                opacity:.5;
            }
            tr.row label {
                color:#ccc;
            }
            tr.row.active label {
                color:#fff;
            }
            </style>
                `);
        }
    }

};

module.exports = TractView;

},{"ndarray":4,"nifti-js":5}],7:[function(require,module,exports){
(function (global){
'use strict';

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util/');
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"util/":11}],8:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],9:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],10:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],11:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":10,"_process":8,"inherits":9}]},{},[1]);
