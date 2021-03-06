"use strict";
let shuffle = require('./shuffle');
let unshuffle = require('./unshuffle');

function rotl8(val, bits) {
	return ((val << bits) | (val >> (8 - bits))) & 0xff;
}

function cipher8FromIV(iv) {
	let cipher8 = new Uint8Array(256);
	for (let ii = 0; ii < 8; ii++) {
		for (let jj = 0; jj < 32; jj++) {
			cipher8[32 * ii + jj] = rotl8(iv[jj], ii);
		}
	}
	return cipher8;
}

module.exports = {
	/**
	 * input:    cleartext Buffer
	 * iv:       Buffer; optional; length 32
	 * returns:  encrypted Buffer
	 */
	encrypt(input, iv) {

		// Allocate output space
		let roundedSize = input.length + (256 - (input.length % 256));
		let totalSize = roundedSize + 32;
		let outputBuffer = new ArrayBuffer(totalSize);
		let output8 = new Uint8Array(outputBuffer);
		let output32 = new Uint32Array(outputBuffer);

		// Write out IV
		if (!iv) {
			iv = Buffer.allocUnsafe(32);
			for (let ii = 0; ii < iv.length; ++ii) {
				iv[ii] = Math.random() * Math.pow(2, 8);
			}
		}
		iv.copy(output8);
		input.copy(output8, 32);
		if (roundedSize > input.length) {
			output8.fill(0, 32 + input.length);
		}
		output8[totalSize - 1] = 256 - (input.length % 256);

		// Initialize cipher
		let cipher8 = cipher8FromIV(iv);
		let cipher32 = new Int32Array(cipher8.buffer);

		// Encrypt in chunks of 256 bytes
		for (let offset = 32; offset < totalSize; offset += 256) {
			for (let ii = 0; ii < 64; ii++) {
				output32[offset / 4 + ii] ^= cipher32[ii];
			}
			shuffle(new Int32Array(outputBuffer, offset, 64));
			cipher8.set(output8.subarray(offset, offset + 256));
		}
		return Buffer.from(outputBuffer);
	},

	/**
	 * input:    encrypted Buffer
	 * returns:  cleartext Buffer
	 */
	decrypt(input) {

		// Allocate space for decrypted payload
		let output8 = new Uint8Array(input.slice(32));
		let outputBuffer = output8.buffer;
		let output32 = new Int32Array(outputBuffer);

		// Initialize cipher
		let cipher8 = cipher8FromIV(input.slice(0, 32));
		let cipher32 = new Int32Array(cipher8.buffer);
		
		// Decrypt in chunks of 256 bytes
		for (let offset = 0; offset < output8.length; offset += 256) {
			let tmp = output8.slice(offset, offset + 256);
			unshuffle(new Int32Array(outputBuffer, offset, 64));
			for (let ii = 0; ii < 64; ii++) {
				output32[offset / 4 + ii] ^= cipher32[ii];
			}
			cipher8 = tmp;
			cipher32 = new Int32Array(cipher8.buffer);
		}
		return new Buffer(outputBuffer, 0, output8.length - output8[output8.length - 1]);
	}
};
