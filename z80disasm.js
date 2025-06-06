import { Z80CPU } from "./z80cpu.js";

export const z80disasm = (memory, pc) => {
  const z80 = Object.create(Z80CPU);
  console.log(z80);
  z80.memory = memory;
  z80.registers.PC = pc;
  return z80.disassemble1();
};
