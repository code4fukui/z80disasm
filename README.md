# z80js - A JavaScript based Z80 Disassembler and Simulator

- [RUN on web](https://code4fukui.github.io/z80js/z80js.html)
    - under construction, many "not implemented"

### usage

### disassemble

```js
import { z80disasm } from "https://code4fukui.github.io/z80js/z80disasm.js";

const bin = new Uint8Array([0x21, 0, 1, 0xc9, 0, 0xff, 0xff]);
console.log(z80disasm(bin, 0));
console.log(z80disasm(bin, 3));
```

### disassembler

```sh
deno --allow-read --allow-import zda.js [bin file]
```

#### instnall

```sh
deno install -g --allow-read --allow-import zda.js
```

#### uninstall

```sh
deno uninstall -g zda
```
