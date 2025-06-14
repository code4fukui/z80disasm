import { asWordHex, asByteHex } from "./util.js";

//https://github.com/GoogleChrome/samples/blob/gh-pages/classes-es6/demo.js
//class Z80CPUClass{};

const fix4 = (s) => ("000" + s).substring(s.length + 3 - 4);
const mem2word = (cpu, d = 0) => "0x" + fix4((cpu.memory[cpu.registers.rPC() + 1 + d] + cpu.memory[cpu.registers.rPC() + 2 + d] * 256).toString(16));

export var Z80CPU = {
	programMemory:function(mem){this.memory=mem;},
	memory:undefined,
	mempages:undefined, //defines which part of the memory is ROM and which is RAM. This is specific to the external hardware and thus does not belong into the Z80 cpu core.
	logger: undefined,
	log: function (s) {
		if (!this.logger) return;
		this.logger.log(s);
	},
	warn: function (s) {
		if (!this.logger) return;
		this.logger.warn(s);
	},
	error: function (s) {
		if (!this.logger) return;
		this.logger.error(s);
	},
	disassemble1: function(){
		//logger.log(this.memory.length);
		if (!this.memory) {
			//throw new Error("memory not loaded. disassembling failed");
			return null;
		}
		if (this.registers.PC >= this.memory.length) {
			//throw new Error("no more memory. disassembling failed.");
			return null;
		}
		const instruction = this.fetchInstruction();
		if (!instruction) {
			this.registers.PC++;
			//throw new Error("opcode not found. disassembling failed.");
			return "'opcode not found";
		}
		const cut = (s) => {
			if (s.startsWith("mf ")) return s.substring(3);
			if (s.startsWith("nip ")) return s.substring(4);
			return s;
		};
		const listing = cut(instruction.disassemble(this).toLowerCase());
		this.registers.PC += instruction.length;
		return listing;
	},
	disassemble: function(){
		var listing = "";
		//logger.log(this.memory.length);
		if(this.memory!=null){
			while(this.registers.PC<this.memory.length){
				var instruction=this.fetchInstruction();
					if(instruction!=null){
						listing+=asWordHex(this.registers.PC)+":\t"+asByteHex(instruction.opcode)+"\t\t"+instruction.disassemble(this).toLowerCase()+"\n";
						this.registers.PC+=instruction.length;
					}else{
						listing+="opcode not found. disassembling failed.\n";
						this.registers.PC+=1;
					}
				}
			return listing;
		}else{
			return "memory not loaded. disassembling failed.\n";
		}			
	},
	interrupt: function(){
		//the z80 knows three different modes of interrupt handling. None is implemented yet.
		//mode 0: z80 (multi-byte) instruction is read from databus and excecuted.
		//mode 1: call to subroutine at address 0x38.
		//mode 2: 
		if(this.state.intMode==1&&this.state.intActive){
			this.state.halted=false;this.registers.PC=0x38;
		}else{
			this.warn("mode not implemented")
		}
	},
	nonmaskableinterrupt: function(){
		if(this.state.intMode==1){
			this.state.halted=false;this.registers.PC=0x38;
		}else{
			this.warn("mode not implemented")
		}
	},
	reset: function(){
		this.flags.S=false;this.flags.Z=false;this.flags.H=false;this.flags.PV=false;this.flags.N=false;this.flags.C=false;
		this.registers.R=0; this.registers.I=0;
		this.registers.A=0; this.registers.W=0; this.registers.Z=0; this.registers.B=0; this.registers.C=0; this.registers.D=0; this.registers.E=0; this.registers.H=0; this.registers.L=0;
		this.registers.Adash=0; this.registers.WAdash=0; this.registers.ZAdash=0; this.registers.BAdash=0; this.registers.CAdash=0; this.registers.DAdash=0; this.registers.EAdash=0; this.registers.HAdash=0; this.registers.LAdash=0;
		this.registers.IX=0; this.registers.IY=0; this.registers.SP=0; this.registers.PC=0;
		this.registers.inOut=new Uint8Array(256);
		this.state.halted=false;
		this.state.intMode=1;
		this.flags.parent=this;
		this.registers.parent=this;
	},
	step: function(){
		var listing="";
		if(this.memory!=null){
			if(this.registers.PC<this.memory.length){
				var opcode=this.memory[this.registers.PC];
				var instruction=this.fetchInstruction();
				if(instruction!=null){
					listing+=asWordHex(this.registers.PC)+":\t"+asByteHex(instruction.opcode)+"\t\t"+instruction.disassemble(this).toLowerCase()+"\n";
					instruction.execute(this);
				}else{
					this.error("opcode ("+asByteHex(opcode)+") not found");
					return listing+="opcode ("+asByteHex(opcode)+") not found. excecution failed.\n";
				}
				return listing;
			}
			return "out of memory\n";
		}else{
			return "memory not loaded. excectuion failed.\n";
		}
	},
	fetchInstruction: function(){
		//logger.log("this.memory["+asWordHex(this.registers.PC)+"]: "+asByteHex(this.memory[this.registers.PC]));
		var opcode1=this.memory[this.registers.PC];
		if(this.state.halted){
			opcode1=0x00;
		}
		var filteredinstructions = this.instructions.filter(function(obj,i,list){return obj.opcode[0]==opcode1;});
		//logger.log(filteredinstructions);
		var n=filteredinstructions.length;
		if(n==1){
			//logger.log("found.")
			return filteredinstructions[0];
		}else if(n<1){
			this.error("opcode ("+asByteHex(opcode1)+") not found.");
			return undefined;
		}else{
			//this.warn("opcode ("+asByteHex(opcode1)+") not unique. continuing search.");
			var opcode2=this.memory[this.registers.PC+1];
			filteredinstructions = filteredinstructions.filter(function(obj,i,list){return ((obj.opcode[0]==opcode1)&&(obj.opcode[1]==opcode2));});
			n=filteredinstructions.length;
			if(n==1){
				return filteredinstructions[0];
			}else if(n<1){
				this.error("opcode 2 ("+asByteHex(opcode1)+","+asByteHex(opcode2)+") not found.");
				return undefined;
			}else{
				//this.warn("opcode 2 ("+asByteHex(opcode1)+") not unique. continuing search.");
				var opcode3=this.memory[this.registers.PC+3];
				filteredinstructions = filteredinstructions.filter(function(obj,i,list){return (obj.opcode[0]==opcode1&&obj.opcode[1]==opcode2&&obj.opcode[3]==opcode3);});
				n=filteredinstructions.length;
				if(n==1){
					return filteredinstructions[0];
				}else{
					this.error("opcode 3 ("+asByteHex(opcode1)+","+asByteHex(opcode2)+","+asByteHex(opcode3)+") not found.");
				return undefined;
				}
			}
		}	
		return undefined;
	},
	//state
	state:{
		altRegSelect:false,
		intMode:1,
		intActive:false,
		halted:false
		},
	//flags
	//F register holds flags
	//bit 7 S - sign flag
	//bit 6 Z - zero flag
	//bit 5 X - not used / undocumented flag
	//bit 4 H - half carry flag (carry from bit 3 to bit 3. used for BCD arithmetic)
    //bit 3 X - not used / undocumented flag
	//bit 2 P/V - parity or overflow
	//bit 1 N - last operation was subtract
	//bit 0 C - carry
	flags:{
		parent: null,
		S:false,
		gS:function(){return this.S},
		sS:function(){//TODO this needs to update F register
			this.S=false
			this.parent.registers.F|=(1<<7);//set
		},
		cS:function(){//TODO this needs to update F register
			this.S=false;
			this.parent.registers.F&=~(1<<7);//clear
		},
		Z:false,
		gZ:function(){return this.Z;},
		sZ:function(){this.Z=true;this.parent.registers.F|=(1<<6);},
		cZ:function(){this.Z=false;this.parent.registers.F&=~(1<<6);},
		H:false,
		gH:function(){return this.H;},
		sH:function(){this.H=true;this.parent.registers.F|=(1<<4);},
		cH:function(){this.H=false;this.parent.registers.F&=~(1<<4);},
		PV:false,
		gPV:function(){return this.PV;},
		sPV:function(){this.PV=true;this.parent.registers.F|=(1<<2);},
		cPV:function(){this.PV=false;this.parent.registers.F&=~(1<<2);},
		N:false,
		gN:function(){return this.N;},
		sN:function(){this.N=true;this.parent.registers.F|=(1<<1);},
		cN:function(){this.N=false;this.parent.registers.F&=~(1<<1);},
		C:false,
		gC:function(){return this.C;},
		sC:function(){this.C=true;this.parent.registers.F|=(1<<0);},
		cC:function(){this.C=false;this.parent.registers.F&=~(1<<0);},
	},
	alu:{
		parent:null,
		add:function(){},
		adc:function(){},
		sub:function(){},
		sbc:function(){},
		and:function(){},
		xor:function(){},
		or:function(){},
		cp:function(){},
		inc:function(){parent.flags.cN()},
		dec:function(){parent.flags.sN()},
		daa:function(){},
		cpl:function(){},
		scf:function(){},
		ccf:function(){},
		neg:function(){},
		bit:function(){},
		res:function(){},
		set:function(){},
		rcla:function(){},
		rrca:function(){},
		rla:function(){},
		rra:function(){},
		rld:function(){},
		rrd:function(){},
		rlc:function(){},
		rrc:function(){},
		rl:function(){},
		rr:function(){},
		sla:function(){},
		sra:function(){},
		sls:function(){},
		srl:function(){}
	},
	//registers
	registers:{
		parent: null,
		R:0,
		rR:function(){return this.R;},
		wR:function(val){this.R=val;},
		I:0,
		rI:function(){return this.I;},
		wI:function(val){this.I=val;},
		A:0,
		rA:function(){return this.A;},
		wA:function(val){this.A=val;},
		Adash:0,
		F:0,
		rF:function(){return this.F;},
		wF:function(val){this.F=val;},//TODO this needs to update the flags
		Fdash:0,
		W:0,
		rW:function(){return this.W;},
		wW:function(val){this.W=val;},
		Wdash:0,
		Z:0,
		rZ:function(){return this.Z;},
		wZ:function(val){this.Z=val;},
		Zdash:0,
		B:0,
		rB:function(){return this.B;},
		wB:function(val){this.B=val;},
		Bdash:0,
		C:0,
		rC:function(){return this.C;},
		wC:function(val){this.C=val;},
		Cdash:0,
		rBC:function(){return this.B*256+this.C;},
		wBC:function(val){this.B=Math.floor(val/256);this.C=val-this.B*256;},
		D:0,
		fD:function(){return this.D;},
		wD:function(val){this.D=val;},
		Ddash:0,
		E:0,
		rE:function(){return this.E;},
		wE:function(val){this.E=val;},
		rDE:function(){return this.D*256+this.E;},
		wDE:function(val){this.D=Math.floor(val/256);this.E=val-this.D*256;},
		Edash:0,
		H:0,
		rH:function(){return this.H;},
		wH:function(val){this.H=val;},
		Hdash:0,
		L:0,
		rL:function(){return this.L;},
		wL:function(val){this.L=val;},
		Ldash:0,
		rHL:function(){return this.H*256+this.L;},
		wHL:function(val){this.H=Math.floor(val/256);this.L=val-this.H*256;},
		IX:0,
		rIX:function(){return this.IX;},
		wIX:function(val){this.IX=val;},
		IY:0,
		rIY:function(){return this.IY;},
		wIY:function(val){this.IY=val;},
		SP:0,
		rSP:function(){return this.SP;},
		wSP:function(val){this.SP=val;},
		PC:0,
		rPC:function(){return this.PC;},
		wPC:function(val){this.PC=val;},
		inOut: new Uint8Array(256) //registers reachable by the in and out instructions
	},
	//instructions
	instructions:[
		//8bit load
		{opcode:[0x7F],length:1,mnemonic:"LD A,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x78],length:1,mnemonic:"LD A,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x79],length:1,mnemonic:"LD A,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x7A],length:1,mnemonic:"LD A,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x7B],length:1,mnemonic:"LD A,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x7C],length:1,mnemonic:"LD A,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x7D],length:1,mnemonic:"LD A,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x7E],length:1,mnemonic:"LD A,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.memory[cpu.registers.rHL()]);cpu.registers.PC+=this.length;}},
		{opcode:[0x0A],length:1,mnemonic:"LD A,(BC)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x1A],length:1,mnemonic:"LD A,(DE)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x3A],length:3,mnemonic:"LD A,(nn)",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x3E],length:2,mnemonic:"LD A,n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("n",asByteHex(cpu.memory[cpu.registers.PC+1]));},execute:function(cpu){cpu.registers.wA(cpu.memory[cpu.registers.PC+1]);cpu.registers.PC+=this.length;}},
		{opcode:[0x47],length:1,mnemonic:"LD B,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wB(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x40],length:1,mnemonic:"LD B,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wB(cpu.registers.rB());cpu.registers.PC+=this.length;}},
		{opcode:[0x41],length:1,mnemonic:"LD B,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wB(cpu.registers.rC());cpu.registers.PC+=this.length;}},
		{opcode:[0x42],length:1,mnemonic:"LD B,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wB(cpu.registers.rD());cpu.registers.PC+=this.length;}},
		{opcode:[0x43],length:1,mnemonic:"LD B,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wB(cpu.registers.rE());cpu.registers.PC+=this.length;}},
		{opcode:[0x44],length:1,mnemonic:"LD B,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wB(cpu.registers.rH());cpu.registers.PC+=this.length;}},
		{opcode:[0x45],length:1,mnemonic:"LD B,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wB(cpu.registers.rL());cpu.registers.PC+=this.length;}},
		{opcode:[0x46],length:1,mnemonic:"LD B,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x06],length:2,mnemonic:"LD B,n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("n",asByteHex(cpu.memory[cpu.registers.PC+1]));},execute:function(cpu){cpu.registers.wB(cpu.memory[cpu.registers.PC+1]);cpu.registers.PC+=this.length;}},
		{opcode:[0x4F],length:1,mnemonic:"LD C,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wC(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x48],length:1,mnemonic:"LD C,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wC(cpu.registers.rB());cpu.registers.PC+=this.length;}},
		{opcode:[0x49],length:1,mnemonic:"LD C,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wC(cpu.registers.rC());cpu.registers.PC+=this.length;}},
		{opcode:[0x4A],length:1,mnemonic:"LD C,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wC(cpu.registers.rD());cpu.registers.PC+=this.length;}},
		{opcode:[0x4B],length:1,mnemonic:"LD C,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wC(cpu.registers.rE());cpu.registers.PC+=this.length;}},
		{opcode:[0x4C],length:1,mnemonic:"LD C,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wC(cpu.registers.rH());cpu.registers.PC+=this.length;}},
		{opcode:[0x4D],length:1,mnemonic:"LD C,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wC(cpu.registers.rL());cpu.registers.PC+=this.length;}},
		{opcode:[0x4E],length:1,mnemonic:"LD C,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x0E],length:2,mnemonic:"LD C,n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("n",asByteHex(cpu.memory[cpu.registers.PC+1]));},execute:function(cpu){cpu.registers.wC(cpu.memory[cpu.registers.PC+1]);cpu.registers.PC+=this.length;}},
		{opcode:[0x57],length:1,mnemonic:"LD D,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wD(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x50],length:1,mnemonic:"LD D,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wD(cpu.registers.rB());cpu.registers.PC+=this.length;}},
		{opcode:[0x51],length:1,mnemonic:"LD D,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wD(cpu.registers.rC());cpu.registers.PC+=this.length;}},
		{opcode:[0x52],length:1,mnemonic:"LD D,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wD(cpu.registers.rD());cpu.registers.PC+=this.length;}},
		{opcode:[0x53],length:1,mnemonic:"LD D,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wD(cpu.registers.rE());cpu.registers.PC+=this.length;}},
		{opcode:[0x54],length:1,mnemonic:"LD D,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wD(cpu.registers.rH());cpu.registers.PC+=this.length;}},
		{opcode:[0x55],length:1,mnemonic:"LD D,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wD(cpu.registers.rL());cpu.registers.PC+=this.length;}},
		{opcode:[0x56],length:1,mnemonic:"LD D,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x16],length:2,mnemonic:"LD D,n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("n",asByteHex(cpu.memory[cpu.registers.PC+1]));},execute:function(cpu){cpu.registers.wD(cpu.memory[cpu.registers.PC+1]);cpu.registers.PC+=this.length;}},
		{opcode:[0x5F],length:1,mnemonic:"LD E,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wE(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x58],length:1,mnemonic:"LD E,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wE(cpu.registers.rB());cpu.registers.PC+=this.length;}},
		{opcode:[0x59],length:1,mnemonic:"LD E,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wE(cpu.registers.rC());cpu.registers.PC+=this.length;}},
		{opcode:[0x5A],length:1,mnemonic:"LD E,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wE(cpu.registers.rD());cpu.registers.PC+=this.length;}},
		{opcode:[0x5B],length:1,mnemonic:"LD E,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wE(cpu.registers.rE());cpu.registers.PC+=this.length;}},
		{opcode:[0x5C],length:1,mnemonic:"LD E,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wE(cpu.registers.rH());cpu.registers.PC+=this.length;}},
		{opcode:[0x5D],length:1,mnemonic:"LD E,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wE(cpu.registers.rL());cpu.registers.PC+=this.length;}},
		{opcode:[0x5E],length:1,mnemonic:"LD E,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x1E],length:2,mnemonic:"LD E,n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("n",asByteHex(cpu.memory[cpu.registers.PC+1]));},execute:function(cpu){cpu.registers.wE(cpu.memory[cpu.registers.PC+1]);cpu.registers.PC+=this.length;}},
		{opcode:[0x67],length:1,mnemonic:"LD H,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wH(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x60],length:1,mnemonic:"LD H,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wH(cpu.registers.rB());cpu.registers.PC+=this.length;}},
		{opcode:[0x61],length:1,mnemonic:"LD H,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wH(cpu.registers.rC());cpu.registers.PC+=this.length;}},
		{opcode:[0x62],length:1,mnemonic:"LD H,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wH(cpu.registers.rD());cpu.registers.PC+=this.length;}},
		{opcode:[0x63],length:1,mnemonic:"LD H,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wH(cpu.registers.rE());cpu.registers.PC+=this.length;}},
		{opcode:[0x64],length:1,mnemonic:"LD H,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wH(cpu.registers.rH());cpu.registers.PC+=this.length;}},
		{opcode:[0x65],length:1,mnemonic:"LD H,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wH(cpu.registers.rL());cpu.registers.PC+=this.length;}},
		{opcode:[0x66],length:1,mnemonic:"LD H,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x26],length:2,mnemonic:"LD H,n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("n",asByteHex(cpu.memory[cpu.registers.PC+1]));},execute:function(cpu){cpu.registers.wH(cpu.memory[cpu.registers.PC+1]);cpu.registers.PC+=this.length;}},
		{opcode:[0x6F],length:1,mnemonic:"LD L,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wL(cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0x68],length:1,mnemonic:"LD L,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wL(cpu.registers.rB());cpu.registers.PC+=this.length;}},
		{opcode:[0x69],length:1,mnemonic:"LD L,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wL(cpu.registers.rC());cpu.registers.PC+=this.length;}},
		{opcode:[0x6A],length:1,mnemonic:"LD L,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wL(cpu.registers.rD());cpu.registers.PC+=this.length;}},
		{opcode:[0x6B],length:1,mnemonic:"LD L,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wL(cpu.registers.rE());cpu.registers.PC+=this.length;}},
		{opcode:[0x6C],length:1,mnemonic:"LD L,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wL(cpu.registers.rH());cpu.registers.PC+=this.length;}},
		{opcode:[0x6D],length:1,mnemonic:"LD L,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wL(cpu.registers.rL());cpu.registers.PC+=this.length;}},
		{opcode:[0x6E],length:1,mnemonic:"LD L,(HL)",operands:"(HL)",mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x2E],length:2,mnemonic:"LD L,n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("n",asByteHex(cpu.memory[cpu.registers.PC+1]));},execute:function(cpu){cpu.registers.wL(cpu.memory[cpu.registers.PC+1]);cpu.registers.PC+=this.length;}},
		
		{opcode:[0x77],length:1,mnemonic:"LD (HL),A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.memory[cpu.registers.rHL()]=cpu.registers.rA();cpu.registers.PC+=this.length;}},
		{opcode:[0x70],length:1,mnemonic:"LD (HL),B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.memory[cpu.registers.rHL()]=cpu.registers.rB();cpu.registers.PC+=this.length;}},
		{opcode:[0x71],length:1,mnemonic:"LD (HL),C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.memory[cpu.registers.rHL()]=cpu.registers.rC();cpu.registers.PC+=this.length;}},
		{opcode:[0x72],length:1,mnemonic:"LD (HL),D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.memory[cpu.registers.rHL()]=cpu.registers.rD();cpu.registers.PC+=this.length;}},
		{opcode:[0x73],length:1,mnemonic:"LD (HL),E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.memory[cpu.registers.rHL()]=cpu.registers.rE();cpu.registers.PC+=this.length;}},
		{opcode:[0x74],length:1,mnemonic:"LD (HL),H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.memory[cpu.registers.rHL()]=cpu.registers.rH();cpu.registers.PC+=this.length;}},
		{opcode:[0x75],length:1,mnemonic:"LD (HL),L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.memory[cpu.registers.rHL()]=cpu.registers.rL();cpu.registers.PC+=this.length;}},
		{opcode:[0x36],length:2,mnemonic:"LD (HL),n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("n",asByteHex(cpu.memory[cpu.registers.PC+1]));},execute:function(cpu){cpu.memory[cpu.registers.rHL()]=cpu.memory[cpu.registers.PC+1];cpu.registers.PC+=this.length;}},
		
		{opcode:[0x02],length:1,mnemonic:"LD (BC),A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x12],length:1,mnemonic:"LD (DE),A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x32],length:3,mnemonic:"LD (nn),A",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",mem2word(cpu));},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		
		{opcode:[0xDD,0x7E],length:3,mnemonic:"LD A,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x46],length:3,mnemonic:"LD B,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x4E],length:3,mnemonic:"LD C,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x56],length:3,mnemonic:"LD D,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x5E],length:3,mnemonic:"LD E,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x66],length:3,mnemonic:"LD H,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x6E],length:3,mnemonic:"LD L,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xFD,0x7E],length:3,mnemonic:"LD A,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x46],length:3,mnemonic:"LD B,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x4E],length:3,mnemonic:"LD C,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x56],length:3,mnemonic:"LD D,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x5E],length:3,mnemonic:"LD E,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x66],length:3,mnemonic:"LD H,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x6E],length:3,mnemonic:"LD L,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xDD,0x77],length:3,mnemonic:"LD (IX+d),A",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x70],length:3,mnemonic:"LD (IX+d),B",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x71],length:3,mnemonic:"LD (IX+d),C",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x72],length:3,mnemonic:"LD (IX+d),D",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x73],length:3,mnemonic:"LD (IX+d),E",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x74],length:3,mnemonic:"LD (IX+d),H",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x75],length:3,mnemonic:"LD (IX+d),L",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xFD,0x77],length:3,mnemonic:"LD (IY+d),A",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x70],length:3,mnemonic:"LD (IY+d),B",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x71],length:3,mnemonic:"LD (IY+d),C",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x72],length:3,mnemonic:"LD (IY+d),D",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x73],length:3,mnemonic:"LD (IY+d),E",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x74],length:3,mnemonic:"LD (IY+d),H",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x75],length:3,mnemonic:"LD (IY+d),L",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xDD,0x7E],length:4,mnemonic:"LD (IX+d),n",operands:["d","n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x7E],length:4,mnemonic:"LD (IY+d),n",operands:["d","n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xED,0x57],length:2,mnemonic:"LD A,I",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){reg("A",reg("I"));cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x5F],length:2,mnemonic:"LD A,R",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){reg("A",reg("R"));cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x47],length:2,mnemonic:"LD I,A",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){reg("I",reg("A"));cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x4F],length:2,mnemonic:"LD R,A",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){reg("R",reg("A"));cpu.registers.PC+=this.length;}},
		
		//16bit load
		{opcode:[0x01],length:3,mnemonic:"LD BC,nn",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",mem2word(cpu));},execute:function(cpu){cpu.registers.sBC(cpu.memory[cpu.registers.rPC()+1]*256+cpu.memory[cpu.registers.rPC()+2]);cpu.registers.PC+=this.length;}},
		{opcode:[0x11],length:3,mnemonic:"LD DE,nn",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",mem2word(cpu));},execute:function(cpu){cpu.registers.wDE(cpu.memory[cpu.registers.rPC()+1]*256+cpu.memory[cpu.registers.rPC()+2]);cpu.registers.PC+=this.length;}},
		{opcode:[0x21],length:3,mnemonic:"LD HL,nn",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",mem2word(cpu));},execute:function(cpu){cpu.registers.wHL(cpu.memory[cpu.registers.rPC()+1]*256+cpu.memory[cpu.registers.rPC()+2]);cpu.registers.PC+=this.length;}},
		{opcode:[0x31],length:3,mnemonic:"LD SP,nn",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",mem2word(cpu));},execute:function(cpu){cpu.registers.sSP(cpu.memory[cpu.registers.rPC()+1]*256+cpu.memory[cpu.registers.rPC()+2]);cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x21],length:4,mnemonic:"LD IX,nn",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",mem2word(cpu, 1));},execute:function(cpu){cpu.registers.sIX(cpu.memory[cpu.registers.rPC()+2]*256+cpu.memory[cpu.registers.rPC()+3]);cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x21],length:4,mnemonic:"LD IY,nn",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",mem2word(cpu, 1));},execute:function(cpu){cpu.registers.sIY(cpu.memory[cpu.registers.rPC()+2]*256+cpu.memory[cpu.registers.rPC()+3]);cpu.registers.PC+=this.length;}},
		
		{opcode:[0xED,0x4B],length:4,mnemonic:"LD BC,(nn)",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1]);},execute:function(cpu){cpu.registers.DE=cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1];cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x5B],length:4,mnemonic:"LD DE,(nn)",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1]);},execute:function(cpu){cpu.registers.HL=cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1];cpu.registers.PC+=this.length;}},
		{opcode:[0x2A],length:3,mnemonic:"LD HL,(nn)",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1]);},execute:function(cpu){cpu.registers.HL=cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1];cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x7B],length:3,mnemonic:"LD SP,(nn)",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1]);},execute:function(cpu){cpu.registers.PC=cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1];cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x2A],length:4,mnemonic:"LD IX,(nn)",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1]);},execute:function(cpu){cpu.registers.IX=cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1];cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x2A],length:4,mnemonic:"LD IY,(nn)",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace("nn",cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1]);},execute:function(cpu){cpu.registers.IY=cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+1];cpu.registers.PC+=this.length;}},

		{opcode:[0xED,0x43],length:4,mnemonic:"LD (nn),BC",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x53],length:4,mnemonic:"LD (nn),DE",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x22],length:3,mnemonic:"LD (nn),HL",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x73],length:4,mnemonic:"LD (nn),SP",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x22],length:4,mnemonic:"LD (nn),IX",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x22],length:4,mnemonic:"LD (nn),IY",operands:["(nn)"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xF9],length:1,mnemonic:"LD SP,HL",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){reg("SP",reg("HL"));cpu.registers.PC+=this.length;}},
		
		//stack commands
		{opcode:[0xC5],length:1,mnemonic:"PUSH BC",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xD5],length:1,mnemonic:"PUSH DE",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xE5],length:1,mnemonic:"PUSH HL",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xF5],length:1,mnemonic:"PUSH AF",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xE5],length:2,mnemonic:"PUSH IX",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xE5],length:2,mnemonic:"PUSH IY",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xC1],length:1,mnemonic:"POP BC",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xD1],length:1,mnemonic:"POP DE",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xE1],length:1,mnemonic:"POP HL",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xF1],length:1,mnemonic:"POP AF",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xE1],length:2,mnemonic:"POP IX",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xE1],length:2,mnemonic:"POP IY",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		//register swap commands
		{opcode:[0xE3],length:1,mnemonic:"EX (SP),HL",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xE3],length:2,mnemonic:"EX (SP),IX",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xE3],length:2,mnemonic:"EX (SP),IY",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xEB],length:1,mnemonic:"EX DE,HL",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x08],length:1,mnemonic:"EX AF,AF'",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xD9],length:1,mnemonic:"EXX",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		//block transfer and search
		{opcode:[0xED,0xA0],length:1,mnemonic:"LDI",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xB0],length:1,mnemonic:"LDIR",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xA8],length:1,mnemonic:"LDD",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xB8],length:1,mnemonic:"LDDR",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xA1],length:1,mnemonic:"CPI",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xB1],length:1,mnemonic:"CPIR",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xA9],length:1,mnemonic:"CPD",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xB9],length:1,mnemonic:"CPDR",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		//8bit arithmetic
		{opcode:[0x87],length:1,mnemonic:"ADD A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x80],length:1,mnemonic:"ADD B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x81],length:1,mnemonic:"ADD C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x82],length:1,mnemonic:"ADD D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x83],length:1,mnemonic:"ADD E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x84],length:1,mnemonic:"ADD H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x85],length:1,mnemonic:"ADD L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x86],length:1,mnemonic:"ADD (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xC6],length:2,mnemonic:"ADD n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x86],length:3,mnemonic:"ADD (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x86],length:3,mnemonic:"ADD (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x8F],length:1,mnemonic:"ADC A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x88],length:1,mnemonic:"ADC B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x89],length:1,mnemonic:"ADC C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x8A],length:1,mnemonic:"ADC D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x8B],length:1,mnemonic:"ADC E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x8C],length:1,mnemonic:"ADC H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x8D],length:1,mnemonic:"ADC L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x8E],length:1,mnemonic:"ADC (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCE],length:2,mnemonic:"ADC n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x8E],length:3,mnemonic:"ADC (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x8E],length:3,mnemonic:"ADC (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x97],length:1,mnemonic:"SUB A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x90],length:1,mnemonic:"SUB B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x91],length:1,mnemonic:"SUB C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x92],length:1,mnemonic:"SUB D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x93],length:1,mnemonic:"SUB E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x94],length:1,mnemonic:"SUB H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x95],length:1,mnemonic:"SUB L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x96],length:1,mnemonic:"SUB (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDE],length:2,mnemonic:"SUB n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x96],length:3,mnemonic:"SUB (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x96],length:3,mnemonic:"SUB (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x9F],length:1,mnemonic:"SBC A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x98],length:1,mnemonic:"SBC B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x99],length:1,mnemonic:"SBC C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x9A],length:1,mnemonic:"SBC D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x9B],length:1,mnemonic:"SBC E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x9C],length:1,mnemonic:"SBC H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x9D],length:1,mnemonic:"SBC L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x9E],length:1,mnemonic:"SBC (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDE],length:2,mnemonic:"SBC n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x9E],length:3,mnemonic:"SBC (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x9E],length:3,mnemonic:"SBC (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xA7],length:1,mnemonic:"AND A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xA0],length:1,mnemonic:"AND B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xA1],length:1,mnemonic:"AND C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xA2],length:1,mnemonic:"AND D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xA3],length:1,mnemonic:"AND E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xA4],length:1,mnemonic:"AND H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xA5],length:1,mnemonic:"AND L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xA6],length:1,mnemonic:"AND (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xE6],length:2,mnemonic:"AND n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xA6],length:3,mnemonic:"AND (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xA6],length:3,mnemonic:"AND (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xAF],length:1,mnemonic:"XOR A",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA() ^ cpu.registers.rA());cpu.registers.PC+=this.length;}},
		{opcode:[0xA8],length:1,mnemonic:"XOR B",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA() ^ cpu.registers.rB());cpu.registers.PC+=this.length;}},
		{opcode:[0xA9],length:1,mnemonic:"XOR C",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA() ^ cpu.registers.rC());cpu.registers.PC+=this.length;}},
		{opcode:[0xAA],length:1,mnemonic:"XOR D",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA() ^ cpu.registers.rD());cpu.registers.PC+=this.length;}},
		{opcode:[0xAB],length:1,mnemonic:"XOR E",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA() ^ cpu.registers.rE());cpu.registers.PC+=this.length;}},
		{opcode:[0xAC],length:1,mnemonic:"XOR H",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA() ^ cpu.registers.rH());cpu.registers.PC+=this.length;}},
		{opcode:[0xAD],length:1,mnemonic:"XOR L",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA() ^ cpu.registers.rL());cpu.registers.PC+=this.length;}},
		{opcode:[0xAE],length:1,mnemonic:"XOR (HL)",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA() ^ cpu.registers.rL());cpu.registers.PC+=this.length;}},
		{opcode:[0xEE],length:2,mnemonic:"XOR n",operands:["n"],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic.replace("n",cpu.memory[cpu.registers.PC+1]);},execute:function(cpu){cpu.registers.wA(cpu.registers.rA() ^ cpu.memory[cpu.registers.PC+1]);cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xAE],length:3,mnemonic:"XOR (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xAE],length:3,mnemonic:"XOR (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xB7],length:1,mnemonic:"OR A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xB0],length:1,mnemonic:"OR B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xB1],length:1,mnemonic:"OR C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xB2],length:1,mnemonic:"OR D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xB3],length:1,mnemonic:"OR E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xB4],length:1,mnemonic:"OR H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xB5],length:1,mnemonic:"OR L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xB6],length:1,mnemonic:"OR (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xF6],length:2,mnemonic:"OR n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xB6],length:3,mnemonic:"OR (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xB6],length:3,mnemonic:"OR (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xBF],length:1,mnemonic:"CP A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xB8],length:1,mnemonic:"CP B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xB9],length:1,mnemonic:"CP C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xBA],length:1,mnemonic:"CP D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xBB],length:1,mnemonic:"CP E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xBC],length:1,mnemonic:"CP H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xBD],length:1,mnemonic:"CP L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xBE],length:1,mnemonic:"CP (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFE],length:2,mnemonic:"CP n",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xBE],length:3,mnemonic:"CP (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xBE],length:3,mnemonic:"CP (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x3C],length:1,mnemonic:"INC A",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0x04],length:1,mnemonic:"INC B",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wB(cpu.registers.rB()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0x0C],length:1,mnemonic:"INC C",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wC(cpu.registers.rC()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0x14],length:1,mnemonic:"INC D",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wD(cpu.registers.rD()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0x1C],length:1,mnemonic:"INC E",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wE(cpu.registers.rE()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0x24],length:1,mnemonic:"INC H",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wH(cpu.registers.rH()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0x2C],length:1,mnemonic:"INC L",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wL(cpu.registers.rL()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0x34],length:1,mnemonic:"INC (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x34],length:3,mnemonic:"INC (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x34],length:3,mnemonic:"INC (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x3D],length:1,mnemonic:"DEC A",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wA(cpu.registers.rA()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0x05],length:1,mnemonic:"DEC B",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wB(cpu.registers.rB()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0x0D],length:1,mnemonic:"DEC C",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wC(cpu.registers.rC()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0x15],length:1,mnemonic:"DEC D",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wD(cpu.registers.rD()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0x1D],length:1,mnemonic:"DEC E",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wE(cpu.registers.rE()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0x25],length:1,mnemonic:"DEC H",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wH(cpu.registers.rH()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0x2D],length:1,mnemonic:"DEC L",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wL(cpu.registers.rL()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0x35],length:1,mnemonic:"DEC (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x35],length:3,mnemonic:"DEC (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x35],length:3,mnemonic:"DEC (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},

		{opcode:[0x27],length:1,mnemonic:"DAA",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x2F],length:1,mnemonic:"CPL",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x37],length:1,mnemonic:"SCF",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x3F],length:1,mnemonic:"CCF",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x44],length:2,mnemonic:"NEG",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		//16bit arithmetic
		{opcode:[0x09],length:1,mnemonic:"ADD HL,BC",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x19],length:1,mnemonic:"ADD HL,DE",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x29],length:1,mnemonic:"ADD HL,HL",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x39],length:1,mnemonic:"ADD HL,SP",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xED,0x4A],length:1,mnemonic:"ADC HL,BC",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x5A],length:1,mnemonic:"ADC HL,DE",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x6A],length:1,mnemonic:"ADC HL,HL",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x7A],length:1,mnemonic:"ADC HL,SP",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xED,0x42],length:1,mnemonic:"SBC HL,BC",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x52],length:1,mnemonic:"SBC HL,DE",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x62],length:1,mnemonic:"SBC HL,HL",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x72],length:1,mnemonic:"SBC HL,SP",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
				
		{opcode:[0xDD,0x09],length:1,mnemonic:"ADD IX,BC",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x19],length:1,mnemonic:"ADD IX,DE",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x39],length:1,mnemonic:"ADD IX,SP",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x29],length:1,mnemonic:"ADD IX,IX",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xFD,0x09],length:1,mnemonic:"ADD IY,BC",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x19],length:1,mnemonic:"ADD IY,DE",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x39],length:1,mnemonic:"ADD IY,SP",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x29],length:1,mnemonic:"ADD IY,IY",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0x03],length:1,mnemonic:"INC BC",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.sBC(cpu.registers.gBC()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0x13],length:1,mnemonic:"INC DE",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wDE(cpu.registers.rDE()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0x23],length:1,mnemonic:"INC HL",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wHL(cpu.registers.rHL()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0x33],length:1,mnemonic:"INC SP",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.sSP(cpu.registers.gSP()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x23],length:1,mnemonic:"INC IX",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.sIX(cpu.registers.rIX()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x23],length:1,mnemonic:"INC IY",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.sIY(cpu.registers.rIY()+1);cpu.registers.PC+=this.length;}},
		{opcode:[0x0B],length:1,mnemonic:"DEC BC",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.sBC(cpu.registers.gBC()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0x1B],length:1,mnemonic:"DEC DE",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wDE(cpu.registers.rDE()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0x2B],length:1,mnemonic:"DEC HL",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.wHL(cpu.registers.rHL()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0x3B],length:1,mnemonic:"DEC SP",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.sSP(cpu.registers.gSP()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0x2B],length:1,mnemonic:"DEC IX",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.sIX(cpu.registers.rIX()-1);cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0x2B],length:1,mnemonic:"DEC IY",operands:[],mcycles:[-1],flags:"not implemented",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.sIY(cpu.registers.rIY()-1);cpu.registers.PC+=this.length;}},
		
		//jumps and subroutines
		{opcode:[0xCA],length:3,mnemonic:"JP Z",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic + "," + mem2word(cpu);},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xC2],length:3,mnemonic:"JP NZ",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic + "," + mem2word(cpu);},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDA],length:3,mnemonic:"JP C",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic + "," + mem2word(cpu);},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xD2],length:3,mnemonic:"JP NC",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic + "," + mem2word(cpu);},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xEA],length:3,mnemonic:"JP PE",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic + "," + mem2word(cpu);},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xE2],length:3,mnemonic:"JP PO",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic + "," + mem2word(cpu);},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFA],length:3,mnemonic:"JP M",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic + "," + mem2word(cpu);},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xF2],length:3,mnemonic:"JP P",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic + "," + mem2word(cpu);},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCC],length:3,mnemonic:"CALL Z",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xC4],length:3,mnemonic:"CALL NZ",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDC],length:3,mnemonic:"CALL C",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xD4],length:3,mnemonic:"CALL NC",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xEC],length:3,mnemonic:"CALL PE",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xE4],length:3,mnemonic:"CALL PO",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFC],length:3,mnemonic:"CALL M",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xF4],length:3,mnemonic:"CALL P",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xC8],length:1,mnemonic:"RET Z",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xC0],length:1,mnemonic:"RET NZ",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xD8],length:1,mnemonic:"RET C",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xD0],length:1,mnemonic:"RET NC",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xE8],length:1,mnemonic:"RET PE",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xE0],length:1,mnemonic:"RET PO",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xF8],length:1,mnemonic:"RET M",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xF0],length:1,mnemonic:"RET P",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0x28],length:2,mnemonic:"JR Z",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x20],length:2,mnemonic:"JR NZ",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x38],length:2,mnemonic:"JR C",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x30],length:2,mnemonic:"JR NC",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xC3],length:3,mnemonic:"JP",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic+" " + mem2word(cpu);},execute:function(cpu){cpu.registers.PC=cpu.memory[cpu.registers.PC+1]*256+cpu.memory[cpu.registers.PC+2];}},
		{opcode:[0xE9],length:1,mnemonic:"JP (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xE9],length:2,mnemonic:"JP (IX)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xE9],length:2,mnemonic:"JP (IY)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xC7],length:1,mnemonic:"JP 00",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){;cpu.registers.PC=0x00;}},
		{opcode:[0xCF],length:1,mnemonic:"JP 08",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){;cpu.registers.PC=0x08;}},
		{opcode:[0xD7],length:1,mnemonic:"JP 18",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){;cpu.registers.PC=0x10;}},
		{opcode:[0xDF],length:1,mnemonic:"JP 18",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){;cpu.registers.PC=0x18;}},
		{opcode:[0xE7],length:1,mnemonic:"JP 20",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){;cpu.registers.PC=0x20;}},
		{opcode:[0xEF],length:1,mnemonic:"JP 28",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){;cpu.registers.PC=0x28;}},
		{opcode:[0xF7],length:1,mnemonic:"JP 30",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){;cpu.registers.PC=0x30;}},
		{opcode:[0xFF],length:1,mnemonic:"JP 38",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){;cpu.registers.PC=0x38;}},
		
		{opcode:[0xCD],length:3,mnemonic:"CALL",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic+" "+asWordHex(cpu.memory[cpu.registers.PC+2]*256+cpu.memory[cpu.registers.PC+1]);},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x18],length:2,mnemonic:"JR",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic+" "+asWordHex(cpu.registers.PC+2+(cpu.memory[cpu.registers.PC+1]<<24 >>24));},execute:function(cpu){cpu.registers.PC+=2+(cpu.memory[cpu.registers.PC+1]<<24 >>24);}},
		{opcode:[0xC9],length:1,mnemonic:"RET",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x10],length:2,mnemonic:"DJNZ",operands:["nn"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){if(cpu.registers.B==0){cpu.registers.PC+=this.length;}else{cpu.registers.wB(cpu.registers.rB()-1);}}},
		
		{opcode:[0xED,0x4D],length:2,mnemonic:"RETI",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x45],length:2,mnemonic:"RETN",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		//rotation and bit shift
		{opcode:[0x07],length:1,mnemonic:"RCLA",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x0F],length:1,mnemonic:"RRCA",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x17],length:1,mnemonic:"RLA",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0x1F],length:1,mnemonic:"RRA",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x6F],length:2,mnemonic:"RLD",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x67],length:2,mnemonic:"RRD",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x07],length:2,mnemonic:"RLC A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x00],length:2,mnemonic:"RLC B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x01],length:2,mnemonic:"RLC C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x02],length:2,mnemonic:"RLC D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x03],length:2,mnemonic:"RLC E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x04],length:2,mnemonic:"RLC H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x05],length:2,mnemonic:"RLC L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x06],length:2,mnemonic:"RLC (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x06],length:4,mnemonic:"RLC (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x06],length:4,mnemonic:"RLC (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x0F],length:2,mnemonic:"RRC A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x08],length:2,mnemonic:"RRC B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x09],length:2,mnemonic:"RRC C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x0A],length:2,mnemonic:"RRC D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x0B],length:2,mnemonic:"RRC E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x0C],length:2,mnemonic:"RRC H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x0E],length:2,mnemonic:"RRC L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x0E],length:2,mnemonic:"RRC (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x0E],length:4,mnemonic:"RRC (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x0E],length:4,mnemonic:"RRC (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x17],length:2,mnemonic:"RL A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x10],length:2,mnemonic:"RL B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x11],length:2,mnemonic:"RL C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x12],length:2,mnemonic:"RL D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x13],length:2,mnemonic:"RL E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x14],length:2,mnemonic:"RL H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x15],length:2,mnemonic:"RL L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x16],length:2,mnemonic:"RL (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x16],length:4,mnemonic:"RL (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x16],length:4,mnemonic:"RL (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x1F],length:2,mnemonic:"RR A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x18],length:2,mnemonic:"RR B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x19],length:2,mnemonic:"RR C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x1A],length:2,mnemonic:"RR D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x1B],length:2,mnemonic:"RR E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x1C],length:2,mnemonic:"RR H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x1D],length:2,mnemonic:"RR L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x1E],length:2,mnemonic:"RR (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x1E],length:4,mnemonic:"RR (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x1E],length:4,mnemonic:"RR (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		
		{opcode:[0xCB,0x27],length:2,mnemonic:"SLA A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x20],length:2,mnemonic:"SLA B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x21],length:2,mnemonic:"SLA C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x22],length:2,mnemonic:"SLA D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x23],length:2,mnemonic:"SLA E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x24],length:2,mnemonic:"SLA H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x25],length:2,mnemonic:"SLA L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x26],length:2,mnemonic:"SLA (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x26],length:4,mnemonic:"SLA (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x26],length:4,mnemonic:"SLA (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x2F],length:2,mnemonic:"SRA A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x28],length:2,mnemonic:"SRA B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x29],length:2,mnemonic:"SRA C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x2A],length:2,mnemonic:"SRA D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x2B],length:2,mnemonic:"SRA E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x2C],length:2,mnemonic:"SRA H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x2E],length:2,mnemonic:"SRA L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x2E],length:2,mnemonic:"SRA (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x2E],length:4,mnemonic:"SRA (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x2E],length:4,mnemonic:"SRA (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x37],length:2,mnemonic:"SLS A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x30],length:2,mnemonic:"SLS B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x31],length:2,mnemonic:"SLS C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x32],length:2,mnemonic:"SLS D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x33],length:2,mnemonic:"SLS E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x34],length:2,mnemonic:"SLS H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x35],length:2,mnemonic:"SLS L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x36],length:2,mnemonic:"SLS (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x36],length:4,mnemonic:"SLS (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x36],length:4,mnemonic:"SLS (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x3F],length:2,mnemonic:"SRL A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x38],length:2,mnemonic:"SRL B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x39],length:2,mnemonic:"SRL C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x3A],length:2,mnemonic:"SRL D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x3B],length:2,mnemonic:"SRL E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x3C],length:2,mnemonic:"SRL H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x3D],length:2,mnemonic:"SRL L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x3E],length:2,mnemonic:"SRL (HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x3E],length:4,mnemonic:"SRL (IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x3E],length:4,mnemonic:"SRL (IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		//CPU control
		{opcode:[0x00],length:1,mnemonic:"NOP",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.registers.PC+=this.length;}},
		{opcode:[0x76],length:1,mnemonic:"HLT",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.state.halted=true;cpu.registers.PC+=this.length;}},
		
		{opcode:[0xF3],length:1,mnemonic:"DI",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.state.intActive=false;cpu.registers.PC+=this.length;}},
		{opcode:[0xFB],length:1,mnemonic:"EI",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.state.intActive=true;cpu.registers.PC+=this.length;}},
		
		{opcode:[0xED,0x46],length:1,mnemonic:"IM 0",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.status.intMode=0;cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x56],length:1,mnemonic:"IM 1",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.status.intMode=1;cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x5E],length:1,mnemonic:"IM 2",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.status.intMode=2;cpu.registers.PC+=this.length;}},
		
		//single bit operations
		{opcode:[0xCB,0x47],length:2,mnemonic:"BIT 0,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x40],length:2,mnemonic:"BIT 0,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x41],length:2,mnemonic:"BIT 0,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x42],length:2,mnemonic:"BIT 0,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x43],length:2,mnemonic:"BIT 0,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x44],length:2,mnemonic:"BIT 0,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x45],length:2,mnemonic:"BIT 0,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x46],length:2,mnemonic:"BIT 0,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x46],length:4,mnemonic:"BIT 0,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x46],length:4,mnemonic:"BIT 0,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},

		{opcode:[0xCB,0x4F],length:2,mnemonic:"BIT 1,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x48],length:2,mnemonic:"BIT 1,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x49],length:2,mnemonic:"BIT 1,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x4A],length:2,mnemonic:"BIT 1,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x4B],length:2,mnemonic:"BIT 1,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x4C],length:2,mnemonic:"BIT 1,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x4D],length:2,mnemonic:"BIT 1,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x4E],length:2,mnemonic:"BIT 1,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x4E],length:4,mnemonic:"BIT 1,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x4E],length:4,mnemonic:"BIT 1,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x57],length:2,mnemonic:"BIT 2,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x50],length:2,mnemonic:"BIT 2,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x51],length:2,mnemonic:"BIT 2,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x52],length:2,mnemonic:"BIT 2,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x53],length:2,mnemonic:"BIT 2,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x54],length:2,mnemonic:"BIT 2,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x55],length:2,mnemonic:"BIT 2,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x56],length:2,mnemonic:"BIT 2,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x56],length:4,mnemonic:"BIT 2,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x56],length:4,mnemonic:"BIT 2,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x5F],length:2,mnemonic:"BIT 3,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x58],length:2,mnemonic:"BIT 3,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x59],length:2,mnemonic:"BIT 3,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x5A],length:2,mnemonic:"BIT 3,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x5B],length:2,mnemonic:"BIT 3,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x5C],length:2,mnemonic:"BIT 3,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x5D],length:2,mnemonic:"BIT 3,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x5E],length:2,mnemonic:"BIT 3,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x5E],length:4,mnemonic:"BIT 3,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x5E],length:4,mnemonic:"BIT 3,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x67],length:2,mnemonic:"BIT 4,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x60],length:2,mnemonic:"BIT 4,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x61],length:2,mnemonic:"BIT 4,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x62],length:2,mnemonic:"BIT 4,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x63],length:2,mnemonic:"BIT 4,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x64],length:2,mnemonic:"BIT 4,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x65],length:2,mnemonic:"BIT 4,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x66],length:2,mnemonic:"BIT 4,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x66],length:4,mnemonic:"BIT 4,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x66],length:4,mnemonic:"BIT 4,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x6F],length:2,mnemonic:"BIT 5,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x68],length:2,mnemonic:"BIT 5,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x69],length:2,mnemonic:"BIT 5,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x6A],length:2,mnemonic:"BIT 5,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x6B],length:2,mnemonic:"BIT 5,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x6C],length:2,mnemonic:"BIT 5,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x6D],length:2,mnemonic:"BIT 5,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x6E],length:2,mnemonic:"BIT 5,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x6E],length:4,mnemonic:"BIT 5,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x6E],length:4,mnemonic:"BIT 5,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x77],length:2,mnemonic:"BIT 6,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x70],length:2,mnemonic:"BIT 6,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x71],length:2,mnemonic:"BIT 6,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x72],length:2,mnemonic:"BIT 6,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x73],length:2,mnemonic:"BIT 6,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x74],length:2,mnemonic:"BIT 6,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x75],length:2,mnemonic:"BIT 6,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x76],length:2,mnemonic:"BIT 6,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x76],length:4,mnemonic:"BIT 6,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x76],length:4,mnemonic:"BIT 6,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x7F],length:2,mnemonic:"BIT 7,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x78],length:2,mnemonic:"BIT 7,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x79],length:2,mnemonic:"BIT 7,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x7A],length:2,mnemonic:"BIT 7,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x7B],length:2,mnemonic:"BIT 7,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x7C],length:2,mnemonic:"BIT 7,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x7D],length:2,mnemonic:"BIT 7,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x7E],length:2,mnemonic:"BIT 7,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x7E],length:4,mnemonic:"BIT 7,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x7E],length:4,mnemonic:"BIT 7,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x87],length:2,mnemonic:"RES 0,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x80],length:2,mnemonic:"RES 0,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x81],length:2,mnemonic:"RES 0,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x82],length:2,mnemonic:"RES 0,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x83],length:2,mnemonic:"RES 0,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x84],length:2,mnemonic:"RES 0,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x85],length:2,mnemonic:"RES 0,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x86],length:2,mnemonic:"RES 0,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x86],length:4,mnemonic:"RES 0,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x86],length:4,mnemonic:"RES 0,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
	
		{opcode:[0xCB,0x8F],length:2,mnemonic:"RES 1,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x88],length:2,mnemonic:"RES 1,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x89],length:2,mnemonic:"RES 1,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x8A],length:2,mnemonic:"RES 1,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x8B],length:2,mnemonic:"RES 1,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x8C],length:2,mnemonic:"RES 1,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x8D],length:2,mnemonic:"RES 1,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x8E],length:2,mnemonic:"RES 1,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x8E],length:4,mnemonic:"RES 1,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x8E],length:4,mnemonic:"RES 1,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0x97],length:2,mnemonic:"RES 2,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x90],length:2,mnemonic:"RES 2,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x91],length:2,mnemonic:"RES 2,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x92],length:2,mnemonic:"RES 2,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x93],length:2,mnemonic:"RES 2,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x94],length:2,mnemonic:"RES 2,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x95],length:2,mnemonic:"RES 2,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x96],length:2,mnemonic:"RES 2,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x96],length:4,mnemonic:"RES 2,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x96],length:4,mnemonic:"RES 2,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},

		{opcode:[0xCB,0x9F],length:2,mnemonic:"RES 3,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x98],length:2,mnemonic:"RES 3,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x99],length:2,mnemonic:"RES 3,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x9A],length:2,mnemonic:"RES 3,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x9B],length:2,mnemonic:"RES 3,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x9C],length:2,mnemonic:"RES 3,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x9D],length:2,mnemonic:"RES 3,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0x9E],length:2,mnemonic:"RES 3,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0x9E],length:4,mnemonic:"RES 3,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0x9E],length:4,mnemonic:"RES 3,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0xA7],length:2,mnemonic:"RES 4,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xA0],length:2,mnemonic:"RES 4,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xA1],length:2,mnemonic:"RES 4,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xA2],length:2,mnemonic:"RES 4,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xA3],length:2,mnemonic:"RES 4,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xA4],length:2,mnemonic:"RES 4,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xA5],length:2,mnemonic:"RES 4,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xA6],length:2,mnemonic:"RES 4,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xA6],length:4,mnemonic:"RES 4,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xA6],length:4,mnemonic:"RES 4,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0xAF],length:2,mnemonic:"RES 5,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xA8],length:2,mnemonic:"RES 5,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xA9],length:2,mnemonic:"RES 5,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xAA],length:2,mnemonic:"RES 5,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xAB],length:2,mnemonic:"RES 5,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xAC],length:2,mnemonic:"RES 5,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xAD],length:2,mnemonic:"RES 5,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xAE],length:2,mnemonic:"RES 5,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xAE],length:4,mnemonic:"RES 5,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xAE],length:4,mnemonic:"RES 5,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
				
		{opcode:[0xCB,0xB7],length:2,mnemonic:"RES 6,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xB0],length:2,mnemonic:"RES 6,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xB1],length:2,mnemonic:"RES 6,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xB2],length:2,mnemonic:"RES 6,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xB3],length:2,mnemonic:"RES 6,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xB4],length:2,mnemonic:"RES 6,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xB5],length:2,mnemonic:"RES 6,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xB6],length:2,mnemonic:"RES 6,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xB6],length:4,mnemonic:"RES 6,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xB6],length:4,mnemonic:"RES 6,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0xBF],length:2,mnemonic:"RES 7,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xB8],length:2,mnemonic:"RES 7,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xB9],length:2,mnemonic:"RES 7,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xBA],length:2,mnemonic:"RES 7,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xBB],length:2,mnemonic:"RES 7,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xBC],length:2,mnemonic:"RES 7,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xBD],length:2,mnemonic:"RES 7,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xBE],length:2,mnemonic:"RES 7,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xBE],length:4,mnemonic:"RES 7,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xBE],length:4,mnemonic:"RES 7,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0xC7],length:2,mnemonic:"SET 0,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xC0],length:2,mnemonic:"SET 0,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xC1],length:2,mnemonic:"SET 0,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xC2],length:2,mnemonic:"SET 0,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xC3],length:2,mnemonic:"SET 0,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xC4],length:2,mnemonic:"SET 0,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xC5],length:2,mnemonic:"SET 0,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xC6],length:2,mnemonic:"SET 0,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xC6],length:4,mnemonic:"SET 0,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xC6],length:4,mnemonic:"SET 0,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},

		{opcode:[0xCB,0xCF],length:2,mnemonic:"SET 1,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xC8],length:2,mnemonic:"SET 1,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xC9],length:2,mnemonic:"SET 1,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xCA],length:2,mnemonic:"SET 1,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xCB],length:2,mnemonic:"SET 1,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xCC],length:2,mnemonic:"SET 1,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xCD],length:2,mnemonic:"SET 1,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xCE],length:2,mnemonic:"SET 1,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xCE],length:4,mnemonic:"SET 1,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xCE],length:4,mnemonic:"SET 1,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0xD7],length:2,mnemonic:"SET 2,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xD0],length:2,mnemonic:"SET 2,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xD1],length:2,mnemonic:"SET 2,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xD2],length:2,mnemonic:"SET 2,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xD3],length:2,mnemonic:"SET 2,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xD4],length:2,mnemonic:"SET 2,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xD5],length:2,mnemonic:"SET 2,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xD6],length:2,mnemonic:"SET 2,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xD6],length:4,mnemonic:"SET 2,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xD6],length:4,mnemonic:"SET 2,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0xDF],length:2,mnemonic:"SET 3,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xD8],length:2,mnemonic:"SET 3,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xD9],length:2,mnemonic:"SET 3,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xDA],length:2,mnemonic:"SET 3,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xDB],length:2,mnemonic:"SET 3,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xDC],length:2,mnemonic:"SET 3,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xDD],length:2,mnemonic:"SET 3,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xDE],length:2,mnemonic:"SET 3,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xDE],length:4,mnemonic:"SET 3,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xDE],length:4,mnemonic:"SET 3,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0xE7],length:2,mnemonic:"SET 4,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xE0],length:2,mnemonic:"SET 4,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xE1],length:2,mnemonic:"SET 4,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xE2],length:2,mnemonic:"SET 4,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xE3],length:2,mnemonic:"SET 4,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xE4],length:2,mnemonic:"SET 4,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xE5],length:2,mnemonic:"SET 4,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xE6],length:2,mnemonic:"SET 4,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xE6],length:4,mnemonic:"SET 4,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xE6],length:4,mnemonic:"SET 4,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0xEF],length:2,mnemonic:"SET 5,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xE8],length:2,mnemonic:"SET 5,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xE9],length:2,mnemonic:"SET 5,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xEA],length:2,mnemonic:"SET 5,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xEB],length:2,mnemonic:"SET 5,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xEC],length:2,mnemonic:"SET 5,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xED],length:2,mnemonic:"SET 5,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xEE],length:2,mnemonic:"SET 5,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xEE],length:4,mnemonic:"SET 5,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xEE],length:4,mnemonic:"SET 5,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0xF7],length:2,mnemonic:"SET 6,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xF0],length:2,mnemonic:"SET 6,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xF1],length:2,mnemonic:"SET 6,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xF2],length:2,mnemonic:"SET 6,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xF3],length:2,mnemonic:"SET 6,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xF4],length:2,mnemonic:"SET 6,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xF5],length:2,mnemonic:"SET 6,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xF6],length:2,mnemonic:"SET 6,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xF6],length:4,mnemonic:"SET 6,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xF6],length:4,mnemonic:"SET 6,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xCB,0xFF],length:2,mnemonic:"SET 7,A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xF8],length:2,mnemonic:"SET 7,B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xF9],length:2,mnemonic:"SET 7,C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xFA],length:2,mnemonic:"SET 7,D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xFB],length:2,mnemonic:"SET 7,E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xFC],length:2,mnemonic:"SET 7,H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xFD],length:2,mnemonic:"SET 7,L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xCB,0xFE],length:2,mnemonic:"SET 7,(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xDD,0xCB,,0xFE],length:4,mnemonic:"SET 7,(IX+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xFD,0xCB,,0xFE],length:4,mnemonic:"SET 7,(IY+d)",operands:["d"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		//input and output 
		{opcode:[0xED,0x78],length:2,mnemonic:"IN A,(C)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x40],length:2,mnemonic:"IN B,(C)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x48],length:2,mnemonic:"IN C,(C)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x50],length:2,mnemonic:"IN D,(C)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x58],length:2,mnemonic:"IN E,(C)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x60],length:2,mnemonic:"IN H,(C)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x68],length:2,mnemonic:"IN L,(C)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x70],length:2,mnemonic:"IN (HL),(C)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x79],length:2,mnemonic:"OUT (C),A",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x41],length:2,mnemonic:"OUT (C),B",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x49],length:2,mnemonic:"OUT (C),C",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x51],length:2,mnemonic:"OUT (C),D",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x59],length:2,mnemonic:"OUT (C),E",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x61],length:2,mnemonic:"OUT (C),H",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x69],length:2,mnemonic:"OUT (C),L",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0x71],length:2,mnemonic:"OUT (C),(HL)",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		
		{opcode:[0xDB],length:2,mnemonic:"IN A,(n)",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xD3],length:2,mnemonic:"OUT (n),A",operands:["n"],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic.replace(this.operands[0],asByteHex(cpu.memory[cpu.registers.PC+1]));},execute:function(cpu){cpu.registers.inOut[cpu.memory[cpu.registers.PC+1]]=cpu.registers.rA();cpu.registers.PC+=this.length;}},
		
		{opcode:[0xED,0xA2],length:2,mnemonic:"INI",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xB2],length:2,mnemonic:"INIR",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xAA],length:2,mnemonic:"IND",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xBA],length:2,mnemonic:"INDR",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xA3],length:2,mnemonic:"OUTI",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xB3],length:2,mnemonic:"OTIR",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xAB],length:2,mnemonic:"OUTD",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
		{opcode:[0xED,0xBB],length:2,mnemonic:"OTDR",operands:[],mcycles:[-1],flags:"",disassemble:function(cpu){return this.mnemonic;},execute:function(cpu){cpu.log("not implemented");cpu.registers.PC+=this.length;}},
	]
};