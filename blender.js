/**
 * @author
 *   This file was created and its content is owned mostly by Antonio Noack, from Germany, Jena, 10th December 2017
 *   Many thanks to Holger Machens, creator of Java .Blend (Hamburg, Germany) from where I got the structure of the blender file system
 *   And some to Oliver Caldwell for coding the binary search part. I was too lazy for this 0815 stuff.
 * 
 * @licensing
 * For the share right part: if you make sick amounts of money while using this, give me 1% of yours ^^
 * Of those 1% 1/3 will go to Holger Machens and 1/13 to Oliver Caldwell :D
 * Otherwise just include me in your credits; besides that it's free :)
 * 
 * @howto
 * - You've to get your data from somewhere... maybe use an XMLHTTPRequest, or let the user drop the file.
 * - Create a BinaryFile object with your data in shape of an array of the bytes. It might be a Uint8Array
 * - Then create a BlenderFile with the BinaryFile.
 * - Then create a Manager with the BlenderFile.
 * 
 *   It's like that to give you a view about the different levels of abstraction.
 * 
 * @debugging
 * The show function is for debugging only: to show you objects in a nicer way than they would be.
 * 
 * @about
 *   The project is intended to read the blender files (only).
 *   If you want to write files, too, write the function yourself, or ask nicely :)
 * 
 * @random
 * - While converting the stuff - I had to learn the struture, too - I wrote a program, that is capable of converting Java files to JavaScript half nicely. Just write me, if you're interested in that :)
 * 
 * @contact
 *   Email: antonio-noack@gmx.de
 *   G+: google.com/+AntonioNoack
 *   more by googling ;P
 * 
 * @version
 *   1.0.2
 * 
 * @history
 *   1.0.1 : well forgotten... was this morning...
 *   1.0.2 : fixed access to "void" data types; pointers; used for e.g. Nodes, which can be useful and important for materials
 */

var SDNA = [];// Structures by (struct-dna-)index
function consumeIdentifier(file, b){
	assert(file.char() == b[0] && file.char() == b[1] && file.char() == b[2] && file.char() == b[3]);
}

function binarySearch(array, data){
	if(!array.length) return ~0;
	
	var num = !isNaN(data);
	var minIndex = 0, maxIndex = array.length - 1;
	var currentIndex, currentElement, resultIndex;
	
	while (minIndex <= maxIndex) {
		resultIndex = currentIndex = (minIndex + maxIndex) / 2 | 0;
		currentElement = array[currentIndex].compareTo(data);
		if (currentElement < 0) {
			minIndex = currentIndex + 1;
		} else if (currentElement > 0) {
			maxIndex = currentIndex - 1;
		} else return currentIndex;
	} return ~maxIndex;
}

function assert(value){
	if(!value) throw "assert false";
}

function cstring(a){
	var s = "";
	for(var i=0;i<a.length;i++){
		var c = a[i];
		if(!c) return s;
		else s+=String.fromCharCode(c);
	}
}

function show(x, j){
	var r = {};
	for(var i in x){
		if(i.startsWith("get")){
			try {
				var a = x[i]();
				r[i] = !j && a && a.class ? show(a, 1) : a;
			} catch(e){}
		}
	} return r;
}

