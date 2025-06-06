export  function pad(value, width) {
  value = value + "";
  return value.length >= width ? value : new Array(width - value.length + 1).join('0') + value;
}

export function asQwordHex(value) {
  return "0x" + pad(value.toString(16), 16);
}

export function asDwordHex(value) {
  return "0x" + pad(value.toString(16), 8);
}

export function asWordHex(value){
return "0x" + pad(value.toString(16), 4);
}

export function asByteHex(value){
	if( Array.isArray(value)) {
		let tmp = "";
		for (let i = 0; i < value.length; i++) {
			tmp += asByteHex(value[i]) + " ";
		}
		return tmp;
	}
	if (value == null) {
		return "____";
	}
  return "0x" + pad(value.toString(16), 2);
}
