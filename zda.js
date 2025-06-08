import { Z80CPU } from "./z80cpu.js";
import { bin2short } from "https://code4fukui.github.io/binutil/binutil.js";

let fn = null;
let romflg = false;

for (const arg of Deno.args) {
  if (arg == "-rom") {
    romflg = true;
  } else if (!fn) {
    fn = arg;
  }
}

if (!fn) {
  console.log("zda (-rom) [bin file]");
  Deno.exit(1);
}

const bin = await Deno.readFile(fn);
const z80 = Object.create(Z80CPU);

if (romflg) {
  const mem = new Uint8Array(0x4000 + bin.length);
  mem.set(bin, 0x4000);
  const entry = bin2short(mem, 0x4002, true);
  z80.memory = mem;
  z80.registers.PC = entry;
  //console.log(entry.toString(16))
} else {
  z80.memory = bin;
}

const s = z80.disassemble();
console.log(s);