class BlenderFile {
	constructor(file){
		ClassLib.bf = this;
		this.readFileHeader(this.file = file);
		this.readStructDNA();
		
		var offheapAreas = this.header.version < 276 ? ["FileGlobal"]:["FileGlobal", "TreeStoreElem"];
		this.initBlockTable(this.readBlocks(), this.getSdnaIndices(offheapAreas));
	}
	readBlocks(){
		this.blocks = [];// new BlockList... ^^
		this.file.offset(this.firstBlockOffset);
		var blockHeader = new BlockHeader();
		blockHeader.read(this.file);
		
		while (blockHeader.code != "ENDB") {
			
			var block = new Block(blockHeader, this.file.clone(blockHeader.size), this.file.index);
			this.file.skip(blockHeader.size);
			this.blocks.push(block);
			
			blockHeader = new BlockHeader();
			blockHeader.read(this.file);
		} return this.blocks;
	}
	readFileHeader(){
		this.header = new BlenderFileHeader();
		this.header.read(this.file);
		this.firstBlockOffset = this.file.offset();
		// in.close XD
	}
	readStructDNA(){
		this.sdna = null;
		var blockHeader = this.seekFirstBlock("DNA1");
		if(blockHeader){
			this.sdna = new StructDNA();
			this.sdna.read(this.file);
		} else throw "corrupted file :(, can't find DNA1";
	}
	seekFirstBlock(code){
		this.file.offset(this.firstBlockOffset);
		var blockHeader = new BlockHeader();
		blockHeader.read(this.file);
		while(blockHeader.code != "ENDB"){
			if(blockHeader.code == code)
				return blockHeader;
			
			this.file.skip(blockHeader.size);
			blockHeader.read(this.file);
		}
	}
	initBlockTable(blocks, sdnaIndices){this.blockTable = new BlockTable(blocks, sdnaIndices);}
	getSdnaIndices(structNames){
		if(structNames == null) return null;
		this.model = this.getBlenderModel();
		
		var indices = [];
		var length = 0;
		for(var structName in structNames){
			var struct = this.model.getStruct(structName);
			if(struct == null) console.warn("the list of offheap areas contains a struct name wich odesn't exist");
			else indices[length++] = struct.index;
		}
		return indices;
	}
	getBlenderModel(){
		if(this.model==null)
			this.model = new DNAModel(this.sdna, this.header.pointerSize);
		return this.model;
	}
}

class DNAModel {
	constructor(dna, ps){
		this.dna = dna;
		this.types = [];
		for(var i=0;i<dna.types_len;i++){
			this.types.push(new DNAType(dna.types[i], dna.type_lengths[i], ps));
		}
		
		this.structs = [];
		for(var i=0;i<dna.structs.length;i++){
			var s = dna.structs[i];
			this.structs.push(this.createStruct(i, s));
		}
	}
	createStruct(sdnaIndex, s){
		var type = this.getType(s.type);
		var struct = new DNAStruct(sdnaIndex, type, s.fields_len);
		for(var fieldNo=0;fieldNo<s.fields_len;fieldNo++) {
			var field = s.fields[fieldNo];
			struct.fields[fieldNo] = this.createField(struct, fieldNo, field);
		} return struct;
	}
	createField(struct, fieldNo, field){
		return new DNAField(fieldNo, this.dna.names[field.name], this.getType(field.type));
	}
	getStruct(sdnaIndex){return this.structs[sdnaIndex];}
	getType(index){return this.types[index];}
}

class DNAStruct {
	constructor(sdnaIndex, type, fields_len){
		this.index = sdnaIndex;
		this.type = type;
		this.fields = [];
		this.field_len = fields_len;
		this.type.sdna = sdnaIndex;
		this.type.fields = this.fields;
		SDNA[sdnaIndex] = this.type;
	}
}

class DNAType {
	constructor(name, size, ps){
		this.name = name;
		this.size = size || ps;
		DNAType[name] = this;
	}
}

class DNAField {
	constructor(index, name, type){
		this.index = index;
		this.signatureName = name;
		this.name = this.removeSignatureFromName(name);
		this.type = type;
	}
	removeSignatureFromName(name){return name.split("*").join("").split("[")[0];}
	getSignatureName(){return this.signatureName;}
	getSignature(){return this.type.name + " " + this.signatureName;}
}

