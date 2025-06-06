import { Z80CPU } from "./z80cpu.js";

const z80 = Z80CPU;
console.log(z80);

const bin = new Uint8Array([0x21, 1, 0, 0xc9, 0, 0xff, 0xff]);
z80.memory = bin;
console.log(z80.disassemble1());
console.log(z80.disassemble1());
console.log(z80.disassemble1());
console.log(z80.disassemble1());
console.log(z80.disassemble1());
console.log(z80.disassemble1());
