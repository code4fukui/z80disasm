# z80js - A Javascript based Z80 Disassembler and Simulator

### usage

```js
import { z80disasm } from "https://code4fukui.github.io/z80disasm/z80disasm.js";

const bin = new Uint8Array([0x21, 0, 1, 0xc9, 0, 0xff, 0xff]);
console.log(z80disasm(bin, 0));
console.log(z80disasm(bin, 3));
```