class BlockTable {
	constructor(blocks, offheapStructs){
		this.allocator = new Allocator(BlockTable.HEAPBASE, BlockTable.HEAPSIZE);
		this.allocatorInitialised = false;

		this.sorted = [];
		
		if(blocks){
			for(var i=0;i<blocks.length;i++){
				this.sorted.push(blocks[i]);
			}
			this.sorted.sort(function(a, b){// BLOCKS_ASCENDING_ADDRESS
				return a.header.address - b.header.address;
			});
			
			this.initOffheapAreas(offheapStructs);
			
			if(this.sorted.length){
				var first = this.sorted[0];
				assert(first.header.address > BlockTable.HEAPBASE);
			}
		}
	}
	findBlock(startAddress) {
		var i = binarySearch(this.sorted, startAddress);
		assert(i > -1);
		return this.sorted[i];
	}
	getBlock(address, sdnaIndex){
		if(sdnaIndex === undefined){
			if (address == 0) return null;
			var i = binarySearch(this.sorted, address);
			if (i >= 0) {
				return this.sorted[i];
			} else {
				// if the address lies between two block start addresses, then 
				// -i-1 is the pos of the block with start address larger
				// than address. But we need the block with a start address
				// lower than address. Thus, -i-2
				i = -i-2;
				if (i >= 0) {
					var b = this.sorted[i];
					if (address < (b.header.address + b.header.size)) {
						// block found
						return b;
					}
				}
			}
		} else {
			if(this.offheapAreas != null && sdnaIndex >= 0){
				var t = this.offheapAreas[sdnaIndex];
				if (t != null){
					return t.findBlock(sdnaIndex);
				}
			} return this.getBlock(address);
		}
	}
	initOffheapAreas(offheap){
		if(!offheap) return;
		
		this.offheapAreas = {};//HashMap<Integer, BlockTable>(offheap.length)
		for (var sdnai in offheap) {
			var sdna = offheap[sdnai];
			this.offheapAreas[sdna] = new BlockTable();
		}
		
		for(var i=0;i<this.sorted.length;i++){
			var b = this.sorted[i];
			for (var sdnai in offheap) {
				var sdna = offheap[sdnai];
				if (b.header.sdnaIndex == sdna) {
					this.offheapAreas[sdna].add(b);
					this.sorted.splice(i, 1);i--;
					break;
				}
			}
		}
		
		this.checkBlockOverlaps();
	}
	add(block){
		// insert block in list
		var i = binarySearch(this.sorted, block.header.address);
		assert(i < 0);
		this.sorted.splice(~i, 0, block);
	}
	checkBlockOverlaps(){
		for (var i=0;i<this.sorted.length;i++) {
			var cur = this.sorted[i];
			for (var j=i+1;j<this.sorted.length;j++) {
				var b = this.sorted[j];
				if(cur.contains(b.header.address)) {
					overlapping.add(cur, b);
					throw "blocks are overlapping!";
				}
			}
		}
	}
}

BlockTable.HEAPBASE = 4096;
BlockTable.HEAPSIZE = 18446744073709552000 - 4096;

class Allocator {
	constructor(heapBase, heapSize){
		this.chunks = new ChunkList(new Chunk(heapBase, heapSize, 0));
		this.cursor = this.chunks.iterator();
	}
}

class Chunk {
	constructor(base, size, state){
		this.prev = this.next = null;
		this.base = base;
		this.size = size;
		this.state = state;
	}
}

class ChunkList {
	constructor(chunk){this.first = this.tail = chunk;}
	iterator(){
		var iter = {next:this.first};
		return iter;
	}
}

class BlockList {
	constructor(){
		this.size = 0;
		this.first = this.last = null;
	}
}

class BlockHeader {
	constructor(){
		this.code = "\0\0\0\0";
	}
	read(file){
		this.code = file.readString(4);
		this.size = file.readInt();
		this.address = file.readLong();
		this.sdnaIndex = file.readInt();
		this.count = file.readInt();
	}
}

class BlenderFileHeader {
	read(file){
		if(file.char()=='B' && file.char()=='L' && file.char()=='E' && file.char()=='N' && file.char()=='D' && file.char()=='E' && file.char()=='R'){
			
			switch(file.char()){
			case '_':file.long = 0;this.pointerSize = 4;break;
			case '-':file.long = 1;this.pointerSize = 8;break;
			default: throw "undef pointer size";
			}
			
			switch(this.byteOrder = file.char()){
			case 'v':file.le = 1;break;
			case 'V':file.le = 0;break;
			default: throw "undef endianess code";
			}
			
			this.version = 1.*(file.char()+file.char()+file.char());
			
		} else throw magic+": this is not a blender file!";
	}
}

