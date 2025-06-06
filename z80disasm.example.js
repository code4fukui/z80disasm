import { z80disasm } from "./z80disasm.js";

const bin = new Uint8Array([0x21, 0, 1, 0xc9, 0, 0xff, 0xff]);
console.log(z80disasm(bin, 0));
console.log(z80disasm(bin, 3));