class BinaryFile {
	constructor(data){
		this.data = data;
		this.index = 0;
	}
	clone(){
		var bin = new BinaryFile(this.data);
		bin.index = this.index;
		bin.long = this.long;
		bin.le = this.le;
		return bin;
	}
	read(){return this.data[this.index++];}
	char(){return String.fromCharCode(this.read());}
	readLong(){// 52 bit gehen theoretisch... hoffentlich kein Problem...
		if(this.long){
			var a = this.readInt(), b = this.readInt();
			return ((this.le?b:a)*65536*65536)+(this.le?a:b);
		} else return this.readInt();
	}
	readInt(){
		var a = this.readShort(), b = this.readShort();
		return ((this.le?b:a) << 16) | (this.le?a:b)
	}
	readShort(){
		var a = this.read(), b = this.read();
		return ((this.le?b:a) << 8) | (this.le?a:b)
	}
	readString(len){
		var s = "";
		for(var i=0;i<len;i++) s+=this.char();
		return s;
	}
	readByte(){return this.read();}
	readBoolean(){return !!this.read();}
	read0String(removeControlCodes){
		// mal gucken, wann die ControlCodes ein Problem werden...
		// jedenfalls lies den 0 terminierten String:
		var string = "", char;
		while(char = this.read()){
			string += String.fromCharCode(char);
		} return string;
	}
	offset(offset){
		if(offset === undefined){
			return this.index;
		} else {
			if(offset >= this.data.length || offset < 0){
				throw "UnsupportedOperationException";
			} else {
				this.index = offset;
			}
		}
	}
	skip(n){this.index += n;}
	padding(alignment){
		var pos = this.index;
		var misalignment = pos % alignment;
		if(misalignment > 0){
			this.index += alignment - misalignment;
		}
	}
}

class Block {
	constructor(header, data, shift){
		this.header = header;
		this.data = data;
		this.shift = shift;// shift ist erlaubt, weil die Daten eigentlich kopiert werden
	}
	offset(o){this.data.offset(o - this.header.address + this.shift);}
	bytes(n){
		switch(n){
		case 8:
			var a = this.data.readInt(), b = this.data.readInt();
			return ((this.data.le?b:a)*65536*65536) + (this.data.le?a:b)
		case 4:return this.data.readInt();
		case 2:return this.data.readShort();
		case 1:return this.data.read();
		default: throw "unsupported n, just implement it; respect little and big endian! "+n;
		}
	}
	compareTo(long){return this.header.address - long;}
	contains(address){return address >= this.header.address && address < this.header.address + this.header.size;}
}

class StructDNA {
	read(file){
		consumeIdentifier(file, "SDNA");
		consumeIdentifier(file, "NAME");
		this.names_len = file.readInt();
		this.names = [];
		for(var i=0;i<this.names_len;i++){
			this.names.push(file.read0String(true));
		}
		
		file.padding(4);
		consumeIdentifier(file, "TYPE");
		this.types_len = file.readInt();
		this.types = [];
		for(var i=0;i<this.types_len;i++){
			this.types.push(file.read0String(true));
		}
		
		file.padding(4);
		consumeIdentifier(file, "TLEN");
		this.type_lengths = new Int16Array(this.types_len);
		for(var i=0;i<this.types_len;i++){
			this.type_lengths[i] = file.readShort();
		}
		
		file.padding(4);
		consumeIdentifier(file, "STRC");
		this.structs_len = file.readInt();
		this.structs = [];
		for(var i=0;i<this.structs_len;i++){
			var struct = new Struct();
			struct.read(file);
			this.structs.push(struct);
		}
	}
}

class Struct {
	read(file){
		this.type = file.readShort();
		this.fields_len = file.readShort();
		this.fields = [];
		for(var i=0;i<this.fields_len;i++){
			var field = new Field();
			field.read(file);
			this.fields.push(field);
		}
	}
}

class Field {
	read(file){
		this.type = file.readShort();
		this.name = file.readShort();
	}
}

function floatFromBits(bits){
	floatFromBitsIntView[0] = bits;
	return floatFromBitsFloatView[0];
}
var buffer = new ArrayBuffer(4);
var floatFromBitsFloatView = new Float32Array(buffer);
var floatFromBitsIntView = new Int32Array(buffer);

ClassLib = {
	"*":function(name, address){
		if(address){
			var block = this.bf.blockTable.getBlock(address);
			if(!block) return null;
			var type = DNAType[name];
			if(!type.size || type.name == "void"){
				// void data type -> it's a pointer
				type = SDNA[block.header.sdnaIndex];
				name = type.name;
			}
			var len = (block.header.size-(address-block.header.address)) / (type.size || this.ps);
			if(len == 1) return this.create(name, block, address);// you might want to change this exception to always return an array; or to do so for some special types
			else if(len < 1e6){
				var ret = [];
				for(var i=0;i<len;i++){
					ret.push(this.create(name, block, address));
					address+=type.size;
				} return ret;
			} else {
				console.log(name);
				console.log(type);
				console.log(address);
				console.log(len);
				console.log("interner Error, der sonst nicht auftritt");
			}
		}
	},
	create:function(name, block, address){
		if(!ClassLib[name]){
			var type = DNAType[name];
			this.createClass(type);
		} return new this[name](block, address);
	},
	createClass(type){
		var clazz = new Function('block, address', "this.block = block;this.address = address;");
		
		var that = this;
		var index = 0;
		type.fields.forEach(function(field){
			var type = field.type;
			var nativ = that.nativity(type.name);
			var pointer = field.signatureName.startsWith("*");
			var array = field.signatureName.endsWith("]");
			if(array){
				array = field.signatureName;
				array = array.substring(array.indexOf('[')+1, array.length-1);
				var arraylen = array*1.;
					if(!arraylen){
					arraylen = array.substring(0, 1)*+array.substring(3);
					if(!arraylen){
						throw field.signatureName+array;
					} else {
						array = arraylen;
					}
				} else array = arraylen;
			}
			
			var func = 
				nativ == 2 ?
					"this.block.bytes("+type.size+")":
				nativ == 1 ? // Float...
					"floatFromBits(this.block.bytes(4))":
				pointer ?
					"ClassLib['*']('"+type.name+"', this.block.bytes("+that.ps+"))":
					array ?
						"ClassLib.create('"+type.name+"', this.block, j+="+type.size+")":
						"ClassLib.create('"+type.name+"', this.block, "+index+"+this.address)";
			
			var source = "this.block.offset("+index+"+this.address);"+(
				array ?
					(!nativ && !pointer ? "var j="+(index-type.size)+"+this.address,":"var ")+"r=[];for(var i=0;i<"+array+";i++)r.push("+func+");return "+(type.name=="char"?"cstring(r)":"r"):
					"return "+func
			);
			
			clazz.prototype["get"+field.name.charAt(0).toUpperCase()+field.name.substring(1)] = new Function('', source);
			
			var sz = pointer ?
				that.ps * (array || 1):
				array ?
					array * field.type.size:
					field.type.size;
					
			index += sz;
		});
		
		clazz.prototype.class = type.name;
		this[type.name] = clazz;
			
		if(index > type.size){// there is a critical error -> report it...
			console.log(index+"/"+type.size);
			console.log(clazz);
			console.log(type);
			throw ":/";
		}
	},
	nativity(name){
		switch(name.toLowerCase()){
		case "byte":case 'char':case "short":case "int":
		case "uint64_t":
			return 2;
		case "float":
			return 1;
		case "double":
			throw "Double is not yet implemented! Fix it and register it inside of the class constructor!";
		default:return 0;
		} 
	}
};

function Manager(blenderFile){
	ClassLib.ps = blenderFile.header.pointerSize;
	ClassLib.bf = blenderFile;
	var model = blenderFile.getBlenderModel();
	var that = this;
	blenderFile.blockTable.sorted.forEach(function(block){
		var header = block.header;
		var code = header.code;
		if(!(code == "DNA1" || code == "ENDB" || code == "TEST")){
			var struct = model.getStruct(header.sdnaIndex);
			var blendFields = struct.fields;
			if (blendFields.length > 0 && blendFields[0].type.name == "ID"){
				var name = struct.type.name;
				if(!that[name]) that[name] = [];
				that[name].push(ClassLib.create(struct.type.name, block, block.header.address));
			}
		}
	});
}